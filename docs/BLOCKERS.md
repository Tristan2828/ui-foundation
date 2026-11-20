# Blockers

Open items that couldn't be resolved within a session's scope, or that
need a decision or an action only the developer can take
([`OPERATOR.md`](OPERATOR.md)). An item is removed once it's resolved: this
file is a queue, not a log.

## Open

These were first raised in PR descriptions, which the developer doesn't
read. Each is still open as of 2026-11-20: nothing later answered or
replaced it.

- **Print Notes on a real phone** ([#364](https://github.com/Tristan2828/ui-foundation/pull/364), 4.124.1).
  Blocked: needs someone to try Print Notes on Android Chrome and iOS
  Safari. The fix, which ignores an `afterprint` that fires early when
  `print()` returns in under a second, was worked out from the reported
  behaviour and the code. No real device has run it. If it still prints the
  whole page there, the next step is the `focus`/`visibilitychange` signals
  the fix left out.
- **Backend runtime dependencies are exact pins** ([#202](https://github.com/Tristan2828/ui-foundation/pull/202), [#359](https://github.com/Tristan2828/ui-foundation/pull/359)).
  Went ahead with `==` pins in `packages/backend-foundation/pyproject.toml`
  (`fastapi`, `sqlmodel[asyncio]`, `pydantic`, `python-dotenv`,
  `email-validator`, `python-dateutil`). An app has to move the same pins in
  the same change as each backend upgrade (4.121.0 was the first release to
  need it), or pip refuses to install. Ranges instead (e.g. `>=0.163,<0.164`)
  would let an app take a dependency patch on its own, but a release would
  no longer pin exactly what CI tested.
- **`Recurrence.rule`'s WKST pattern stayed additive** ([#353](https://github.com/Tristan2828/ui-foundation/pull/353), 4.119.0).
  Went ahead with `x-earlier-patterns` in `openapi/foundation.yaml`, so
  `check-contract` still accepts an app's copy with the old pattern. An app
  on the 4.95 copy upgrades without touching its spec, but its own spec and
  mocks still refuse WKST until it copies the new schema. A plain major
  (5.0) instead would drop `x-earlier-patterns` and its `check-contract`
  fallback, and every app copying `Recurrence` would update its spec when
  it upgrades.
- **The gateway doesn't follow redirects by default** ([#345](https://github.com/Tristan2828/ui-foundation/pull/345), 4.107.0).
  Went ahead with `redirect: "manual"` as the default, so a proxy's 302 to
  its login page (Cloudflare Access) reads as `proxy_auth` rather than
  "Connection problem". A module whose endpoint really redirects has to pass
  `redirect: "follow"`. Following by default instead would keep same-origin
  redirects working with no opt-in, and a proxy's sign-in prompt would show
  up as a connection error again.
- **Density uses Tailwind's own scale variables** ([#118](https://github.com/Tristan2828/ui-foundation/pull/118), 3.28.0).
  Went ahead with one factor for spacing and one per text step: about 10
  lines of diff against shadcn's files, and it reaches the app's own
  classes too. A named token per size (`--control-height-sm`,
  `--icon-size`, …) instead would let each part be tuned on its own. It
  would also mean rewriting hundreds of classes across ~25 files, re-patching
  them on every `shadcn add` update, and the app's own classes wouldn't
  follow.
- **`EqualItem` content placement and `wide`** ([#325](https://github.com/Tristan2828/ui-foundation/pull/325)).
  Decided in a session while the developer was away. Went ahead with an
  item's content after its fields (both shown), and `wide` as an opt-in on
  each item, so a short note stays in its card and the reading order never
  changes. Making it automatic for any item with content would give long
  content the full row with no prop, but short notes would stretch the grid
  and the layout would shift as content arrives.
- **An inline rich-text field stays editable while it autosaves** ([#189](https://github.com/Tristan2828/ui-foundation/pull/189)).
  Went ahead with this reading of the issue: typing carries on during a
  save, and saves queue on the latest draft. If the issue meant the text
  should be read-only while a save is in flight, that's a separate change,
  and it would block typing about once a second while autosave runs.
- **A template e2e race was left unfixed** ([#368](https://github.com/Tristan2828/ui-foundation/pull/368)).
  Went ahead without fixing it. `template/e2e/widget-view.spec.ts`, "quick
  action: In stock flips on the page and saves", reads the mock store
  (`serverWidget`) as soon as the PATCH is *sent*, so under load it can run
  before the handler saves, and it once failed on mobile-chrome. The fix is
  a one-line `expect.poll` on `serverWidget`, or waiting for the PATCH
  response. Until then it can fail the template gate now and then.
