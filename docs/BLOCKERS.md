# Blockers

Open items that couldn't be resolved within a session's scope, or that
need a decision or an action only the developer can take
([`OPERATOR.md`](OPERATOR.md)). An item is removed once it's resolved: this
file is a queue, not a log.

This is the only place a question for the developer goes, never a PR
(`AGENTS.md` "Scope and stopping").

## Open

- **The picture uploads reference has not run against Postgres here**
  (4.149.0). Went ahead without it: the machine that built it has no
  Docker, so `template/scripts/check-backend-postgres.sh` (which now
  uploads a picture and reads it back byte for byte, the `bytea` column
  through asyncpg) has not run. CI's `verify-backend` migrates a real
  Postgres to `0018` and checks every new table and column has a
  comment. Blocked: needs someone with Docker to run
  `template/scripts/check-backend-postgres.sh` once; remove this item
  when it passes.

- **Print Notes on a real phone** ([#364](https://github.com/Tristan2828/ui-foundation/pull/364), 4.124.1).
  Blocked: needs someone to try Print Notes on Android Chrome and iOS
  Safari. The fix, which ignores an `afterprint` that fires early when
  `print()` returns in under a second, was worked out from the reported
  behaviour and the code. No real device has run it. If it still prints the
  whole page there, the next step is the `focus`/`visibilitychange` signals
  the fix left out.

- **Ctrl/Cmd+S saves now in every autosaving value** (4.152, the Quick
  Jot plan's open decision 6). Went ahead with it for every app: in an
  autosaving or always-editable value, Ctrl/Cmd+S saves at once, stays
  open, and the browser's Save Page dialog never opens. Leaving the key
  to the browser instead would mean a value that saves itself shows the
  dialog to anyone who presses it by habit.
- **Leading spaces are trimmed on save in every app** (4.152, open
  decision 7). Went ahead with it: spaces at a paragraph's or heading's
  start (and a line's after a hard break) are not saved, as trailing
  ones already weren't; an indent typed shows until the note is next
  opened. Keeping them would mean writing `&#x20;` (what was saved
  before) or a form that reads back as a code block.
- **`autoFocus="end"` on a note ending in a folded section** (4.152). Went
  ahead with the caret at the end of that section's heading, the section
  left folded (typing goes into the heading). Opening the section and
  putting the caret after its last words instead would mean every open
  of such a note unfolds it, on every device that shares the fold.
- **Focusing an editor again is a `focusKey` prop** (4.152, asked for by
  the Quick Jot app). Went ahead with a prop the app bumps as a tab comes
  to the front, not a ref handle: it needs no forwarded ref through
  RichTextEditor's lazy load. A handle (`ref.current.focus()`) instead
  would mean a `ref` prop on RichTextEditor and the editor's view reached
  through it.
