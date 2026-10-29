"""Web Push (issue #167): a notification on the user's device, sent by the
backend, that arrives with the app closed.

    result = await send_push(session, user_id, title="Time to stretch", body="Two minutes.", url="/routines")

How it works: the browser subscribes with its push service (Google's for
Chrome, Mozilla's, Apple's, Microsoft's) and hands the app an endpoint URL
and two keys, stored in push_subscriptions (routers/push.py). To send,
the backend encrypts the message to the browser's key (RFC 8291,
aes128gcm), signs a token saying which server sent it (VAPID, RFC 8292)
and POSTs both to the endpoint. The push service delivers it, and the
app's service worker shows it.

Off unless PUSH_ENABLED, and the only module needing the `push` extra
(`pip install -e ".[push]"`, the `cryptography` package): imported lazily,
so a backend without the extra starts and serves everything else.

What's here, and only that:

- The protocol on `cryptography`'s primitives (ECDSA and ECDH on P-256,
  AES-128-GCM); HKDF is the stdlib's hmac. Tested byte for byte against
  RFC 8291's worked example (tests/test_push.py).
- **Only the push services' hosts.** The endpoint comes from the browser,
  so a signed-in user could hand in any URL; the backend POSTs only to
  https on PUSH_ALLOWED_HOSTS, and never follows a redirect.
- **A subscription the push service says is gone (404, 410) is deleted.**
  Anything else that fails is logged and kept for the next send.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import importlib.util
import json
import logging
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING
from urllib.parse import urlsplit

from sqlmodel import col, delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from foundation_backend import config
from foundation_backend.push_models import PushSubscription

if TYPE_CHECKING:
    from cryptography.hazmat.primitives.asymmetric.ec import EllipticCurvePrivateKey

logger = logging.getLogger("app.push")

RECORD_SIZE = 4096
# A push service accepts at least 4096 bytes of body (RFC 8030). The body
# is the 86-byte header, the payload, its 1-byte delimiter and the 16-byte
# tag, so a payload under 3900 bytes always fits.
MAX_PAYLOAD_BYTES = 3900
MAX_TITLE = 100
MAX_BODY = 1000
SEND_TIMEOUT_SECONDS = 10
VAPID_TOKEN_SECONDS = 12 * 60 * 60
# How long the push service keeps a message for a device that's offline.
# A reminder an hour late is still worth having; one a day late isn't.
DEFAULT_TTL_SECONDS = 60 * 60


def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def b64url_decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


# ---------------------------------------------------------------- config


def crypto_installed() -> bool:
    return importlib.util.find_spec("cryptography") is not None


def config_problem() -> str | None:
    """Why push can't run as configured, or None. main.py refuses to start
    with PUSH_ENABLED and a problem, in every environment: a subscription is
    tied to the VAPID key it was made with, so a missing or changed key
    would quietly stop every reminder."""
    if not config.PUSH_ENABLED:
        return None
    if not crypto_installed():
        return 'PUSH_ENABLED is true but the push extra isn\'t installed: pip install -e ".[push]".'
    if not config.VAPID_PRIVATE_KEY:
        return "PUSH_ENABLED is true but VAPID_PRIVATE_KEY is unset. Make a key pair with scripts/generate_vapid_keys.py."
    try:
        load_private_key(config.VAPID_PRIVATE_KEY)
    except ValueError:
        return "VAPID_PRIVATE_KEY isn't a P-256 private key (32 bytes, base64url). Make one with scripts/generate_vapid_keys.py."
    subject = config.VAPID_SUBJECT or ""
    if not (subject.startswith("mailto:") or subject.startswith("https://")):
        return (
            "PUSH_ENABLED is true but VAPID_SUBJECT isn't a mailto: or https:// address. Push services "
            "use it to reach whoever runs the app (e.g. mailto:ops@example.com)."
        )
    return None


# ------------------------------------------------------------------ keys


def load_private_key(value: str) -> EllipticCurvePrivateKey:
    """A VAPID private key: the 32-byte P-256 scalar, base64url, the form
    scripts/generate_vapid_keys.py (and the web-push tools) print."""
    from cryptography.hazmat.primitives.asymmetric import ec

    raw = b64url_decode(value.strip())
    if len(raw) != 32:
        raise ValueError("A P-256 private key is 32 bytes.")
    return ec.derive_private_key(int.from_bytes(raw, "big"), ec.SECP256R1())


def generate_private_key() -> EllipticCurvePrivateKey:
    from cryptography.hazmat.primitives.asymmetric import ec

    return ec.generate_private_key(ec.SECP256R1())


def private_key_b64(key: EllipticCurvePrivateKey) -> str:
    return b64url_encode(key.private_numbers().private_value.to_bytes(32, "big"))


def public_key_bytes(key: EllipticCurvePrivateKey) -> bytes:
    """The public key as an uncompressed point (65 bytes, starting 0x04)."""
    from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

    return key.public_key().public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)


def vapid_public_key() -> str:
    """The configured key's public half, base64url: what the browser
    subscribes with (`applicationServerKey`)."""
    if not config.VAPID_PRIVATE_KEY:
        raise RuntimeError("VAPID_PRIVATE_KEY is unset.")
    return b64url_encode(public_key_bytes(load_private_key(config.VAPID_PRIVATE_KEY)))


def subscription_key_problem(p256dh: str, auth: str) -> str | None:
    """Why a browser's subscription keys can't be encrypted to, or None."""
    from cryptography.hazmat.primitives.asymmetric import ec

    try:
        point = b64url_decode(p256dh)
        secret = b64url_decode(auth)
    except ValueError:
        return "The keys must be base64url."
    if len(secret) != 16:
        return "keys.auth must be 16 bytes."
    try:
        ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), point)
    except ValueError:
        return "keys.p256dh must be a P-256 public key (65 bytes, uncompressed)."
    return None


# -------------------------------------------------------------- endpoint


def endpoint_problem(endpoint: str) -> str | None:
    """Why the backend won't POST to `endpoint`, or None: it must be https
    on one of PUSH_ALLOWED_HOSTS (or a subdomain of one), default port."""
    try:
        parts = urlsplit(endpoint)
        port = parts.port
    except ValueError:
        return "The endpoint isn't a URL."
    if parts.scheme != "https" or not parts.hostname:
        return "The endpoint must be an https:// URL."
    if parts.username is not None or parts.password is not None or port not in (None, 443):
        return "The endpoint must be a push service's own address."
    host = parts.hostname.lower().rstrip(".")
    if not any(host == allowed or host.endswith(f".{allowed}") for allowed in config.PUSH_ALLOWED_HOSTS):
        return f"{host} isn't a known push service (PUSH_ALLOWED_HOSTS)."
    return None


# --------------------------------------------------------------- VAPID


def _ecdsa_jwt(claims: dict[str, object], key: EllipticCurvePrivateKey) -> str:
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature

    header = b64url_encode(json.dumps({"typ": "JWT", "alg": "ES256"}, separators=(",", ":")).encode())
    body = b64url_encode(json.dumps(claims, separators=(",", ":")).encode())
    signing_input = f"{header}.{body}".encode()
    r, s = decode_dss_signature(key.sign(signing_input, ec.ECDSA(hashes.SHA256())))
    # JWS wants the signature as r || s, 32 bytes each, not DER.
    return f"{header}.{body}.{b64url_encode(r.to_bytes(32, 'big') + s.to_bytes(32, 'big'))}"


def vapid_authorization(endpoint: str, key: EllipticCurvePrivateKey, subject: str, now: float | None = None) -> str:
    """The Authorization header for a POST to `endpoint` (RFC 8292)."""
    parts = urlsplit(endpoint)
    claims: dict[str, object] = {
        "aud": f"{parts.scheme}://{parts.netloc}",
        "exp": int((time.time() if now is None else now) + VAPID_TOKEN_SECONDS),
        "sub": subject,
    }
    return f"vapid t={_ecdsa_jwt(claims, key)}, k={b64url_encode(public_key_bytes(key))}"


# ------------------------------------------------------------ encryption


def _hkdf_extract(salt: bytes, ikm: bytes) -> bytes:
    return hmac.new(salt, ikm, hashlib.sha256).digest()


def _hkdf_expand(prk: bytes, info: bytes, length: int) -> bytes:
    # One block is enough for every length here (at most 32 bytes).
    return hmac.new(prk, info + b"\x01", hashlib.sha256).digest()[:length]


def encrypt(
    payload: bytes,
    p256dh: str,
    auth: str,
    *,
    server_key: EllipticCurvePrivateKey | None = None,
    salt: bytes | None = None,
) -> bytes:
    """The request body for one message (RFC 8291, aes128gcm, one record).
    `server_key` and `salt` are fresh for every message; tests pass the
    RFC's own to check the result."""
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    if len(payload) > MAX_PAYLOAD_BYTES:
        raise ValueError(f"A push payload is at most {MAX_PAYLOAD_BYTES} bytes.")
    ua_public = b64url_decode(p256dh)
    auth_secret = b64url_decode(auth)
    server_key = server_key or ec.generate_private_key(ec.SECP256R1())
    salt = salt if salt is not None else os.urandom(16)
    as_public = public_key_bytes(server_key)

    ecdh_secret = server_key.exchange(ec.ECDH(), ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), ua_public))
    prk_key = _hkdf_extract(auth_secret, ecdh_secret)
    ikm = _hkdf_expand(prk_key, b"WebPush: info\x00" + ua_public + as_public, 32)
    prk = _hkdf_extract(salt, ikm)
    cek = _hkdf_expand(prk, b"Content-Encoding: aes128gcm\x00", 16)
    nonce = _hkdf_expand(prk, b"Content-Encoding: nonce\x00", 12)

    # One record, so it's the last: the payload, then the 0x02 delimiter.
    ciphertext = AESGCM(cek).encrypt(nonce, payload + b"\x02", None)
    header = salt + RECORD_SIZE.to_bytes(4, "big") + bytes([len(as_public)]) + as_public
    return header + ciphertext


# ---------------------------------------------------------------- message


@dataclass(frozen=True)
class PushMessage:
    """What the service worker shows: a title, a line of text, and the
    app's own path to open when it's tapped. `tag`: a newer message with
    the same tag replaces the one still showing."""

    title: str
    body: str = ""
    url: str = "/"
    tag: str | None = None

    def payload(self) -> bytes:
        if not self.url.startswith("/") or self.url.startswith("//"):
            raise ValueError("A push message's url is a path in the app, starting with one /.")
        data: dict[str, str] = {"title": self.title[:MAX_TITLE], "body": self.body[:MAX_BODY], "url": self.url}
        if self.tag:
            data["tag"] = self.tag
        encoded = json.dumps(data, separators=(",", ":"), ensure_ascii=False).encode()
        if len(encoded) > MAX_PAYLOAD_BYTES:
            raise ValueError(f"A push message is at most {MAX_PAYLOAD_BYTES} bytes as JSON.")
        return encoded


# ------------------------------------------------------------------ send


class _NoRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args: object, **kwargs: object) -> None:
        # The endpoint was checked; wherever it redirects to wasn't.
        return None


_opener = urllib.request.build_opener(_NoRedirects)


def deliver(endpoint: str, body: bytes, authorization: str, ttl: int) -> int:
    """POSTs one encrypted message; the push service's status, or 0 when it
    couldn't be reached. Blocking: send_push runs it in a thread. Tests
    replace it."""
    request = urllib.request.Request(
        endpoint,
        data=body,
        method="POST",
        headers={
            "Content-Encoding": "aes128gcm",
            "Content-Type": "application/octet-stream",
            "TTL": str(ttl),
            "Urgency": "normal",
            "Authorization": authorization,
        },
    )
    try:
        with _opener.open(request, timeout=SEND_TIMEOUT_SECONDS) as response:  # noqa: S310 — endpoint_problem checked it
            return int(response.status)
    except urllib.error.HTTPError as exc:
        return int(exc.code)
    except (urllib.error.URLError, OSError):
        logger.warning("push: %s couldn't be reached", urlsplit(endpoint).hostname, exc_info=True)
        return 0


@dataclass
class PushResult:
    """How a send went: delivered to the push service, subscriptions it
    said are gone (deleted), and the rest (kept, logged)."""

    sent: int = 0
    removed: int = 0
    failed: int = 0

    def summary(self) -> str:
        parts = [f"{self.sent} sent"]
        if self.removed:
            parts.append(f"{self.removed} gone")
        if self.failed:
            parts.append(f"{self.failed} failed")
        return ", ".join(parts)


async def send_push(
    session: AsyncSession,
    user_id: int,
    title: str,
    body: str = "",
    url: str = "/",
    *,
    tag: str | None = None,
    ttl: int = DEFAULT_TTL_SECONDS,
) -> PushResult:
    """Sends a notification to every device `user_id` allowed reminders on.
    Deletes the subscriptions the push service says are gone, and commits
    that. A user with no subscriptions is sent nothing (0 sent)."""
    if not config.PUSH_ENABLED or not config.VAPID_PRIVATE_KEY or not config.VAPID_SUBJECT:
        raise RuntimeError("Push is off (PUSH_ENABLED, VAPID_PRIVATE_KEY, VAPID_SUBJECT).")
    payload = PushMessage(title=title, body=body, url=url, tag=tag).payload()
    key = load_private_key(config.VAPID_PRIVATE_KEY)
    result = await session.exec(select(PushSubscription).where(col(PushSubscription.user_id) == user_id))
    outcome = PushResult()
    gone: list[int] = []
    for subscription in result.all():
        if endpoint_problem(subscription.endpoint) is not None:
            # Stored before PUSH_ALLOWED_HOSTS changed: never sent to.
            outcome.failed += 1
            continue
        try:
            message = encrypt(payload, subscription.p256dh, subscription.auth)
        except ValueError:
            # Keys no browser could have made; it can't ever be sent to.
            assert subscription.id is not None
            gone.append(subscription.id)
            continue
        authorization = vapid_authorization(subscription.endpoint, key, config.VAPID_SUBJECT)
        status = await asyncio.to_thread(deliver, subscription.endpoint, message, authorization, ttl)
        if 200 <= status < 300:
            outcome.sent += 1
        elif status in (404, 410):
            assert subscription.id is not None
            gone.append(subscription.id)
        else:
            logger.warning("push: %s answered %s", urlsplit(subscription.endpoint).hostname, status)
            outcome.failed += 1
    if gone:
        await session.exec(delete(PushSubscription).where(col(PushSubscription.id).in_(gone)))
        await session.commit()
        outcome.removed = len(gone)
    return outcome
