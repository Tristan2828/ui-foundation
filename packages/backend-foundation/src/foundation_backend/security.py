"""Password hashing and session-token helpers. Stdlib only (hashlib,
hmac, secrets) — session cookies were chosen specifically because they
need no new dependency.
"""

import hashlib
import hmac
import secrets

_ALGORITHM = "pbkdf2_sha256"
_ITERATIONS = 600_000

# A well-formed hash no password matches. Login checks against it when the
# email has no account, so that answer costs the same full PBKDF2 run as a
# wrong password and its timing doesn't say which emails exist.
DUMMY_PASSWORD_HASH = (
    f"{_ALGORITHM}${_ITERATIONS}$40b42b46be4bb823c7e8bf0414344205$"
    "45e0d6d8cca1cdf4f76a7b44e2f7b5a27a00dc5457577d21ebb8203df8e5057f"
)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), _ITERATIONS)
    return f"{_ALGORITHM}${_ITERATIONS}${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, iterations_s, salt, digest_hex = stored.split("$")
    except ValueError:
        return False
    if algorithm != _ALGORITHM:
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(iterations_s))
    return hmac.compare_digest(digest.hex(), digest_hex)


def generate_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
