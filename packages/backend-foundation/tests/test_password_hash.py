"""Password hashes (foundation_backend.security): scrypt for new hashes,
PBKDF2 ones from before 4.122 still verified, and anything malformed a
mismatch rather than an error."""

import hashlib
import secrets

from foundation_backend import security
from foundation_backend.security import hash_password, needs_rehash, verify_password


def pbkdf2_hash(password: str, iterations: int = 1) -> str:
    """A hash as 4.121 and earlier wrote it (fewer iterations, for speed)."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), iterations)
    return f"pbkdf2_sha256${iterations}${salt}${digest.hex()}"


def test_a_new_hash_is_scrypt_at_the_current_settings() -> None:
    stored = hash_password("correct-horse-battery")
    algorithm, n, r, p, salt, digest = stored.split("$")
    assert (algorithm, n, r, p) == ("scrypt", "32768", "8", "3")
    assert len(salt) == 32 and len(digest) == 64
    assert not needs_rehash(stored)


def test_scrypt_verifies_the_password_and_refuses_another() -> None:
    stored = hash_password("correct-horse-battery")
    assert verify_password("correct-horse-battery", stored)
    assert not verify_password("correct-horse-batterz", stored)


def test_two_hashes_of_one_password_differ() -> None:
    assert hash_password("same") != hash_password("same")


def test_a_pbkdf2_hash_still_verifies_and_asks_for_a_rehash() -> None:
    stored = pbkdf2_hash("correct-horse-battery")
    assert verify_password("correct-horse-battery", stored)
    assert not verify_password("wrong-password", stored)
    assert needs_rehash(stored)


def test_scrypt_at_other_settings_verifies_and_asks_for_a_rehash() -> None:
    # A later release may change the settings; hashes written before it
    # must still sign people in.
    salt = secrets.token_hex(16)
    digest = hashlib.scrypt(b"pw", salt=bytes.fromhex(salt), n=2**14, r=8, p=1, dklen=32)
    stored = f"scrypt${2**14}$8$1${salt}${digest.hex()}"
    assert verify_password("pw", stored)
    assert needs_rehash(stored)


def test_a_stored_hash_cannot_ask_for_unbounded_work() -> None:
    salt = secrets.token_hex(16)
    assert not verify_password("pw", f"scrypt${2**15}$8$1000${salt}${'0' * 64}")
    # Past maxmem, hashlib refuses: a mismatch, not an error.
    assert not verify_password("pw", f"scrypt${2**24}$8$1${salt}${'0' * 64}")


def test_malformed_hashes_are_mismatches() -> None:
    for stored in ["", "unused", "scrypt$1$2$3", "pbkdf2_sha256$x$y$z", "md5$abc", "scrypt$a$b$c$d$e", "scrypt$32768$8$3$zz$00"]:
        assert not verify_password("pw", stored), stored


def test_the_dummy_hash_is_current_so_a_missing_account_costs_the_same() -> None:
    assert not needs_rehash(security.DUMMY_PASSWORD_HASH)
    assert not verify_password("anything", security.DUMMY_PASSWORD_HASH)
