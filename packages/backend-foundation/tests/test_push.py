"""foundation_backend.push and foundation_backend.routers.push: Web Push (issue #167).

The encryption is checked byte for byte against RFC 8291's worked example
(Appendix A), and every message is decrypted here as the browser would.
Nothing is sent over the network except to a local server, for redirects.
"""

import hashlib
import hmac
import json
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

import pytest
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from httpx import AsyncClient
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from foundation_backend import config, push
from foundation_backend.models import PushSubscription, User
from foundation_backend.routers import push as push_router

b64 = push.b64url_encode
unb64 = push.b64url_decode

FCM = "https://fcm.googleapis.com/fcm/send/abc123"


class Device:
    """A browser's side of a subscription: its key pair and auth secret."""

    def __init__(self) -> None:
        self.key = ec.generate_private_key(ec.SECP256R1())
        self.auth = b"0123456789abcdef"

    @property
    def p256dh(self) -> str:
        return b64(push.public_key_bytes(self.key))

    def decrypt(self, body: bytes) -> bytes:
        """RFC 8291 from the receiving end, written out apart from foundation_backend.push."""
        salt, record_size, id_length = body[:16], int.from_bytes(body[16:20], "big"), body[20]
        as_public = body[21 : 21 + id_length]
        assert record_size == 4096
        ua_public = push.public_key_bytes(self.key)
        secret = self.key.exchange(ec.ECDH(), ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), as_public))

        def hkdf(salt: bytes, ikm: bytes, info: bytes, length: int) -> bytes:
            prk = hmac.new(salt, ikm, hashlib.sha256).digest()
            return hmac.new(prk, info + b"\x01", hashlib.sha256).digest()[:length]

        ikm = hkdf(self.auth, secret, b"WebPush: info\x00" + ua_public + as_public, 32)
        cek = hkdf(salt, ikm, b"Content-Encoding: aes128gcm\x00", 16)
        nonce = hkdf(salt, ikm, b"Content-Encoding: nonce\x00", 12)
        plain = AESGCM(cek).decrypt(nonce, body[21 + id_length :], None)
        assert plain.endswith(b"\x02"), "the last record ends with the 0x02 delimiter"
        return plain[:-1]


@pytest.fixture
def vapid_key() -> ec.EllipticCurvePrivateKey:
    return ec.generate_private_key(ec.SECP256R1())


@pytest.fixture
def push_on(monkeypatch: pytest.MonkeyPatch, vapid_key: ec.EllipticCurvePrivateKey) -> None:
    monkeypatch.setattr(config, "PUSH_ENABLED", True)
    monkeypatch.setattr(config, "VAPID_PRIVATE_KEY", push.private_key_b64(vapid_key))
    monkeypatch.setattr(config, "VAPID_SUBJECT", "mailto:ops@example.com")


# ------------------------------------------------------------- RFC 8291


def test_encryption_matches_rfc_8291_appendix_a() -> None:
    server_key = push.load_private_key("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw")
    assert b64(push.public_key_bytes(server_key)) == (
        "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8"
    )
    body = push.encrypt(
        b"When I grow up, I want to be a watermelon",
        "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
        "BTBZMqHH6r4Tts7J_aSIgg",
        server_key=server_key,
        salt=unb64("DGv6ra1nlYgDCS1FRnbzlw"),
    )
    header = unb64(
        "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml"
        "mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8"
    )
    ciphertext = unb64("8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ")
    assert body == header + ciphertext


def test_a_message_decrypts_on_the_device_and_each_one_is_fresh() -> None:
    device = Device()
    first = push.encrypt(b'{"title":"Hi"}', device.p256dh, b64(device.auth))
    second = push.encrypt(b'{"title":"Hi"}', device.p256dh, b64(device.auth))
    assert device.decrypt(first) == b'{"title":"Hi"}'
    # A new key and salt per message: the same text never looks the same.
    assert first != second and first[:16] != second[:16]


def test_a_payload_too_big_for_one_record_is_refused() -> None:
    device = Device()
    with pytest.raises(ValueError):
        push.encrypt(b"x" * (push.MAX_PAYLOAD_BYTES + 1), device.p256dh, b64(device.auth))


# ---------------------------------------------------------------- VAPID


def test_the_vapid_header_is_an_es256_token_for_the_push_service(vapid_key: ec.EllipticCurvePrivateKey) -> None:
    header = push.vapid_authorization(FCM, vapid_key, "mailto:ops@example.com", now=1_000_000)
    token = header.removeprefix("vapid t=").split(", k=")[0]
    assert header.endswith(f", k={b64(push.public_key_bytes(vapid_key))}")
    head, claims, signature = token.split(".")
    assert json.loads(unb64(head)) == {"typ": "JWT", "alg": "ES256"}
    assert json.loads(unb64(claims)) == {
        "aud": "https://fcm.googleapis.com",
        "exp": 1_000_000 + push.VAPID_TOKEN_SECONDS,
        "sub": "mailto:ops@example.com",
    }
    raw = unb64(signature)
    assert len(raw) == 64
    der = encode_dss_signature(int.from_bytes(raw[:32], "big"), int.from_bytes(raw[32:], "big"))
    # Raises if the signature doesn't verify.
    vapid_key.public_key().verify(der, f"{head}.{claims}".encode(), ec.ECDSA(hashes.SHA256()))


def test_a_private_key_round_trips_through_its_base64url_form(vapid_key: ec.EllipticCurvePrivateKey) -> None:
    again = push.load_private_key(push.private_key_b64(vapid_key))
    assert push.public_key_bytes(again) == push.public_key_bytes(vapid_key)
    with pytest.raises(ValueError):
        push.load_private_key(b64(b"too short"))


# --------------------------------------------------------- the endpoint


@pytest.mark.parametrize(
    "endpoint",
    [
        FCM,
        "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
        "https://web.push.apple.com/QGuQyavXutnMH",
        "https://wns2-par02p.notify.windows.com/w/?token=BQYAAA",
    ],
)
def test_the_browsers_push_services_are_allowed(endpoint: str) -> None:
    assert push.endpoint_problem(endpoint) is None


@pytest.mark.parametrize(
    "endpoint",
    [
        "http://fcm.googleapis.com/fcm/send/abc",
        "https://fcm.googleapis.com.evil.example/fcm/send/abc",
        "https://evilfcm.googleapis.com/x",
        "https://169.254.169.254/latest/meta-data",
        "https://localhost/x",
        "https://fcm.googleapis.com:8443/x",
        "https://user@fcm.googleapis.com/x",
        "not a url",
    ],
)
def test_anywhere_else_is_refused(endpoint: str) -> None:
    assert push.endpoint_problem(endpoint) is not None


def test_a_redirect_from_the_endpoint_is_not_followed() -> None:
    hits: list[str] = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:
            hits.append(self.path)
            # Read the body before answering, as a real server does: closing
            # a socket with unread data on it is a TCP reset on Windows, which
            # the client can see before the 302 (#226).
            self.rfile.read(int(self.headers.get("Content-Length", 0)))
            self.send_response(302)
            self.send_header("Location", "/elsewhere")
            self.end_headers()

        def log_message(self, *_: Any) -> None:
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status = push.deliver(f"http://127.0.0.1:{server.server_port}/push", b"x", "vapid t=x, k=y", 60)
    finally:
        server.shutdown()
    assert status == 302
    assert hits == ["/push"]


# --------------------------------------------------------------- config


def test_config_problems_name_what_is_missing(monkeypatch: pytest.MonkeyPatch, push_on: None) -> None:
    assert push.config_problem() is None
    monkeypatch.setattr(config, "VAPID_SUBJECT", "ops@example.com")
    assert "VAPID_SUBJECT" in (push.config_problem() or "")
    monkeypatch.setattr(config, "VAPID_PRIVATE_KEY", "bm90IGEga2V5")
    assert "VAPID_PRIVATE_KEY" in (push.config_problem() or "")
    monkeypatch.setattr(config, "VAPID_PRIVATE_KEY", None)
    assert "VAPID_PRIVATE_KEY" in (push.config_problem() or "")
    monkeypatch.setattr(push, "crypto_installed", lambda: False)
    assert "push extra" in (push.config_problem() or "")
    monkeypatch.setattr(config, "PUSH_ENABLED", False)
    assert push.config_problem() is None


# ---------------------------------------------------------------- routes


def _subscription(device: Device, endpoint: str = FCM) -> dict[str, Any]:
    return {"endpoint": endpoint, "expirationTime": None, "keys": {"p256dh": device.p256dh, "auth": b64(device.auth)}}


async def test_every_route_is_404_when_push_is_off(client: AsyncClient) -> None:
    assert config.PUSH_ENABLED is False
    assert (await client.get("/api/push/public-key")).status_code == 404
    assert (await client.post("/api/push/subscriptions", json=_subscription(Device()))).status_code == 404
    assert (await client.delete("/api/push/subscriptions/1")).status_code == 404


async def test_the_public_key_is_the_configured_keys(
    client: AsyncClient, push_on: None, vapid_key: ec.EllipticCurvePrivateKey
) -> None:
    response = await client.get("/api/push/public-key")
    assert response.status_code == 200
    assert response.json() == {"publicKey": b64(push.public_key_bytes(vapid_key))}


async def test_a_device_subscribes_once_however_often_it_asks(
    client: AsyncClient, session: AsyncSession, push_on: None
) -> None:
    device = Device()
    first = await client.post("/api/push/subscriptions", json=_subscription(device))
    assert first.status_code == 201
    renewed = Device()
    again = await client.post("/api/push/subscriptions", json=_subscription(renewed))
    assert again.status_code == 201
    assert again.json() == first.json()
    rows = (await session.exec(select(PushSubscription))).all()
    assert [(row.endpoint, row.p256dh, row.user_id) for row in rows] == [(FCM, renewed.p256dh, 1)]


async def test_a_subscription_to_somewhere_else_or_with_bad_keys_is_a_422(client: AsyncClient, push_on: None) -> None:
    elsewhere = await client.post("/api/push/subscriptions", json=_subscription(Device(), "https://example.com/x"))
    assert elsewhere.status_code == 422
    assert elsewhere.json()["detail"][0]["loc"] == ["body", "endpoint"]
    bad_keys = _subscription(Device())
    bad_keys["keys"]["p256dh"] = b64(b"\x04" + b"\x00" * 64)
    response = await client.post("/api/push/subscriptions", json=bad_keys)
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "keys"]


async def test_a_user_keeps_their_newest_devices_up_to_the_cap(
    client: AsyncClient, session: AsyncSession, push_on: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(push_router, "MAX_DEVICES_PER_USER", 2)
    device = Device()
    for name in ("a", "b", "c"):
        assert (await client.post("/api/push/subscriptions", json=_subscription(device, f"{FCM}-{name}"))).status_code == 201
    endpoints = (await session.exec(select(col(PushSubscription.endpoint)).order_by(col(PushSubscription.id)))).all()
    assert endpoints == [f"{FCM}-b", f"{FCM}-c"]


async def test_an_expiration_time_that_isnt_whole_is_accepted(client: AsyncClient, push_on: None) -> None:
    body = _subscription(Device())
    body["expirationTime"] = 1767225600000.5
    assert (await client.post("/api/push/subscriptions", json=body)).status_code == 201


async def test_a_user_deletes_their_own_device_and_no_one_elses(
    client: AsyncClient, session: AsyncSession, push_on: None
) -> None:
    session.add(User(id=2, email="other@example.com", name="Other", password_hash="unused"))
    await session.flush()
    session.add(
        PushSubscription(
            id=50, user_id=2, endpoint=f"{FCM}-other", p256dh="x", auth="y", created_at=datetime.now(timezone.utc)
        )
    )
    await session.commit()
    mine = (await client.post("/api/push/subscriptions", json=_subscription(Device()))).json()["id"]
    assert (await client.delete("/api/push/subscriptions/50")).status_code == 404
    assert (await client.delete(f"/api/push/subscriptions/{mine}")).status_code == 204
    assert (await client.delete(f"/api/push/subscriptions/{mine}")).status_code == 404
    left = (await session.exec(select(col(PushSubscription.id)))).all()
    assert left == [50]


# ------------------------------------------------------------------ send


class PushService:
    """Stands in for deliver(): records each POST, answers 201 unless told otherwise."""

    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []
        self.statuses: dict[str, int] = {}

    def deliver(self, endpoint: str, body: bytes, authorization: str, ttl: int) -> int:
        self.sent.append({"endpoint": endpoint, "body": body, "authorization": authorization, "ttl": ttl})
        return self.statuses.get(endpoint, 201)


@pytest.fixture
def push_service(monkeypatch: pytest.MonkeyPatch) -> PushService:
    service = PushService()
    monkeypatch.setattr(push, "deliver", service.deliver)
    return service


async def _subscribe(session: AsyncSession, device: Device, endpoint: str, user_id: int = 1) -> None:
    session.add(
        PushSubscription(
            user_id=user_id, endpoint=endpoint, p256dh=device.p256dh, auth=b64(device.auth), created_at=datetime.now(timezone.utc)
        )
    )
    await session.commit()


async def test_send_push_reaches_every_device_and_drops_the_gone_ones(
    session: AsyncSession, push_on: None, push_service: PushService
) -> None:
    statuses = push_service.statuses
    phone, laptop, old = Device(), Device(), Device()
    await _subscribe(session, phone, f"{FCM}-phone")
    await _subscribe(session, laptop, "https://updates.push.services.mozilla.com/wpush/v2/laptop")
    await _subscribe(session, old, f"{FCM}-old")
    statuses[f"{FCM}-old"] = 410
    statuses["https://updates.push.services.mozilla.com/wpush/v2/laptop"] = 503

    result = await push.send_push(session, 1, "Time to stretch", "Two minutes.", "/routines/3", tag="reminder-3")

    assert (result.sent, result.removed, result.failed) == (1, 1, 1)
    assert result.summary() == "1 sent, 1 gone, 1 failed"
    phone_message = next(sent for sent in push_service.sent if sent["endpoint"] == f"{FCM}-phone")
    assert json.loads(phone.decrypt(phone_message["body"])) == {
        "title": "Time to stretch",
        "body": "Two minutes.",
        "url": "/routines/3",
        "tag": "reminder-3",
    }
    assert phone_message["authorization"].startswith("vapid t=")
    assert phone_message["ttl"] == push.DEFAULT_TTL_SECONDS
    endpoints = (await session.exec(select(col(PushSubscription.endpoint)).order_by(col(PushSubscription.id)))).all()
    assert endpoints == [f"{FCM}-phone", "https://updates.push.services.mozilla.com/wpush/v2/laptop"]


async def test_send_push_never_sends_to_a_host_no_longer_allowed(
    session: AsyncSession, push_on: None, push_service: PushService, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _subscribe(session, Device(), FCM)
    monkeypatch.setattr(config, "PUSH_ALLOWED_HOSTS", ("updates.push.services.mozilla.com",))
    result = await push.send_push(session, 1, "Hi")
    assert (result.sent, result.failed) == (0, 1)
    assert push_service.sent == []


async def test_a_message_opens_a_path_in_the_app_only(session: AsyncSession, push_on: None) -> None:
    for url in ("https://example.com", "//example.com/x", "routines"):
        with pytest.raises(ValueError):
            await push.send_push(session, 1, "Hi", url=url)
