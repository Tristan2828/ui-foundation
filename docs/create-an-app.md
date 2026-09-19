# Create an App

Instructions for **any AI coding tool, or a person**, to stand up a new app
on the ui-foundation registry — ready for its first entity plan, nothing
more. Point your tool at this file:

> Create a new app called `game-list` in `C:\Projects` following
> https://github.com/Tristan2828/ui-foundation/blob/main/docs/create-an-app.md

The steps run one script, `scripts/create-app.sh`; every foundation release
tests that same script (`scripts/consume-test.sh`), so this path is known to
work at every tag.

## Before you start

- **You need:** Node.js 22+ and npm, git with `user.name`/`user.email` set,
  and curl. On Windows, run everything in **Git Bash**.
- **From the developer:** the app's name (kebab-case: `game-list`) and the
  folder to create it in. Ask if either is missing — don't pick them.
- **The foundation version:** the tag the developer gives you; otherwise
  the latest, from `CHANGELOG.md` or the README's "Consuming this as a
  registry" section. Always a tag, never `main`.

## Steps

**Steps 2 and 4 each take several minutes** (npm installs, a production
build, a browser test run). Run them in the foreground and wait for them to
finish. If your tool times out or backgrounds long commands, give these a
longer timeout (15 minutes) instead — every later step depends on them, and
ending your turn while one is still running leaves a half-built app.

1. **Download the script at that tag** into the parent folder (it creates
   `./<app-name>` next to itself):
   ```bash
   curl -fsSL --retry 4 --retry-all-errors https://raw.githubusercontent.com/Tristan2828/ui-foundation/<tag>/scripts/create-app.sh -o create-app.sh
   ```
2. **Run it, then delete it:**
   ```bash
   bash create-app.sh <app-name> <tag>
   rm create-app.sh
   ```
   It scaffolds Vite + React + TypeScript, adds Tailwind and the `@` alias,
   runs `shadcn init` and installs the foundation (`starter#<tag>`),
   generates the MSW mock service worker, and makes the first commit. It
   stops at the first error — report that error rather than working around
   it.
3. **Finish the setup inside the app** (`cd <app-name>`): do **Step 0 of
   the app's own `docs/add-an-entity.md`** (the bootstrap — it adds the
   `gen:api`, `verify:fast` and `verify` npm scripts the registry can't).
   Only Step 0; the rest of that file is for adding an entity later.
4. **Prove it works:** `npm run verify`. It must pass — types, lint, unit
   tests and every Playwright test, run against the included Widgets demo.
   If Playwright reports missing browsers, run `npx playwright install
   chromium` once and retry. Also make sure nothing else is serving on
   ports 4173 or 6006 (Playwright would test that instead).
5. **Commit:** `git add -A && git commit -m "Bootstrap npm scripts (add-an-entity Step 0)"`.
6. **Stop and report:** the app's path, the tag installed, and that
   `verify` passed. `npm run dev` shows the Widgets demo on mock data.

Don't build entities, delete the Widgets demo, create a GitHub repository
or add a backend unless the developer asks — each is its own step.

## What's next (for the developer)

The app is ready for step 2: **plan the first entity** in
`docs/entities/<entity>.md` (template: `docs/entities/_template.md`), or
ask your AI tool to plan it with you. Then build it with the app's
`docs/add-an-entity.md`. Everything after that — owning the files, taking
later releases, choosing Postgres or the Notion API, adding the backend —
is in [`consuming.md`](consuming.md).
