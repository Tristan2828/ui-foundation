# Patched-combobox guard and the drift check (2026-09-28)

The two `DEFERRED.md` rows marked "next session in this repo", in the order
they asked for: protect the patched `combobox.tsx`, then ship the Game List
app's drift check to every app. Two stacked PRs.

## What shipped

| Branch | What |
|---|---|
| `fix/protect-patched-combobox` | `combobox` out of `starter`'s `registryDependencies`; a vitest guard against any shipped primitive also being a registry dependency; `consume-test.sh` compares `combobox.tsx` and `use-mobile.ts` too; `registry-paths-changed.mjs` counts `registry.json` itself |
| `feat/foundation-drift-check` (stacked) | `scripts/check-foundation-drift.mjs` in `starter`, `foundation.json` written by `create-app.sh`, a `check:foundation` Step 0 script, upgrade steps in `consuming.md`, and a fresh-app in-sync assertion (with a negative control) in `consume-test.sh` |

## Deviations, and things the next session should not re-derive

**The combobox risk was real in shape but not live today.** The DEFERRED
row asked for this negative control: re-add the dependency and watch the
comparison fail. It didn't fail. With `combobox` both a
`registryDependency` and a shipped file, the install still ended up with
the patched copy, because shadcn writes the item's own files after its
dependencies. So the risk depends on install order, not a current defect.
The fix stands (it removes the reliance on an ordering nobody promised),
but the negative control that actually proves the comparison works drops
the file from `starter` so that upstream's copy is what arrives. That run
failed on exactly `combobox.tsx`, as it should.

**A release-pipeline gap, found by the fix itself.** The first PR changes
only `registry.json`, and `registry-paths-changed.mjs` never counted
`registry.json` as shipped. That PR would have skipped its install test
and never been tagged, so a fix to what consumers install would never have
reached them. Confirmed by running the old script against the branch
(empty output) and the new one (`registry.json`).

**The drift script's maps moved to `foundation.json`.** In the Game List
app the `APP_OWNED`/`REMOVED`/`FORKED` maps live inside the script. Shipped
that way, every app would have to edit the script, and the script would
report itself as drifted. The config file is never shipped, so a release
can't overwrite it. The row's other options were a `components.json` field
or a `.foundation-version` file; a dotfile can't ship, and `components.json`
belongs to shadcn.

**Files are keyed by install target, not source path.** The original keyed
by `file.path`, so `.codex/skills/new-entity/SKILL.md` (a second target for
the same source) was never compared. Run against the Game List app, the new
version finds that copy stale: it still has `disable-model-invocation:
true` (removed here in 2.1.1) and points at the app's `docs/PLAN.md`. That's
a finding for that app, not fixed from here.

**The NOT IMPORTED sweep is informational.** Checked against the Game List
app at `cfe83d3`, the commit before it wired up `PasswordInput`: the sweep
flags exactly `password-input.tsx`, the one module that app's own corrected
sweep found. At `6fd8820`, after the fix, it flags nothing. Against this
repo it flags nothing either. It resolves `@/` and relative specifiers,
including `index` files and dynamic `import()`, counts importers in `src/`,
`tests/`, `e2e/` and root config files, ignores stories, and treats
`src/main.tsx` as an entry point. Known limit: a module reached only
through a string (a vitest `setupFiles` path, say) would read as unused.
Nothing shipped is reached that way today.

**Not in `verify`**, as the row suggested: a declared fork is legitimate,
and being behind is not a build failure. It exits 1 on DRIFTED or MISSING,
so it can become a gate later without changing the script.

## Verification

- `npm run verify` on the stacked branch: 66 vitest, 73 Playwright
  (1 skipped, pre-existing), 12 Storybook checks.
- `consume-test.sh --install-only` on the combobox fix SHA passed. Two
  negative controls: re-adding the dependency still passed (see above);
  shipping upstream's file failed on `combobox.tsx`.
- `consume-test.sh --install-only` on the drift-check SHA: a fresh app reads
  as in sync, and appending a line to a shipped hook makes the check fail.
- New vitest guard negative-controlled: re-adding `combobox` fails it.

## For the next session

- The Game List app can now drop its own copy of the script for the shipped
  one. Its maps translate directly into `foundation.json` (this session did
  exactly that in a throwaway worktree). It should also take the current
  `.codex` SKILL.md.
- Apps created before this release have no `foundation.json`;
  `consuming.md` says how to create one.
