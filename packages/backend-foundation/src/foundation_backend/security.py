"""Password hashing and session-token helpers. Stdlib only (hashlib,
hmac, secrets) — session cookies were chosen specifically because they
need no new dependency.
"""

import hashlib
import hmac
import secrets

# scrypt, OWASP's choice when Argon2id isn't available (the stdlib has no
# Argon2). N=2^15, r=8, p=3 is one of its equivalent settings: 32 MiB per
# hash rather than N=2^17's 128 MiB, so a small server signing several
# people in at once isn't short of memory. Stored as
# `scrypt$<n>$<r>$<p>$<salt hex>$<digest hex>`.
_ALGORITHM = "scrypt"
_N = 2**15
_R = 8
_P = 3
# hashlib refuses at 32 MiB by default, which N=2^15, r=8 needs exactly.
_MAXMEM = 64 * 1024 * 1024
# Other parameters still verify (needs_rehash replaces them), up to this.
_MAX_P = 16

# Hashes from before 4.122: PBKDF2-HMAC-SHA256,
# `pbkdf2_sha256$<iterations>$<salt hex>$<digest hex>`. Still verified, and
# replaced with scrypt on the account's next successful sign-in
# (needs_rehash).
_LEGACY_PBKDF2 = "pbkdf2_sha256"

# A well-formed hash no password matches. Login checks against it when the
# email has no account, so that answer costs the same full scrypt run as a
# wrong password and its timing doesn't say which emails exist.
DUMMY_PASSWORD_HASH = (
    f"{_ALGORITHM}${_N}${_R}${_P}$40b42b46be4bb823c7e8bf0414344205$"
    "45e0d6d8cca1cdf4f76a7b44e2f7b5a27a00dc5457577d21ebb8203df8e5057f"
)


def _scrypt(password: str, salt: bytes, n: int, r: int, p: int) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=n, r=r, p=p, maxmem=_MAXMEM, dklen=32)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = _scrypt(password, bytes.fromhex(salt), _N, _R, _P)
    return f"{_ALGORITHM}${_N}${_R}${_P}${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """True when `password` matches `stored`, a scrypt hash or a legacy
    PBKDF2 one. Anything malformed is a mismatch, never an error."""
    parts = stored.split("$")
    try:
        if parts[0] == _ALGORITHM and len(parts) == 6:
            n, r, p = (int(part) for part in parts[1:4])
            if p > _MAX_P:
                # Memory is capped by maxmem (hashlib refuses past it), the
                # parallel passes here: a stored hash can't ask for an
                # unbounded amount of work.
                return False
            digest = _scrypt(password, bytes.fromhex(parts[4]), n, r, p)
            return hmac.compare_digest(digest.hex(), parts[5])
        if parts[0] == _LEGACY_PBKDF2 and len(parts) == 4:
            digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(parts[2]), int(parts[1]))
            return hmac.compare_digest(digest.hex(), parts[3])
    except ValueError:
        return False
    return False


def needs_rehash(stored: str) -> bool:
    """Whether a hash that just verified should be replaced with
    hash_password's: any PBKDF2 hash, or scrypt with other parameters."""
    return not stored.startswith(f"{_ALGORITHM}${_N}${_R}${_P}$")


def generate_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
