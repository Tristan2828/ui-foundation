# Audit Phase D — Consumer Lifecycle Docs + Data-Table Behavior (2026-09-18)

Fourth of five remediation phases — see `docs/AUDIT-2026-09-18.md`. Branch
`fix/consumer-lifecycle-and-table`. Registry-shipped files changed, so
this needs a tag after merge.

## What was built

- **`docs/consuming.md`** — install once and own the files; which files
  are app-owned vs. foundation-owned; how to take a later release without
  `--overwrite` (compare link → `add --dry-run` → `add --diff <path>` per
  foundation-owned file → verify); how to get `backend/` from a tag's
  tarball; and that `/new-entity` covers the frontend only. Every command
  in it was run for real: `--dry-run`/`--diff` against `starter#v1.8.0`
  (they list/diff correctly), the `curl | tar` backend extraction against
  `v1.9.0`. README and the shipped `AGENTS.md` link it — the latter so an
  agent in a consuming app asked to "update the foundation" doesn't
  reach for `--overwrite`.
- **Table state in the URL** — `src/hooks/use-table-url-state.ts`: page,
  sort and filters as `?page=2&sort=name:asc&search=…`, `replace: true`.
  Survives the edit-form round trip, refresh and shared links.
- **Debounced search** — `src/hooks/use-debounced-value.ts`; the input
  stays live, the request waits 300 ms.
- **`DataTable` clamps a page past the end** (stale link, or deleting the
  last row on the last page) to the real last page instead of showing
  "No widgets yet" — in the composite, so every entity gets it.
- **`aria-sort`** on sortable column headers.

## Deviations

- **`AppError` 403/409 kinds were not built** — moved to
  `docs/DEFERRED.md`. Nothing in this stack returns either status
  (another user's widget is a deliberate 404; a duplicate email is a 422),
  so adding them would be speculative scope. Revisit when a backend does.

## Evidence

- `npm run verify`: 55 vitest, 67 Playwright (3 new table tests plus
  `aria-sort` assertions).
- Negative controls: with the debounce at 0 ms the search test sees 5
  requests instead of 1; with the clamp disabled the past-the-end test
  never shows rows.
- Dogfood evidence is in the PR.

## What the next session needs to know

- After merge: tag `v1.10.0`, `consume-test.sh --install-only v1.10.0`,
  README tag.
- Next is **Phase E — pruning**, the last one. It moves files the others
  touched, which is why it's last.
