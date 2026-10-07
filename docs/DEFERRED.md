# Direction and Deferred

The developer's standing decisions about what gets built, and the queue of
what is left. When another doc disagrees with this one, this one wins, and
the other doc is updated to match. Out-of-scope ideas land here, never in
code. A row is **removed when it ships**: this is a queue, not a log (git
history has every removed row).

## Direction

- **Shared code, not a starter kit** (decided 2026-09-28, shipped as 3.0).
  The foundation-owned layer is the npm package
  `@tristan2828/ui-foundation`, and apps upgrade by bumping its version. The
  template is copied once, and what it copies is the app's own
  ([`ARCHITECTURE.md`](ARCHITECTURE.md) "Why shared code"). Generic changes
  found in an app are raised here and released, not kept as local variants.
  That is the path a fix takes to every app.
- **Two tracks** (decided 2026-09-20, while building the Game List app).
  *Design language* grows freely and does not wait for a second app or a
  second use: tokens, semantic tones, `Badge` and variant styles, cell
  patterns, typography, density, themes. *Structure* stays need-driven,
  built against a real app's actual screen and not in advance: composites,
  new entry points or exports, backend, auth, infrastructure. Why the
  split: design language is cheap to review by looking at results, and it
  is exactly what an app can't get right alone (contrast, both themes,
  consistency). Structure is where "building forever" is the real risk.
- **Configuration grows from real forks.** A new prop or slot on a
  composite is structure: it is added when an app needs the variation, not
  in advance. Every one so far (`AppShell`'s `nav`/`sidebarExtra`/
  `defaultSidebarOpen`, `EntityForm`'s `danger`, `LoginRoute`'s
  `registerPath`) replaced a fork in Game List.
- **Polish is wanted.** The v1 "doesn't need to be good, needs to be
  reusable" stance was a ship guard, not a design position. Now that a real
  app exists, design-language work is not capped.
- **Review model.** The developer reviews *results* (the running app,
  options pages, screenshots), not every line. The mechanical gates are the
  safety net, and the goal is a foundation strong enough that line-by-line
  review isn't needed.
- **Unchanged:** the Hard Rules (semantic tokens only, shadcn before
  hand-rolling, gateway boundaries, the dependency allowlist). Every
  design-language addition ships with axe contrast coverage in both themes.

## Deferred

| Item | Revisit when |
|---|---|
| Sharing the backend. `template/backend/` is copied into each app and diverges from then on, so a backend fix (auth, the deploy checks, the SPA fallback) reaches no app on its own | Two apps need the same backend fix, or a second app keeps the reference backend. Then decide between a Python package for the auth/deploy/SPA layer and a documented patch routine |
| Login rate limiting / lockout on repeated failed attempts | The app is exposed somewhere a brute-force attempt is a real threat, not a personal/local deployment. Self-service registration widens this gap |
| Error reporting | An app is actually deployed to strangers |
| Additional themes | The developer wants a distinct look; the two-layer tokens already support it. Still no theme-switcher UI (see Excluded) |
| TypeScript 7 (native compiler) | typescript-eslint, openapi-typescript and Storybook's react-docgen-typescript all support it. TS 7's package exposes no classic JS API, and all three are built on that API. The tsconfigs are already TS 7-clean. When revisiting, drop the `openapi-typescript` → `typescript` entry in the `overrides` of the root and template `package.json` once openapi-typescript's own peer range covers the installed TypeScript |
| Read-only entity path in the playbook: a list and a view with no create, edit or delete. The view itself shipped in 3.10 (`EntityView`); the playbook still always builds the form and the view's Edit and Delete | The first real app needs an entity people only read. Build it against that screen: likely `Screens: list, view` in the plan, dropping the form, its routes and the view's actions |
| Rich text: inside a block the person edits, the editor's own Markdown style applies (a table edited gets padded cells, `*`-style marks, a reference link in that paragraph becomes inline; its definition is kept). Every untouched block is kept as written (`markdown-merge.ts`) | An app's notes rely on reference links or hand-aligned tables, and an edit to one block rewriting its formatting is a real complaint. Then merge one level deeper (list items, table rows) the way top-level blocks are merged |
| Rich text: inside a list item, Tab and Shift+Tab indent and outdent the item (Milkdown's list keys), so from a list item the keyboard leaves the text only once the caret is out of the list (or with Esc, editing in place). Not a trap, but not the page's usual Tab either | A keyboard user reports it. Options: Esc then Tab leaves (as code editors do), or Indent/Outdent toolbar buttons and Tab always leaving |
| **Rich text: images and uploads.** Showing an image by URL is the editor's part (Markdown `![alt](url)`, alt text required). Uploading is mostly backend: an endpoint, file storage, size and type limits, and serving files safely (an uploaded SVG or HTML file can run script on the app's own domain), all in the copied-in backend | An app has a screen that needs attachments. Decide storage first (disk, object storage, the database) and how files are served, then the editor's upload hook (`@milkdown/kit` `plugin/upload`) |
| **Rich text: a note with an image can't be edited.** The editor drops images when it loads (`![alt](url)` isn't shown at all, found 2026-10-06 while fixing the merge for padded tables), so any edit to such a note refuses to save: the merge keeps the image's block as written and the guard sees it isn't what's on screen. Refusing is deliberate, since writing the editor's version would delete the image. Before 3.16.2 this was the same refusal | An app's notes hold images (imported from another tool, say) and the refusal is a real complaint. Then show images in the editor (an image node view; the first half of the row above) |
| An open `Select` or `MultiReference` list was never axe-checked on the form. Editing in place checks both open: the in-place Status is non-modal, and a typed combobox hides the page from screen readers by design (the ARIA combobox pattern), which axe reads as hidden focusable content (`e2e/a11y.spec.ts` says why each rule is off) | A screen-reader pass on the form, or axe adds a rule the open lists fail |
| Notion API as a data source: a thin backend that serves `openapi.yaml` from a Notion database instead of Postgres (`consuming.md` compares the two) | A real project picks Notion as its source of truth. Build it against that project's database and property types |
| `DataTable` `meta.align: 'right'` for number and currency columns. Today only `'center'` exists, so `cell-patterns.md` pattern 11 keeps numbers left-aligned with `tabular-nums` | A real number column wants right alignment. It's a small change (header and cell both read `meta.align`), but it's a prop, so it waits for that column |
| A yes/no that can also be unset (three states: yes, no, not set) | A real plan needs "not answered" to differ from "no" |
| An **`icon` field type**: a single choice whose values are icon names from a fixed set of Lucide icons. On the form a `Select` whose trigger and options show the icon and its label; elsewhere the icon, tinted with the record's colour slot. To ship: the plan template's `icon` type, an `add-an-entity.md` step (the enum in `openapi.yaml`, the value → Lucide component map in one file, the `Select`, a migration with a CHECK on the values, a backfilled default for existing rows and a `COMMENT ON COLUMN` naming the set), and an icon on the template's WidgetCategory as the worked example (which would also make Widget's Extra Categories the worked example of cell pattern 4's multi-value variant). One app built this for itself (3.14 shipped how such icons display: pattern 4's variant) | A second app plans an icon field. Build it from that plan, with the first app's map, Select and migration to compare against |
| **A labelled deployment** (a staging copy that should say "Staging data"). `APP_ENV=production` refuses to start with `DATA_LABEL` set (3.19), so today a label only exists off production settings | An app deploys a second, non-production copy. Then decide between a deploy check that accepts a label when it's an explicit non-production one, and staging running without `APP_ENV=production` |
| Row virtualization | A table exceeds ~5k rows |
| `AppError` kinds for 403 (`forbidden`) and 409 (`conflict`); both render as the generic `server` error today | A backend actually returns either. None does: another user's widget is a deliberate 404, and a duplicate email is a 422 |
| Dependency-allowlist enforcement for `backend/pyproject.toml`, mirroring `ui-foundation check-deps` on the npm side | The backend gains a second contributor or session where an unreviewed Python dependency is a real risk |
| **The `<nav>` landmark doesn't contain the nav at phone width.** `AppShell` wraps `<Sidebar>` in `<nav aria-label="Primary">`, but below the mobile breakpoint the sidebar renders into a Sheet portaled to `document.body`, so the landmark is empty there. axe doesn't flag it and the links are reachable and labelled, so this is a semantics quirk. The a11y suite reads the links from the sheet on mobile | `AppShell`'s nav markup changes for another reason, or a screen-reader pass on a phone is actually done. Confirm first how it reads in a real mobile screen reader |
| **A new app's first `npm install` writes a lock `npm ci` rejects.** `create-app.sh` repairs it (3.9.0: `npm ci`, then one more `npm install`), but the cause is upstream and still there at 3.16.0, on npm 10.9.4 and 11.7.0. The first install hoists eslint's `ajv` 6 and `ajv-formats` 3 to the root, which breaks `@hookform/resolvers`' *optional* peers (`ajv ^8`, `ajv-formats ^2.1.1`). `npm install` accepts that and `npm ci` rejects it; the second install hoists `ajv` 8 and nests eslint's copy. Inferred to be npm's handling of optional peers, not this repo's. No small fix here: `ajv` can't be overridden globally (eslint needs 6), and a lockfile shipped with the template wouldn't match the version `create-app.sh` writes | The guard's second `npm install` also fails, an app's own later `npm install` writes a lock `npm ci` rejects, or an npm release changes this (check: drop the repair step locally and run `scripts/consume-test.sh --install-only`) |
| **`check-backend-postgres.sh` needs Docker.** It deliberately ignores `DATABASE_URL` and always starts the `docker-compose.yml` Postgres, so its test users and migrations never land in a real database. Claude Code cloud sessions have no Docker, so there it can't run (3.9.0's migration was checked against a local `initdb` Postgres by hand instead) | A backend change has to be verified where Docker isn't available. Then add an explicit opt-in for a throwaway database (a separate variable, never `DATABASE_URL` or `backend/.env`), not a fallback |
| **Apps don't get the cloud session hook.** This repo's `.claude/hooks/session-start.sh` (npm install, the backend venv, the Playwright browser mapping) lives at the root, outside what `sync` writes, so an app worked on in a Claude Code cloud session hits the same browser-revision gap | An app is worked on in a cloud session and its `verify` fails on missing browsers. Then decide whether `sync` writes the hook into `.claude/` (it already owns the agent files there) or `docs/create-an-app.md` says how to add it |
| **Phone width is asserted, not designed.** The `mobile-chrome` project proves the app works at 393px, but that is inherited from shadcn, not chosen: the first viewport is all filters, and every column past the second is off-screen with no column-visibility or density control | An app is genuinely used on a phone and someone complains. Decide first between "usable at 393px" (today) and "designed for 393px" (column priority, density, a card layout) |

## Excluded

- **Per-app edits to package components.** Configure through props, build
  on top, or raise the change here (`consuming.md` "Changing the
  foundation").
- **Custom primitives.** shadcn's are the base; the package patches them
  where needed.
- **Theme switcher UI.** Build the token architecture, not the feature.
- **SSR / SEO tooling.** Irrelevant for personal database applications.
