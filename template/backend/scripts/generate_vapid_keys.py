"""Make the app's VAPID key pair for Web Push (docs/deploy.md "Reminders
(Web Push)").

    cd backend && .venv/Scripts/python scripts/generate_vapid_keys.py

Prints VAPID_PRIVATE_KEY for the backend's environment (a secret: never in
the repo) and its public half, which the backend serves the browser itself
(GET /api/push/public-key). Make it once per deployment and keep it: every
device subscribes with the public half, so a new key stops every device's
reminders until each allows them again. Needs the push extra.
"""

from app import push


def main() -> None:
    key = push.generate_private_key()
    print(f"VAPID_PRIVATE_KEY={push.private_key_b64(key)}")
    print(f"# public key (served at /api/push/public-key): {push.b64url_encode(push.public_key_bytes(key))}")


if __name__ == "__main__":
    main()
