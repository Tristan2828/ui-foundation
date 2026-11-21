# Blockers

Open items that couldn't be resolved within a session's scope, or that
need a decision or an action only the developer can take
([`OPERATOR.md`](OPERATOR.md)). An item is removed once it's resolved: this
file is a queue, not a log.

This is the only place a question for the developer goes, never a PR
(`AGENTS.md` "Scope and stopping").

## Open

- **Print Notes on a real phone** ([#364](https://github.com/Tristan2828/ui-foundation/pull/364), 4.124.1).
  Blocked: needs someone to try Print Notes on Android Chrome and iOS
  Safari. The fix, which ignores an `afterprint` that fires early when
  `print()` returns in under a second, was worked out from the reported
  behaviour and the code. No real device has run it. If it still prints the
  whole page there, the next step is the `focus`/`visibilitychange` signals
  the fix left out.
