# Create an App

Instructions for **any AI coding tool, or a person**, to stand up a new app
on the foundation, ready for its first entity plan and nothing more. Point
your tool at this file:

> Create a new app called `game-list` in `C:\Projects` following
> https://github.com/Tristan2828/ui-foundation/blob/main/docs/create-an-app.md

The steps run one script, `scripts/create-app.sh`. It copies the template
at a release tag and installs `@tristan2828/ui-foundation` at the same
version. Every release runs that same script against itself, so this path
is known to work at every tag.

## Before you start

- **You need:** Node.js 22+ and npm, git with `user.name`/`user.email` set,
  curl and tar. On Windows, run everything in **Git Bash**.
- **From the developer:** the app's name (kebab-case: `game-list`) and the
  folder to create it in. Ask if either is missing; don't pick them.
- **The foundation version:** the tag the developer gives you, otherwise
  the latest release
  (https://github.com/Tristan2828/ui-foundation/releases/latest). Always a
  tag (`v3.0.0` or later), never `main`.

## Steps

**Steps 2 and 3 each take several minutes** (npm install, a production
build, a browser test run). Run them in the foreground and wait for them
to finish. If your tool times out or backgrounds long commands, give these
a longer timeout (15 minutes) instead: every later step depends on them,
and ending your turn while one is still running leaves a half-built app.

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
   It copies `template/` at that tag into `./<app-name>`, names the app,
   pins the package at that version, runs `npm install`, confirms the
   synced conventions match the package, and makes the first commit. It
   stops at the first error. Report that error rather than working around
   it.
3. **Prove it works:** `cd <app-name> && npm run verify`. It must pass:
   codegen, conventions, contract, types, lint, unit tests and every
   Playwright test, run against the included Widgets demo. If Playwright
   reports missing browsers, run `npx playwright install chromium` once and
   retry. Also make sure nothing else is serving on port 4173, or
   Playwright tests that instead.
4. **Stop and report:** the app's path, the tag, and that `verify` passed.
   `npm run dev` shows the Widgets demo on mock data.

Don't build entities, delete the Widgets demo, create a GitHub repository
or set up the backend unless the developer asks. Each is its own step.

## What's next (for the developer)

**Plan the first entity** in `docs/entities/<entity>.md` (template:
`docs/foundation/entity-plan-template.md`), or ask your AI tool to plan it
with you. Then build it with `docs/foundation/add-an-entity.md`. Upgrading
the foundation later, changing it, choosing Postgres or the Notion API and
the backend are all in [`consuming.md`](consuming.md).
