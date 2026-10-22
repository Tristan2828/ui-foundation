"""TOTP (RFC 6238) and recovery codes for the sign-in's second step.
Stdlib only: hmac, hashlib, base64, secrets and the clock, so any
authenticator app works with it.

Codes are 6 digits on a 30-second step, HMAC-SHA1 (what authenticator apps
assume), with one step of drift allowed either way. A step already used is
refused, so a code can't be replayed: the caller stores the step `verify`
returns as the user's `totp_last_step`.
"""

import base64
import hashlib
import hmac
import re
import secrets
import struct
import time
from urllib.parse import quote, urlencode

STEP_SECONDS = 30
DIGITS = 6
DRIFT_STEPS = 1
RECOVERY_CODE_COUNT = 10

_CODE = re.compile(r"^\d{6}$")


def generate_secret() -> str:
    """160 random bits (RFC 4226's recommended length), base32 without padding."""
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")


def _key(secret: str) -> bytes:
    cleaned = secret.replace(" ", "").upper()
    return base64.b32decode(cleaned + "=" * (-len(cleaned) % 8))


def hotp(key: bytes, counter: int, digits: int = DIGITS, digest: str = "sha1") -> str:
    """RFC 4226: the code for one counter value."""
    mac = hmac.new(key, struct.pack(">Q", counter), digest).digest()
    offset = mac[-1] & 0x0F
    value = struct.unpack(">I", mac[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(value % 10**digits).zfill(digits)


def current_step(now: float | None = None) -> int:
    return int((time.time() if now is None else now) // STEP_SECONDS)


def is_totp_code(code: str) -> bool:
    return _CODE.match(code.strip()) is not None


def verify(secret: str, code: str, last_step: int | None, now: float | None = None) -> int | None:
    """The step `code` is right for, within one step of now and after
    `last_step`; None if there's none."""
    code = code.strip()
    if not is_totp_code(code):
        return None
    key = _key(secret)
    step = current_step(now)
    for candidate in range(step - DRIFT_STEPS, step + DRIFT_STEPS + 1):
        if last_step is not None and candidate <= last_step:
            continue
        if hmac.compare_digest(hotp(key, candidate), code):
            return candidate
    return None


def otpauth_uri(secret: str, account: str, issuer: str) -> str:
    """What an authenticator app scans or is given: otpauth://totp/..."""
    label = quote(f"{issuer}:{account}")
    query = urlencode({"secret": secret, "issuer": issuer, "algorithm": "SHA1", "digits": DIGITS, "period": STEP_SECONDS})
    return f"otpauth://totp/{label}?{query}"


def generate_recovery_codes() -> list[str]:
    """Ten one-time codes like `k7q2-m9xd`, about 40 random bits each."""
    alphabet = "abcdefghjkmnpqrstuvwxyz23456789"
    codes = []
    for _ in range(RECOVERY_CODE_COUNT):
        raw = "".join(secrets.choice(alphabet) for _ in range(8))
        codes.append(f"{raw[:4]}-{raw[4:]}")
    return codes


def hash_recovery_code(code: str) -> str:
    """sha256 of the code as typed, ignoring case, spaces and dashes."""
    normalized = re.sub(r"[\s-]", "", code).lower()
    return hashlib.sha256(normalized.encode()).hexdigest()
