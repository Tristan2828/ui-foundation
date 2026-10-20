# Blockers

Open items that couldn't be resolved within a session's scope, or that
need a decision or an action only the developer can take
([`OPERATOR.md`](OPERATOR.md)). An item is removed once it's resolved: this
file is a queue, not a log.

## Open

### #167 (reminders through Web Push) needs a crypto dependency in the reference backend

**What's needed.** Web Push needs two pieces of cryptography that Python's
standard library doesn't have:

- **VAPID** (RFC 8292): every push request carries a JWT signed with
  ES256, which is ECDSA on P-256, using the app's VAPID private key.
  `hmac`/`hashlib` only do symmetric signatures.
- **Payload encryption** (RFC 8291, `aes128gcm`): each message is
  encrypted to the browser's subscription key. That's ECDH on P-256, then
  HKDF-SHA-256 (fine in `hmac`), then AES-128-GCM. The stdlib has neither
  elliptic curves nor AES (`ssl` uses them inside TLS, but exposes neither).

A push with no payload would skip the encryption, but not VAPID. So no
version of #167's backend half is stdlib-only. The backend has been
stdlib-only for its security code so far, by choice: session cookies,
TOTP, the OAuth 2.1 server and MCP (#132) all use `hashlib`, `hmac` and
`secrets`. So this is the first time that changes.

**Options** (resolved with `pip install --dry-run` on 2026-10-19, Python
3.11):

| Option | Adds to the backend's install | For | Against |
|---|---|---|---|
| **A. `cryptography==50.0.2` only (recommended)** | 3 packages: `cryptography`, `cffi`, `pycparser` | PyCA's library, the one everything else here builds on (`pywebpush` and `py-vapid` both use it). Binary wheels for Linux, macOS and Windows, so no compiler at deploy. Typed, so mypy strict holds. We'd write the VAPID JWT and RFC 8291's encryption ourselves on its primitives (`ec`, `ECDH`, `HKDF`, `AESGCM`), about 120 lines, tested against RFC 8291 Appendix A's worked example byte for byte. Sending stays on the stdlib (`urllib.request` in `asyncio.to_thread`), as error reporting's Sentry send already does | We own ~120 lines of protocol code, though every primitive in it is the library's and the RFC's test vector pins it |
| B. `pywebpush==2.5.0` | 20 packages: `cryptography`, `py-vapid`, `http_ece`, plus `requests` *and* `aiohttp` with their trees (`urllib3`, `yarl`, `multidict`, `frozenlist`, …) | No protocol code of our own | Two HTTP clients the backend doesn't use, and a far larger surface to audit and keep current. `py-vapid` and `http_ece` are small single-maintainer packages that would hold the app's VAPID key |
| C. Stdlib only | nothing | No new dependency | Means writing P-256 and AES-GCM in pure Python: not constant-time, not reviewed. Ruled out |

**Also worth deciding now, on the npm side** (smaller). #167 asks for
icons "generated from the app's name and theme tokens". iOS's Home Screen
icon (`apple-touch-icon`) must be a PNG, and drawing the app's initial
into a PNG needs a font rasterizer (`sharp` or `@resvg/resvg-js`), which
isn't on either allowlist. Without one, the Vite plugin can write an SVG
icon (enough for Chrome and Android) plus a plain PNG in the theme's
colour, with no letter, drawn with `node:zlib`. Or the app supplies its
own PNG. My suggestion is the plain PNG plus an `icon` option for an
app's own, with no new npm dependency.

**What I did:** nothing on #167. No code, no dependency added.
#163–#166 shipped without it, as 4.16.0 (`feat/timed-screens`).

**To unblock:** pick A or B (or another), and say whether the dependency
goes in the template's `backend/pyproject.toml` for every new app, or
only when an app turns push on (an optional extra, `.[push]`). Then #167
can be built as planned, its push half behind a config switch like
`JOBS_ENABLED`. If A, `docs/DEFERRED.md`'s row on enforcing a backend
allowlist becomes more pressing, and could ship with it.
