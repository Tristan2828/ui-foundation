# Blockers

Open items that couldn't be resolved within a session's scope, or that
need a decision or an action only the developer can take
([`OPERATOR.md`](OPERATOR.md)). An item is removed once it's resolved: this
file is a queue, not a log.

This is the only place a question for the developer goes, never a PR
(`AGENTS.md` "Scope and stopping").

## Open

- **`install-test` fails on every PR since 2026-11-24, from a fresh install**
  (seen on [#435](https://github.com/Tristan2828/ui-foundation/pull/435)).
  Blocked: needs a fix in its own PR. The created app's
  `e2e/widget-edit-in-place.spec.ts` "long text: the floating toolbar is
  part of the field; Esc hides it before saving" saves the bold-italic on
  the wrong words (`bu***ttons` for `***basic***`), every retry. It isn't
  #435's change: re-running 4.142.1's own passing run (the
  `fix/job-schedule-restart` commit) fails the same test now. The repo's
  lockfile and the harness pass, and so does `consume-test.sh
  --install-only` on Windows, so it's a Linux CI run with dependencies
  resolved fresh. Suspect: `prosemirror-view` 1.44.0, published that day
  (the lockfile has 1.43.0); not confirmed.

- **Print Notes on a real phone** ([#364](https://github.com/Tristan2828/ui-foundation/pull/364), 4.124.1).
  Blocked: needs someone to try Print Notes on Android Chrome and iOS
  Safari. The fix, which ignores an `afterprint` that fires early when
  `print()` returns in under a second, was worked out from the reported
  behaviour and the code. No real device has run it. If it still prints the
  whole page there, the next step is the `focus`/`visibilitychange` signals
  the fix left out.
