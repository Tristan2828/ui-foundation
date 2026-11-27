# Quick Jot: Plan for the Workers

A hand-off plan, not a log. A planner session wrote it on 2026-11-26 and
27 from the developer's brief ("Build a quick-jot notes app, and use it
to make the foundation's rich text better"), four research passes over
the code, measurements on a built copy of the half-built app, and the
developer's answers to eight questions. Each work package is sized for
one worker session and says what to read, what to build and when it is
done. Delete this file in the last package (`AGENTS.md`: there are no
per-session log files).

## The Goal

- **An app:** open it in a second and type notes into it, in tabs, the
  way Notepad is used for scratch notes. Notes are records in the app's
  own backend. It works on a phone too.
- **A consumer:** the app is a daily-use consumer of the foundation's
  rich text and Markdown (`RichTextEditor`, `<Markdown>`, `NotesOutline`,
  `packages/ui-foundation/src/lib/markdown-*.ts`). Every rough edge it
  hits becomes a change in the package, released, never a workaround in
  the app. The editor is never forked or copied.

Done, in the developer's words: installed as a PWA from Edge or Chrome
and pinned; the editor is ready by the first keystroke; several notes
open in tabs, with keyboard new, close and switch, and the tabs come
back next time; nothing is saved by hand and closing mid-sentence loses
nothing; an older note is quick to find; it works on a phone; a failed
save says so and keeps the text. Offline, local drafts, a global hotkey
and a desktop shell are out of scope.

## What the Developer Decided

Asked on 2026-11-26 and 27. These are settled; build to them.

| Question | Answer |
|---|---|
| Who merges a foundation PR | **The worker**, once the three required checks are green and the change only adds. A breaking change stops for the developer |
| A note's name | **Its first line**, with no title box on the page. The developer can **rename a tab**; a given name wins over the first line |
| Pictures in notes | **Yes**, stored **in Postgres** |
| Pictures and new dependencies | The developer did not want `python-multipart`, Pillow or `pillow-heif` in the template, wanted the notes easy to move into Homebase later, and said to do what is best for the long term. **Settled: no new dependency**, Homebase's addresses, and room to add server-side processing later without changing an address ("Pictures" under "The Design") |
| Open tabs | Remembered **per device** |
| Switching tabs | Each tab **keeps its caret, scroll and undo** |
| The caret in a new note | **In the text** |
| The half-built work | **Kept** as the head start |

## Rules Every Worker Follows

Read `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/DEFERRED.md` and
`docs/BLOCKERS.md` in this repo first. In the app, read its `AGENTS.md`
and `docs/foundation/add-an-entity.md` (its index, then the lines you
need).

- **A question or a decision for the developer goes in
  `docs/BLOCKERS.md`** (this repo's, in your PR), never in a PR
  description. Say "Blocked: needs X" or "Went ahead with A; B instead
  would mean Y".
- **No new dependency**, npm or Python. Not on the allowlist: write the
  case in `docs/BLOCKERS.md` and stop on that piece.
- **Generic goes in the package, additive** (an optional prop, a new
  export, a fix), with tests, a fixture story and docs.
- **Merging.** A foundation PR that bumps the version publishes to npm
  and PyPI when merged. The developer has said workers merge their own:
  only when `verify`, `verify-backend` and `install-test` are green,
  only an additive change, squash, from a detached HEAD
  (`gh pr merge` switches the worktree otherwise). Before picking a
  version: `git fetch --tags`, the latest `v*` tag, and open PR titles.
  After merging, wait for the release run and read `release-smoke`'s
  result; a failed release is a `docs/BLOCKERS.md` item, not a retry.
- **A new check counts only after a negative control.**

What this machine taught the planner:

- `npm ci` in a fresh foundation worktree before trusting a local gate.
  Docker is not installed: `check-backend-postgres.sh` and the image
  build cannot run here.
- The app uses ports **5195** (dev) and **4195** (preview, Playwright).
- The Claude desktop app's built-in browser pane cannot register MSW's
  service worker (a blank page). Use the app's Playwright specs.
- Mock data lives in the page: a reload or `goto` resets it to
  `src/mocks/notes.ts`'s `initialNotes`. Make a note through the UI, not
  through `fetch` and a reload.
- **Never press Ctrl+S in a headed browser from a script.** It opened
  the browser's Save dialog and hung the planner's run for 30 minutes
  (finding R7).
- A long Bash heredoc with apostrophes in it fails in this shell. Write
  files with the editor tools.
- Building the app against an unreleased package: `npm run build &&
  npm pack --pack-destination <folder>` in `packages/ui-foundation`,
  then `npm install <tarball> --no-save` in the app. The committed app
  only ever needs a published version.

## What Exists Now

Kept true as packages finish (2026-11-27).

**Foundation, released** (each merged with its three checks green, and
`release-smoke` read):

| Package | Release | PR |
|---|---|---|
| F1 `EditInPlaceScope`, `preloadRichTextEditor` | 4.148.0 | #444 |
| F3 uploads reference, `shrinkImage`, `foundation_backend.uploads` | 4.149.0 | #445 |
| F4 (found by A3) `staysOnPage`, the lost-edit toast, `onLostEdit` | 4.150.0 | #446 (its squash commit's title says 4.151.0; the code is 4.150.0) |
| F5 (found by A5) `pwa()`'s `smallIcon`, `maskableIcon`, `iconSvg`; the phone's back link 44 px | 4.151.0 | #447 |
| F2 the editor's behaviour: held keys, retried load, `autoFocus="end"`, `focusKey`, `tabStaysInText`, Ctrl/Cmd+S, leading spaces | 4.152.0 | #448 |
| F6 (found by A4) "Save Status" and "Uploads" names, the lost edit's own title, SQLite URLs | 4.153.0 | #449 |

**The app, `C:\Repos\quick-jot`,** committed (no remote, no CI):

| Package | State |
|---|---|
| A1 contract (`name`, no sign-up) | Done |
| A2 backend (migrations 0018 drop widgets, 0019 notes) | Done: `verify:backend` passes. `check-backend-postgres.sh` rewritten for notes, never run (no Docker) |
| A3 frontend (kept-alive panes, tabs, keys, renaming, specs) | Done: `verify` passed |
| A6 deploy files; Homebase's `quick_jot` database | Done locally. Homebase's change is a local branch `claude/quick-jot-database` in the worktree `C:\Repos\homebase\.claude\worktrees\quick-jot-db`, not pushed |
| A5 install, start, phone | Done; two typing-at-start specs are `test.fixme` until the app takes 4.152.0 |
| A4 pictures (migration 0020) | Done on 4.150.0: `verify`, `verify:backend`, `build:real` passed |
| A7 upgrade to the last release, use it, report | Next |

## The Design

### The Note

One entity (`C:\Repos\quick-jot\docs\entities\note.md`; A1 brings it up
to date, then it is the spec).

| Field | Type | Rule |
|---|---|---|
| `body` | long text, Markdown | Up to 200,000 characters. Stored byte for byte, never trimmed |
| `name` | text, optional | The name the person gave the tab. Up to 120 characters, trimmed; empty means none given. In `NoteCreate` and `NoteUpdate` |
| `title` | computed, read-only | `name` when it has words, else the first line of `body` that has words (the rule in `src/lib/note-title.ts`), else empty. Every screen shows `title`, or "Untitled" when empty |
| `createdAt`, `updatedAt` | date-time | `updatedAt` is the version: a save sends `baseUpdatedAt`, a 409 means someone else saved first |

Soft delete with restore. Per-user. Search matches `body` or `name`.
The first-line rule lives in TypeScript (mocks) and Python (backend),
and both read `tests/fixtures/note-titles.json`.

### Screens

| Route | What it is |
|---|---|
| every route | Inside `NotesWorkspace`: the strip of open tabs, New Note, All Notes |
| `/` | The tab last in front, or "No Notes Open" with New Note focused |
| `/notes/:id` | The note in front: nothing but its text, always editable. Its bar has Rename and Delete. A `NotesOutline` beside long notes on a wide screen |
| `/notes` | All Notes: a `DataTable`, newest first, search, a Deleted view with Restore |
| Ctrl+K | The shell's search palette, finding notes by their text or name |

### Autosave Is the Package's

The note is `editInPlace({ kind: 'long-text', inline: true })` inside an
`EditInPlaceScope`. That gives everything `cell-patterns.md` "Editable
value" promises: a save a pause after typing stops, at once on leaving,
hiding or closing the page (`keepalive`), "Saving…" and "Saved" under
the text, a failed save said there and in a toast with the text kept,
and Keep Mine or Show Saved when the note changed elsewhere. The app
writes none of that. Renaming goes through the same `useRecordUpdate`
hook as the text, so the two saves queue and never conflict with each
other.

### Tabs

App code (`src/routes/notes/open-tabs.ts`: pure rules and a small
store). The open ids and the one last in front are kept in
`localStorage` per account; the tab in front is the address.

- **Every open tab keeps its editor alive.** The workspace mounts one
  pane per open, loaded note and shows only the one the address names;
  the others are hidden, not unmounted. A tab keeps its caret and undo
  because its editor is never rebuilt, and its scroll because the pane
  remembers the offset when it is hidden and puts it back when shown.
- **One `EditInPlaceScope` around all the panes**, not one each. Each
  scope renders a leave guard that takes React Router's blocker, and the
  router is built for one blocker at a time. One scope means one guard,
  and its store already holds several always-editable values.
- A pane coming to the front focuses its editor (ProseMirror puts its
  own selection back on focus). A pane mounting for the first time opens
  with the caret at the end (`autoFocus="end"`, F2).
- Cap the live editors (the eight most recent, say). A tab past the cap
  is rebuilt when shown. Write the number in the code.
- Closing a tab unmounts its pane. The editor reports what was typed as
  it unmounts and the store saves a field that leaves, so nothing typed
  is lost; A3 proves it with a spec. Closing never deletes a note,
  except an empty one (no words, no name).
- **Renaming:** double-click a tab, F2, or Rename in the note's bar
  turns the tab's name into a one-line box. Enter or leaving saves, Esc
  gives up, and saving it empty goes back to the first line.

Tabs stay app code: nothing else in the family has asked for a strip of
open records. Propose it for the package only if a second app wants one.

### Keys

In `workspace.tsx`, on `window`, in the capture phase: Alt+N new, Alt+W
close, Alt+PageDown and Alt+PageUp next and previous, Alt+1 to Alt+9,
F2 rename. Also Ctrl+T, Ctrl+W, Ctrl+Tab and Ctrl+PageDown/Up, which a
browser tab never hands a page but an installed app's window is expected
to. Nothing here can check that (A5 leaves it for the developer).

### Pictures

The developer asked whether it is best to just bring Homebase's three
packages in, then said to do what is best for the long term. Settled:
**no new dependency now, built so one can be added later without
changing an address.**

- **Why this is the long-term choice.** A reference in the template is
  copied into every new app, so its dependencies become every app's to
  keep patched. Homebase needs `python-multipart` to read a multipart
  upload and Pillow (with `pillow-heif`) to re-encode, thumbnail and
  strip location data; both parse hostile input and both get regular
  security releases. Most apps need none of it: `docs/DEFERRED.md`'s own
  row for uploads already describes the plain design ("type sniffed from
  the bytes, not the name; served with `Content-Disposition`, `nosniff`
  and its own content type").
- **Room to grow.** The addresses and the stored Markdown are the
  contract; how the server treats the bytes is not. Server-side
  thumbnails, re-encoding and HEIC can come later as an optional extra
  of the backend package (as `push` is, with `cryptography`), behind the
  same `POST /files` and `GET /files/{id}/content?size=`, with no note
  rewritten. Homebase's implementation is already that superset, so the
  family has one contract and two depths, not two designs. F3 records
  the extra as a `DEFERRED.md` row: revisit when an app needs
  thumbnails, or serves pictures uploaded by someone other than the
  account that views them (where re-encoding is the stronger defence).
- **Upload:** the browser sends the picture itself as the request body
  (`safeFetch('/files', { method: 'POST', body: file, headers: {
  'content-type': file.type } })`; the transport passes a body through
  untouched). No multipart, so no parser.
- **Type:** the server reads the first bytes. JPEG, PNG and WebP only.
  Never SVG, HTML or GIF. The name and the browser's type are not
  trusted.
- **Size and location data, in the browser:** before upload the picture
  is redrawn on a canvas, at most 2560 px on its long edge, as WebP
  (`createImageBitmap` with `imageOrientation: 'from-image'`, then
  `canvas.toBlob`). A phone photo drops from several megabytes to a few
  hundred kilobytes, and a redraw carries no EXIF, so no location. This
  is a courtesy, not a defence: a client that skips it uploads a bigger
  file that keeps its location data, and the server's checks are the
  same either way. Server limit: 10 MB, a 413 over it.
- **Storage:** Postgres. A `files` row (owner, type, size, hash,
  created) and the bytes in their own table, so reading the row never
  loads the picture. No volume in the deploy; the database backup
  covers pictures.
- **Serving:** behind the session, another owner's file a 404, with
  `X-Content-Type-Options: nosniff`, `Content-Disposition: inline` under
  a name made from the id, `Content-Security-Policy: default-src 'none';
  sandbox`, `Cross-Origin-Resource-Policy: same-origin`, and a private
  immutable cache.
- **Homebase's addresses:** `GET /files/{id}/content`, taking and
  ignoring Homebase's `?size=large|thumb`. A note's Markdown is
  `![](/api/files/{id}/content)`. Moving the notes screens into Homebase
  means passing them Homebase's own `uploadImage` (the screens take the
  upload as a function); moving the notes' data means moving the files
  and their ids, which any design would need.
- **Nothing is deleted in the first version.** A note is soft-deleted
  and can come back, so its pictures must outlive it. Orphans are a
  deferred row.
- **What this gives up against Homebase:** no thumbnails, no HEIC (an
  iPhone hands a web page JPEG unless asked for HEIC), and no server-side
  re-encode.

### Startup

Measured on a mock-mode production build, served locally:

| What | Time |
|---|---|
| New Note pressed → the editor takes keys | 415 ms. The first 13 characters typed at 15 ms a key were lost |
| Cold open on a note: its text is visible | about 250 ms |
| Cold open on a note: the editor takes keys | about 550 ms |
| Entry bundle / editor chunk | 1.23 MB (382 KB gzipped) / 464 KB (145 KB gzipped) |

The start is a chain: `index.html` (revalidated every launch), the entry
bundle, `/api/auth/me`, only then the note's request, then the editor.
Cache headers are already right (`foundation_backend/spa.py`: hashed
assets immutable, everything else `no-cache`). The plan's levers, none
needing offline support or a dependency: F2 closes the gap in which keys
are lost; A5 preloads the editor chunk from `index.html`, asks for the
front note alongside `/auth/me`, and loads the All Notes screen lazily.

## What the Rich Text Has Shown

Found by typing into the real editor in the half-built app, then traced
in the code by a read-only researcher. "Seen" means observed in a
browser; "read" means from the code only.

| # | Finding | Evidence | Goes to |
|---|---|---|---|
| R1 | The autosaving editor could only live inside an `EntityView` or a `DataTable` | Seen: `<EditableValue>` throws outside them | F1 |
| R2 | **Keys typed before the editor is up are lost.** Nothing focusable exists until the editor is built: the loading view is plain markup (`rich-text-editor.tsx` 229-264), React holds the swap from a Suspense fallback for up to about 300 ms even when the chunk is loaded, and the editor is built in a passive effect after paint (`milkdown-editor.tsx` 485, focus at 918) | Seen and measured (above) | F1 (preload), F2 (the rest) |
| R3 | **Leading spaces are saved as `&#x20;`.** remark-stringify encodes a space at a line's start (`mdast-util-to-markdown` `lib/unsafe.js` 56-57). Trailing spaces are already cut by `rich-text-empty-paragraph.ts` 26-32. The same leak, read not seen: both ends of a heading, list items, quotes, text after a hard break | Seen: `&#x20; indented with two spaces` read back from the API | F2 |
| R4 | **Tab on a plain line leaves the note for the Full Screen button, and the next Space presses it.** `handleTab` (`rich-text-shortcuts.ts` 121-133) takes Tab only in lists and code. The tools strip sits after the text in the DOM, with Full Screen its one tab stop | Seen: "after" lost, the note in full screen | F2 |
| R5 | **`autoFocus` puts the caret at the start.** Milkdown builds the state with no selection and line 918 only focuses | Seen: typing landed before the first character | F2 |
| R6 | **Blank lines typed for spacing show in the editor and are not saved.** Three Enters leave no trace in the Markdown, so the gap is gone on the next open | Seen | F2: say so in the docs, and a `DEFERRED.md` row |
| R7 | **Ctrl+S is not taken.** By habit it opens the browser's Save dialog over a note that saves itself | Seen indirectly: the planner's script hung on the dialog | F2 |
| R8 | After one refused edit, every later edit is refused until it is undone, and the toast shows once (`milkdown-editor.tsx` 523-528, `editable-value.tsx` 364-375) | Read | F2: reproduce; fix or a `DEFERRED.md` row |
| R9 | `React.lazy` keeps a failed load for the session, so an editor chunk that 404s after a deploy fails every editor until a reload. `rich-text-load.ts`'s comment says the editor retries; it does not yet | Read | F2 |
| R10 | Between the loading view and the built editor the root is empty for a frame, and an `inline` editor has no minimum height, so the note collapses and comes back | Read | F2 (fixed by building in a layout effect) |
| R11 | Each 300 ms pause serializes the whole note and parses it twice on the main thread. The typing budget (`e2e/rich-text-perf.spec.ts`) covers about 5,000 words; a note may hold 200,000 characters | Read | A7: measure a long note; a `DEFERRED.md` row if it is slow |
| R12 | `pwa({ icon })` writes one 512 px entry and drops the 192 px and maskable ones. Without `icon` the PNGs are a plain square with no letter (`DEFERRED.md` "Generated PNG icons have no letter") | Read | A5: try it; F2 or a row if the install is poor |
| R13 | The tools strip is drawn above the field's top edge, outside its box, so it covers whatever sits above a note at the top of a page | Read | A3: leave it room, or raise it |

Typed Markdown works as hoped (seen): `# `, `- `, `[] `, `> `, `**bold**`,
`` `code` ``, `~~struck~~`, `==marked==`, a bare address becoming a link,
Shift+Enter saved as a `\` break.

**`DEFERRED.md` rows whose "revisit when" this app is likely to meet.**
A worker who sees the condition met picks the row up or says why not:

- "**Uploads on the backend.**" Met: this is the second app. F3.
- "Rich text: inside a list item and a code block, Tab and Shift+Tab are
  the text's." F2 changes it; update the row.
- "Find in page doesn't see folded text" (a long note with toggle
  headings).
- "Rich text: inside a block the person edits, the editor's own Markdown
  style applies."
- "Rich text: an uploaded image has no alt text" and "an upload outlives
  no editor" (pictures; the second is rarer with editors kept alive).
- "Noticing a newer build before anything fails" (an installed app's
  window stays open for days across deploys).
- "`OfflineNotice` can't tell a dropped connection from a server that's
  down" (the brief asks for a failed save to be said honestly).

## Work Packages

```
F1 scope + preload ──► release ──► F2 editor behaviour ──► release ──┐
F3 uploads reference ───────────► release ──► A4 pictures ───────────┤
A1 head start + contract ──► A2 backend ─────────┬──► A6 deploy ─────┼──► A7 upgrade, use it, report
                         └─► A3 frontend ──► A5 install, start, phone┘
```

F1, F3 and A1 start at once. F2 edits files F1 creates, so it starts
from `main` once F1 is merged. A2 and A3 run side by side after A1: A2
owns `backend/`, A3 owns everything else in the app, and each commits
only its own paths. Foundation PRs that are green at the same time are
folded into one release PR (`ARCHITECTURE.md` "Several PRs ready at
once").

### F1: Package, a Scope for Editing in Place and an Editor Preload

- **Where:** this worktree and branch (the code is here, uncommitted).
  Commit it first.
- **Review** `edit-in-place-scope.tsx` and `rich-text-load.ts`.
- **A fixture story,** `src/components/app/edit-in-place-scope.fixtures.tsx`
  (any `*.fixtures.tsx` is picked up by `e2e/harness/registry.ts`; the
  id is `app-editinplacescope--<export>`). Model it on `Autosave`
  (`AutosaveRecord`, `entity-view.fixtures.tsx` 1171-1256) and
  `LongInline` (1266-1330): a 500 ms save, text containing "refuse" is
  refused, a save counter, "Change Notes Elsewhere", a route to leave
  to, `<Toaster />`. It needs a data router (`createMemoryRouter`):
  the leave guard uses the router's blocker. Add a second story with
  **two** always-editable values in one scope, which is what the app
  does.
- **A harness spec,** `e2e/edit-in-place-scope.spec.ts`, **added to
  `testMatch` in `playwright.harness.config.ts`** (it is skipped
  otherwise; check the run's test count went up). Copy from
  `e2e/entity-view.spec.ts`, describe "EntityView, long text that
  autosaves" (helpers `openAutosave`, `typeAtEnd`, `changeElsewhere`,
  `saves`): typing saves with no click away; a refusal keeps what was
  typed, with the reason; leaving the page saves first and asks only
  when the save fails; saved elsewhere under unsaved typing asks; Keep
  Mine keeps both. Add: a value unmounted mid-typing is still saved.
  Negative control: `<EditableValue>` outside any host throws, naming
  both hosts.
- **Axe and token colours:** one line in `COMPOSITE_STORIES` in
  `e2e/fixtures-visual.spec.ts`, `{ id, mustShow }`, per story.
- **A node test,** `tests/rich-text-load.test.ts` (vitest runs in node,
  no DOM): the loader resolves to the editor's default export;
  `preloadRichTextEditor()` returns nothing and does not throw; a failed
  load leaves no unhandled rejection (`vi.mock` the editor module to
  throw, in a second file).
- **Docs:** `conventions/docs/cell-patterns.md` section 18: its opening
  (835-841) names the record's view as the only host; "Always editable"
  (1066-1075) says "the editor loads on every visit", where the preload
  belongs. Also `docs/ARCHITECTURE.md` 367-368 and the export table in
  `packages/ui-foundation/README.md`. Then `npm run docs:index` in the
  package and `npm run sync` at the root; commit the template's copy.
- **Release:** the next free minor. Four places hold the version:
  `packages/ui-foundation/package.json`, its entry in the root
  `package-lock.json`, `packages/backend-foundation/pyproject.toml`, and
  the pin in `packages/backend-foundation/README.md`. A `CHANGELOG.md`
  entry shaped like 4.146.0's, with "How an app adopts it". PR title
  `<version>: <summary>`.
- **Done when:** `npm run verify` passes at the root, the PR's three
  checks are green, it is merged and `release-smoke` passed.

### F2: Package, the Editor's Behaviour

- **Where:** a fresh worktree from `main`, after F1 is merged.
- **First** write a failing test for each of R2 to R5 and R7 on the
  real editor (`e2e/rich-text-editor.spec.ts`, `rich-text-inline.spec.ts`;
  node tests in `tests/rich-text-typing.test.ts` and
  `tests/markdown-merge.test.ts`). Reproduce R8. A finding that does not
  reproduce is dropped, with a line in the PR saying so.
- **R2, R9, R10: no key lost while the editor starts.** No new prop.
  1. `rich-text-load.ts` remembers the loaded module. `RichTextEditor`
     chooses once per mount: render the editor directly when it is
     loaded, else today's Suspense path. A failed load is forgotten, so
     the next mount tries again (R9).
  2. Build the editor in `useLayoutEffect`, so commit, build and focus
     are one task and the empty frame goes (R10).
  3. While it loads and `autoFocus` is set and it is not read-only, the
     wrapper renders a `<textarea>` **beside** the Suspense boundary,
     not inside the fallback (which unmounts on the swap). It carries
     the field's label, takes focus, and holds what is typed. Once the
     editor is up it takes that text, focuses, replays it, and the
     textarea goes. Replay each character through the view's
     `handleTextInput` (so `# ` behaves as typed) and each newline as
     Enter. If a composition is open at hand-over, wait for
     `compositionend`.
  - **The trap:** replay must run **after** `baseline` is read
    (`milkdown-editor.tsx` 913). Replayed before, the typed text is part
    of the baseline, the editor looks unchanged, and it is silently
    never saved. Test exactly this: type during a held load, assert the
    saved Markdown.
  - Focus must pass from the textarea to the editor in one task, or
    `EditableValue`'s blur timer (461-472) commits.
  - Test with the chunk held by `page.route('**/milkdown-editor-*.js')`.
- **R3: trim leading spaces on save,** as trailing ones are. Extend
  `withEmptyParagraphChildren` to cut leading `[ \t]+` (never inside
  inline code) and trim both ends in the heading runner
  (`rich-text-toggle-heading.ts` 42-50). Do not write them unescaped:
  four spaces or a tab would re-parse as a code block, and the guard
  compares the serializer's own output on both sides, so it would not
  notice. A note that already holds `&#x20;` must still save (a
  `markdown-merge.test.ts` case). Say in the docs that a paragraph
  carries no indent. Space after a hard break: handle it or a
  `DEFERRED.md` row.
- **R4: `tabStaysInText?: boolean` on `RichTextEditor`,** default false,
  for an editor that is the page. Tab and Shift+Tab that nothing else
  took are swallowed (a keydown on the text root after ProseMirror's
  own: target inside the view, not `defaultPrevented`, not composing).
  On a plain line Tab does nothing to the text: Markdown cannot store a
  paragraph's indent. **Esc, then Tab, moves on**: an Esc that reaches
  the field arms the next Tab for the browser; any other key, a blur or
  a click disarms it. Alt+F10 stays a second way out. WCAG 2.1.2 needs
  the way out told: hidden text through `aria-describedby`, and the same
  words shown the first time a Tab is swallowed. Update the
  `DEFERRED.md` row on Tab.
- **R5: `autoFocus?: boolean | 'end'`.** `true` is unchanged. `'end'`
  sets a text selection at the document's end before focusing
  (`Selection.findFrom(doc.resolve(doc.content.size), -1, true)`, not
  `Selection.atEnd`, which can select a trailing divider or image so the
  next key replaces it) and scrolls it into view. Opening must save
  nothing. With `foldKey`, a caret put in a folded section opens it:
  decide and test what a note ending in a folded section does.
- **R7: Ctrl/Cmd+S in an autosaving value saves now** and stops the
  browser's dialog, beside Ctrl/Cmd+Enter in `editable-value.tsx`.
  Assert `defaultPrevented` in a spec; never let the dialog open.
- **R6:** a sentence in `cell-patterns.md` and a `DEFERRED.md` row
  (revisit when someone misses the spacing; a blank paragraph has no
  plain Markdown form).
- **R8:** fix if small, else a `DEFERRED.md` row with what was seen.
- **Done when:** each item has its test and negative control, fixtures
  and docs are updated, `npm run verify` passes, the PR is merged and
  released.

### F3: Foundation, the Uploads Reference

- **Where:** a fresh worktree from `main`. Independent of F1 and F2
  apart from `CHANGELOG.md`.
- **Read:** `docs/DEFERRED.md` "Uploads on the backend"; "Pictures"
  above; `conventions/docs/add-an-entity.md` "An image on a record"
  (506-534); `src/lib/image-file.ts`; Homebase's version for the shape
  of the tests and the mock only (`C:\Repos\homebase`:
  `backend/app/routers/files.py`, `backend/tests/test_files.py`,
  `src/mocks/files.ts`, `src/api/gateway/files.ts`,
  `backend/migrations/versions/0044_files.py`).
- **Backend package** (`packages/backend-foundation`): a function that
  names a picture's type from its first bytes (JPEG, PNG, WebP, else
  none) and a response helper that serves bytes with the headers under
  "Pictures". Stdlib only. Tests beside the package's others.
- **Package:** an optional browser-side shrink in
  `src/lib/image-file.ts` (redraw on a canvas to a longest edge and a
  type, falling back to the original file when the browser cannot),
  exported, with a harness test (vitest has no canvas).
- **Template reference:** in `template/`: the contract (`POST /files`
  with a binary body, `GET /files/{id}`, `GET /files/{id}/content` with
  the ignored `size`; a `File` schema), `npm run gen:api`, the gateway
  `src/api/gateway/files.ts` with its spec-derived tests, mocks
  (`src/mocks/files.ts`, reset in `data.ts`), the conformance test (its
  validator reads JSON only: handle the content path), the backend
  router, model, a migration with `COMMENT ON` for both tables, backend
  tests (type from bytes, a lying name, 413, another owner's 404, each
  header), and `upload` on the Widgets description with an e2e. The
  path is the app's own contract, not `openapi/foundation.yaml`: the
  package never calls it.
- **Docs:** rewrite "An image on a record" (it shows `FormData` and says
  the template has none); `template/docs/deploy.md`; remove the
  `DEFERRED.md` row and add rows for what is left: orphaned files, and
  server-side thumbnails, re-encoding and HEIC as an optional extra of
  the backend package (the revisit condition is under "Pictures");
  `docs/consuming.md` for an app that wants to adopt
  it. `npm run docs:index`, `npm run sync`.
- **Done when:** `npm run verify` and `npm run verify:backend` pass,
  `scripts/consume-test.sh --install-only` passes on the commit, the PR
  is merged and released. Postgres could not be run here: a
  `docs/BLOCKERS.md` line says so (CI's `verify-backend` migrates a
  real Postgres and checks the comments).

### A1: App, Commit the Head Start and Settle the Contract

- **Where:** `C:\Repos\quick-jot`. Short. Everything after it in the app
  depends on it.
- Commit what is there as it stands, in one commit that says it is an
  unverified head start.
- Remove the `getNotesByIds` describe from `tests/gateway/notes.test.ts`
  without reading the gateway.
- Add `name` to `openapi.yaml` as "The Note" above says (`Note`,
  `NoteCreate`, `NoteUpdate`; `title`'s description; `search` matching
  body or name), `npm run gen:api`, and bring `docs/entities/note.md`
  up to date: the field, the rule, renaming on the view. Write
  `docs/product.md` (the brief's goal and scope, and the table of the
  developer's decisions).
- Add cases to `tests/fixtures/note-titles.json` only if the first-line
  rule itself changes; the name is not part of that rule.
- **Done when:** the commit is in, the contract and plan agree, and
  `npx vitest run tests/note-title.test.ts tests/mocks` passes. `tsc`
  will fail until A3 uses the new field: say so in the commit.

### A2: App, the Backend

- **Where:** `C:\Repos\quick-jot\backend\` only. After A1.
- **Review** what the stopped helper left; it may be inconsistent.
- **Build:**
  - Two migrations: drop every widget table (the shape of
    `C:\Repos\palm-datebook\backend\migrations\versions\0018_drop_widgets.py`),
    then `notes` (`owner_id` indexed, `body`, `name`, `created_at`,
    `updated_at`, `deleted_at`) with `COMMENT ON` for the table and
    every column.
  - `name` through the model, schemas, router (trimmed; `title` computed
    from it and the body), search, tests and the MCP entity.
  - Take `auth.register_router` out of `main.py`: one account's notes,
    no public sign-up, as Homebase and Palm Date Book did.
  - `body` is never trimmed. `backend/tests/test_note_title.py` passes
    without the fixture being edited.
- **Done when:** `npm run verify:backend` passes. A `docs/BLOCKERS.md`
  item: "Blocked: needs `scripts/check-backend-postgres.sh` run where
  Docker is".

### A3: App, the Frontend

- **Where:** `C:\Repos\quick-jot`, everything outside `backend/`. After
  A1. Needs F1's exports: from the release if it is out, else the
  tarball.
- **Rework to the design:**
  - `name` in the mocks, hooks and screens; renaming a tab (double-click,
    F2, Rename in the note's bar).
  - Panes kept alive under one `EditInPlaceScope`, focus and scroll put
    back on return, the cap ("Tabs" above). The head start's
    `note-page.tsx` mounts one editor per visit and
    `workspace.tsx` closes the front tab by navigating away first; both
    change.
  - Room for the editor's tools strip above the note (R13).
- **Tests.** Import `test` and `expect` from
  `@tristan2828/ui-foundation/testing`. Force states with
  `forceMswOverride` (`{ hold: true }` for loading, never a delay).
  - `tests/open-tabs.test.ts`: `withTab`, `withoutTab`, `tabBeside`,
    `parseTabs` (a hand-edited value, an old shape, duplicates).
  - One Playwright test per state per screen: the note (loading, not
    found, error, success), All Notes (loading, empty, error, success,
    search, Deleted and Restore), the home page (no tabs; tabs
    redirect).
  - The brief's promises, copied from the template's deleted
    `e2e/widget-edit-in-place.spec.ts` (`git show
    HEAD:e2e/widget-edit-in-place.spec.ts`; swap widgets for notes,
    `description` for `body`, the Description region for
    `[data-slot="note"]`; copy its helpers `patchBodies`,
    `refusePatches`, `delayPatches`, `clickParagraphEnd`,
    `saveElsewhere`, `stored`): typing autosaves and stays editable; a
    500 and no answer keep the text and say why; leaving saves first;
    closing the window asks the browser; the four "two writers" tests.
  - Tabs: open, close, switch and rename by mouse and by key; they come
    back after a reload; a tab keeps its caret and undo after a switch;
    closing a tab mid-typing saves it; closing an empty note removes it;
    Delete and Undo.
  - The kept specs, each with its smallest change:
    - Everywhere, the home page is found by
      `getByRole('heading', { level: 1, name: 'No Notes Open' })`, never
      by a "New Note" button (there are two).
    - `a11y`: `defineA11ySuite({ nav: NAV_ITEMS, formRoutes: [],
      viewRoutes: ['/notes/1', '/notes/4'], loggedOutRoutes: ['/login'] })`,
      and rewrite its three Widgets describes for the note (the editor
      while it loads, editing in place in both themes, headings).
    - `auth`, `error-reporting`, `msw-boot`, `msw-contract`,
      `mobile-sidebar`, `shell`, `smoke`, `blocked-storage`: widgets to
      notes, by the nav link inside `navigation "Primary"` (the strip's
      All Notes is a button). `error-reporting`'s selector becomes
      `[data-state="not-found"]`, the app's spelling.
    - `data-environment-banner`, `mock-mode-banner`:
      `routes: ['/notes', '/login']`.
    - `msw-leave-after-save`: rebuild it on `/notes/1`. If its control
      can no longer be made to leak a request, drop the spec and say
      why in its place.
    - `register`: delete. `login-two-step`: no change.
    - `playwright.config.ts`: `mobile-chrome`'s `testMatch` names the
      new specs.
- **Docs:** `AGENTS.md` below the foundation block (what the app is, and
  "Reference files" naming this app's own file for each pattern it
  has); `README.md`.
- **Done when:** `npm run verify` passes in the app, committed.

### A4: App, Pictures

- **After F3 is released and A3 is in.**
- Upgrade the app to F3's release. Copy the reference from the template
  at that tag: the contract, gateway and its tests, mocks, backend
  router, model, migration and tests. Pass `upload`, `imageAccept` and
  `imageMaxSize` to `NoteBodyEditor`, with the browser-side shrink.
- Specs: paste a picture into a note and it is in the saved Markdown as
  `![](/api/files/<id>/content)`; a refused type and a too-big file say
  why; the picture shows after a reload.
- The app's `DEFERRED.md`: orphaned files; alt text (the foundation's
  row).
- **Done when:** `npm run verify` and `npm run verify:backend` pass.

### A5: App, Install, Start and Phone

- **After A3.**
- **Install:** `pwa({ name: 'Quick Jot', shortName: 'Quick Jot' })` is
  in and writes a standalone manifest. The icon is the weak spot (R12):
  the app needs its own (`public/`, and `pwa({ icon })`). Try the
  install; if Edge refuses it or shows a poor icon because the 192 px
  and maskable entries are gone, that is a package change (an option for
  them), raised as its own small PR.
- **Start:**
  - A `<link rel="modulepreload">` for the editor chunk, from a small
    `transformIndexHtml` plugin in `vite.config.ts`.
  - Ask for the front note alongside `/auth/me`: remember the last
    account id and front note id on the device, make the `QueryClient`
    in `main.tsx` (`FoundationProviders` takes one) and prefetch that
    note before rendering. A 401 ends the session as usual.
  - Load the All Notes screen lazily.
  - Measure before and after on `npm run build:real` behind the real
    backend if one is running, else on the mock build, and write the
    numbers in the app's README.
  - A spec: type the moment New Note is pressed and the moment a note
    opens cold; every character is in the saved note (needs F2).
- **Phone,** at 393 px (`mobile-chrome`): the strip scrolls, close
  targets are finger-sized, renaming works without a double-click, the
  editor's keyboard bar and the strip do not fight, All Notes reads
  well. Fix what is the app's; raise what is the package's.
- **README "Install":** Edge or Chrome, Install as app, pin to the
  taskbar, the Start-menu shortcut's "Shortcut key" (its Properties).
- **For the developer** (`docs/BLOCKERS.md`): whether Ctrl+T, Ctrl+W and
  Ctrl+Tab reach the page in the installed window, and how the icon
  looks on the taskbar. Nothing here can install a PWA.
- **Done when:** `npm run verify` passes with the new specs.

### A6: App, Deploy

- **After A2 and A3.**
- **Files,** each from its Palm Date Book model
  (`C:\Repos\palm-datebook`):
  - `Dockerfile` (`TOTP_ISSUER="Quick Jot"`; `pip install "./backend"`
    with no `[push]`), `.dockerignore`.
  - `deploy/unraid/compose.yml`: names `quick-jot`; keep the database,
    seed account, `COOKIE_SECURE`, `CLIENT_IP_HEADER`, error reporting,
    the healthcheck and the pinned `cloudflared`; drop the push and
    VAPID lines; `JOBS_ENABLED: "false"`; MCP off unless decision 4 says
    otherwise.
  - `deploy/unraid/.env.example`, `deploy/unraid/update-quick-jot.sh`
    (project `quick_jot`, database `quick_jot`).
  - `scripts/publish-image.mjs` and `"publish:image"`;
    `buildInfo({ repoUrl })`.
  - `docs/deploy.md` "This App on the Home Server".
- **In Homebase** (`C:\Repos\homebase`, its own PR): the `quick_jot`
  database and role, copying every `palm_datebook` line in
  `deploy/home-lab/` (`initdb/10-create-databases.sh`, `compose.yml`,
  `.env.example`, `backup/backup.sh`, `backup/restore-drill.sh`, the
  four user scripts). `docs/home-lab.md` "Add an app's database" is the
  runbook.
- **Blocked on the developer,** one `docs/BLOCKERS.md` item with these
  in order: create `Tristan2828/quick-jot` and push; `gh auth refresh -s
  write:packages` and `npm run publish:image` where Docker runs; make
  the package public; merge the Homebase PR and copy the home-lab files
  to the server; add the database password and create the database;
  a Cloudflare tunnel and hostname; the stack and its `.env` in Compose
  Manager; Compose Up; backup and restore drill; a smoke test on a
  phone; TOTP; install and pin.
- **Not verifiable here:** the image build and start, `publish:image`,
  the stack on Unraid, Cloudflare. Say so.
- **Done when:** the files are in, `npm run build:real` passes, the
  blocker is written. The phone requirement is met only once the
  developer has deployed.

### A7: Upgrade, Use It, Report

- **After everything is merged and released.**
- The app on the released package and backend pin
  (`npm install @tristan2828/ui-foundation@<version>`,
  `npx ui-foundation sync`), `tabStaysInText` and `autoFocus="end"` on
  the note, `npm ci`, full `npm run verify` and `npm run verify:backend`.
  No tarball anywhere.
- **Use it like Notepad for an hour** on the built app and write down
  what is rough: a long note (typing speed against R11, the pinned save
  line), paste from Word, Notion and a web page, a checklist, a table, a
  code block, a callout, toggle headings with the outline, find in page,
  a link, two windows on one note, pictures, the phone's keyboard bar.
  Each finding: fixed in the package if generic and in scope, else a
  `DEFERRED.md` row with a revisit condition. Check each `DEFERRED.md`
  row listed above against what was seen.
- **Report to the developer,** in the brief's three parts: what the app
  does and how to install and launch it; every package change that came
  out of it and why; what is left in the rich text and Markdown and
  where it is recorded.
- Delete this file.

## Decisions Still Open

The planner went ahead with a default on each. A worker who touches one
copies it into `docs/BLOCKERS.md` in their PR.

1. **Name and folder.** `quick-jot` in `C:\Repos`. Renaming later means
   the folder, `package.json`, `pwa()`, the storage key, the image and
   the database.
2. **A name is the note's, not the device's.** A renamed tab shows that
   name on every device and in All Notes, since it is saved on the note.
   Keeping names per device would mean no field and no search by name.
3. **No sign-up page,** and public sign-up removed from the backend.
4. **AI chats (MCP) off in the deploy.** The Note entity is registered
   for it; turning it on is two lines in the stack.
5. **Closing an empty note deletes it** (soft, no toast).
6. **Ctrl+S saves now in every autosaving value,** in every app (F2,
   R7). It only replaces the browser's Save Page dialog.
7. **Leading spaces are trimmed on save,** in every app (F2, R3). An
   indent typed at a paragraph's start shows until the note is next
   opened, then is gone, as a trailing space already is.
8. **Blank lines are not kept** (R6): recorded, not fixed.
9. **Tabs stay app code.**
