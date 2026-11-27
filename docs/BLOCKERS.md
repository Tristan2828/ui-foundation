# Blockers

Open items that couldn't be resolved within a session's scope, or that
need a decision or an action only the developer can take
([`OPERATOR.md`](OPERATOR.md)). An item is removed once it's resolved: this
file is a queue, not a log.

This is the only place a question for the developer goes, never a PR
(`AGENTS.md` "Scope and stopping").

## Open

- **Quick Jot on the home server** (the app at `C:\Repos\quick-jot`).
  Blocked: needs the developer, in this order. Nothing here can build an
  image, push, or reach the server.
  1. Create `Tristan2828/quick-jot` on GitHub, add it as `origin`, run
     `git remote set-head origin --auto`, and push `main`.
  2. Where Docker runs: `gh auth refresh -s write:packages`, then
     `npm run publish:image`.
  3. Make the GHCR package `quick-jot` public, or give the server pull
     access.
  4. In Homebase, review the local branch `claude/quick-jot-database`
     (commit `e9e13f3f`, worktree
     `C:\Repos\homebase\.claude\worktrees\quick-jot-db`, not pushed): the
     `quick_jot` database and role beside every `palm_datebook` line in
     `deploy/home-lab/`. Push it, merge it through a PR, then copy the
     home-lab files to the server (`docs/home-lab.md` "Add an app's
     database" step 1).
  5. Add `QUICK_JOT_DB_PASSWORD` to the home-lab `.env`, then
     `docker compose up -d --build` and run `10-create-databases.sh`
     (step 2). Check the walls (step 3).
  6. Create the Cloudflare tunnel `quick-jot` and a public hostname
     pointing to `http://quick-jot:8000`.
  7. In Compose Manager, create the stack `quick-jot` from
     `deploy/unraid/compose.yml`, and its `.env` from `.env.example`:
     `DATABASE_URL` with the password, the seed email and a real
     password, the tunnel token, and optionally the GlitchTip DSN.
  8. Compose Up and wait for healthy. Check
     `https://<host>/build-info.json` (`api: real`, `schema: 0020`).
  9. Paste `deploy/unraid/update-quick-jot.sh` as the `quick-jot-update`
     User Script.
  10. Run a backup, then `restore-drill quick_jot`. Re-paste the four
      home-lab User Scripts and run `home-lab-status`; it should end
      `STATUS OK`.
  11. Smoke test on a phone.
  12. Turn on TOTP: `docker exec -it quick_jot-quick-jot-1 sh -c 'cd
      backend && python -m foundation_backend.scripts.enable_totp
      <email>'`.
  13. Install and pin the app (the app's README "Install").
- **Quick Jot's backend has not run on Postgres.** Blocked: needs the
  app's `scripts/check-backend-postgres.sh` run where Docker is (the
  machine that built it has none). It was rewritten for notes and
  pictures with no sign-up (a second account written to the database, a
  note's byte-for-byte body, rename, the 409, search by name, delete and
  restore, an upload read back, another account's 404) and has never
  run. Its migrations 0018 (drop widgets), 0019 (notes) and 0020
  (pictures) ran on SQLite stand-ins and as offline SQL only.
- **Quick Jot, checks only a person can make.** Blocked: needs the
  developer, once it's installed (nothing here can install a PWA or
  drive a real phone):
  - Edge and Chrome offer to install, and the icon looks right in the
    window, the taskbar, the Start menu and Alt+Tab (the manifest has an
    SVG, a 192 px, a 512 px and a maskable icon); the maskable one on an
    Android launcher.
  - In the installed window, Ctrl+T, Ctrl+W, Ctrl+Tab and
    Ctrl+PageDown/PageUp reach the app (new, close, switch) rather than
    doing nothing. Alt+N, Alt+W and Alt+PageDown/PageUp always do.
  - The Start-menu shortcut's Shortcut key opens the app.
  - On a real phone: the editor's bottom bar rides above the keyboard
    and doesn't cover the text being typed; its buttons are big enough;
    Hide Keyboard works.
  - A real Ctrl+F over a folded toggle section (it isn't found: see
    `DEFERRED.md` "Find in page doesn't see folded text").
- **Quick Jot's own decisions** (from its plan; the app is its own repo,
  so they're recorded here). Went ahead with each:
  - Name and folder `quick-jot` in `C:\Repos`. Renaming means the
    folder, `package.json`, `pwa()`, the tab storage key, the image and
    the database.
  - A tab's given name is the note's, not the device's: it shows on
    every device and in All Notes, and search finds it. Names per device
    instead would mean no field and no search by name.
  - No sign-up page, and public sign-up removed from its backend.
  - AI chats (MCP) off in its stack. Turning them on is
    `MCP_ENABLED "true"` and `MCP_PUBLIC_URL` in
    `deploy/unraid/compose.yml`.
  - Closing an empty note (no words, no name) deletes it, soft, with no
    toast.
  - Blank lines typed for spacing are not kept (`DEFERRED.md`); tabs
    stay app code until a second app wants a strip of open records.
  - Its phone checks run at 393 px; Pixel 7's own 412 px would be a
    slightly less strict check.

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

- **Ctrl/Cmd+S saves now in every autosaving value** (4.152, found by
  Quick Jot). Went ahead with it for every app: in an
  autosaving or always-editable value, Ctrl/Cmd+S saves at once, stays
  open, and the browser's Save Page dialog never opens. Leaving the key
  to the browser instead would mean a value that saves itself shows the
  dialog to anyone who presses it by habit.
- **Leading spaces are trimmed on save in every app** (4.152, found by
  Quick Jot). Went ahead with it: spaces at a paragraph's or heading's
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
