# Blockers

Open items that couldn't be resolved within a session's scope, or that
need a decision or an action only the developer can take
([`OPERATOR.md`](OPERATOR.md)). An item is removed once it's resolved: this
file is a queue, not a log.

## Open

### Web Push needs a crypto library (#167)

**What:** #167 (an installable app, Web Push from the reference backend,
reminders sent by the scheduled-jobs runner) can't be built under the
backend's current dependencies.

**Why:** a Web Push message has to be encrypted for the browser's
subscription (RFC 8291: ECDH on P-256, HKDF, AES-128-GCM) and signed for the
push service (VAPID, RFC 8292: an ES256 JWT). Python's standard library has
none of P-256, ECDSA or AES-GCM, and `template/backend/pyproject.toml` pins
no library that does. The backend's other features (TOTP, MCP, error
reports) were kept stdlib-only by decision (#132), so adding one is the
developer's call, not an agent's.

**What was tried:** checked the pinned dependencies and the installed
environment for `cryptography`, `pywebpush`, `py-vapid`, `ecdsa` or a JWT
library: none. Hand-rolling P-256 and AES-GCM in Python was ruled out (a
crypto implementation with no audit, in every app's backend).

**Options for the developer:**

| Option | Adds | Tradeoff |
|---|---|---|
| `pywebpush` (pulls in `cryptography`, `py-vapid`, `http-ece`, `requests`) | 4+ packages | Least code here; most dependencies, and `requests` alongside `httpx` |
| `cryptography` only, with the RFC 8291/8292 framing written here (~150 lines) | 1 package, widely audited, wheels for every platform | More code to own, but only the framing: no hand-rolled primitives |
| Push stays out of the foundation | nothing | Reminders stay blocked for every app until one needs it badly enough to decide |

Recommended: `cryptography` only. The PWA half (manifest, a push-only
service worker, `usePushPermission`) needs no new dependency and can ship
first once the backend half is decided, so the two land as one feature.
