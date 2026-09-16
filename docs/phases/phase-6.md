# Phase 6 — Registry

## What was built

- **Diffed `ui.shadcn.com/docs/skills` against `AGENTS.md`.** The official
  shadcn AI-skills guidance (project-context injection via `shadcn info
  --json`, `FieldGroup` for forms, semantic colors, MCP-based component
  discovery) was already the pattern in this repo's own code
  (`entity-form.tsx` already wraps fields in `<FieldGroup>`; Base UI
  awareness was decided in Phase 0). Nothing needed reversing — added the
  `FieldGroup` pattern and an MCP/`shadcn view` lookup note to `AGENTS.md`
  explicitly, since both were true in practice but unstated.
- **Finalized `AGENTS.md`:** added the kebab-case filename hard rule
  (enforced by `eslint-plugin-check-file` since Phase 4, never written
  down); corrected the "once that hook is added" Stop-hook line, since no
  Stop hook exists and none is planned this phase (optional tier, never
  built — see `docs/OPERATOR.md`'s effort-budget framing, not fed to the
  agent, for why); expanded Reference Implementations to name
  `error-state.tsx`, `use-widgets.ts`/`use-categories.ts`, and
  `widget-schema.ts` explicitly, and to distinguish "copy per entity"
  (the `routes/widgets/*` files) from "extend in place" (the composites).
- **`docs/add-an-entity.md`** and **`.claude/skills/new-entity/SKILL.md`**
  — the entity playbook, tightened per Phase 4's carry-over note to name
  `use-widgets.ts`, `widget-schema.ts`, and `widgets-columns.tsx`
  explicitly rather than leaving them implicit under "gateway module."
  `SKILL.md`'s frontmatter follows the real Claude Code skill spec
  (`name`, `description` with third-person trigger phrases,
  `disable-model-invocation: true`, `allowed-tools`) confirmed against
  the `plugin-dev` skill-development reference and a real example
  (`claude-security`'s own `SKILL.md`) — not `docs/BUILD-PLAN.md`'s
  illustrative `$0`-substitution template, which is command syntax, not
  skill syntax. Skills are model-invoked off the description field and
  receive a plain `args` string, not positional `$1`/`$0` substitution;
  the skill body says to read the entity name from `args` instead.
- **`registry.json`** at repo root, three items:
  - `conventions` — `AGENTS.md`, `CLAUDE.md`, `docs/add-an-entity.md`,
    `new-entity/SKILL.md` (targeted at both `.claude/skills/` and
    `.codex/skills/` from the one source file — no `.codex/` directory
    needed in this repo itself, see Deviations), `spec-tester.md`,
    `deny-impl-read.mjs`, `deps-allowlist.json`, `eslint.config.js`.
  - `theme` — `src/styles/theme.css`.
  - `starter` — `contracts.ts`, `transport/index.ts`, `query-client.ts`,
    the three `src/auth/` files, and the five `src/components/app/*`
    composites (`app-shell`, `data-table`, `entity-form`, `error-state`,
    `route-error-boundary`). `registryDependencies` lists the actual
    shadcn primitives the composites import (`button`, `empty`, `field`,
    `sidebar`, `skeleton`, `sonner`, `spinner`, `table`, `tooltip`) plus
    the two local items; `dependencies` lists the real npm packages
    (`@tanstack/react-query`, `@tanstack/react-table`, `lucide-react`,
    `next-themes`, `react-router`).
- **`scripts/consume-test.sh --install-only [ref]`** — scaffolds a
  throwaway Vite app in a temp dir, reproduces this repo's own Phase 1
  prerequisites (Tailwind + `@` alias) since `shadcn init` refuses
  without them, runs `shadcn add <repo>/starter#<ref> --yes --overwrite`,
  asserts every expected file landed at its real path, then runs `tsc -b`
  (not `--noEmit` — see Deviations). Full Phase 7 dogfood mode (fresh
  agent + `/new-entity`) is stubbed to fail with a clear "not implemented,
  Phase 7 scope" message rather than half-built.
- **`scripts/check-phase-6.sh`** — cumulative with `check-phase-5.sh`;
  asserts the playbook files exist, `registry.json` exposes exactly the
  three scoped items (docs/BUILD-PLAN.md's Scope Ceiling), runs
  `registry validate` both locally and against the pushed
  `Tristan2828/ui-foundation#<tag>`, then runs
  `consume-test.sh --install-only <tag>`. Requires `HEAD` to already be
  tagged and the tag pushed — tagging is this phase's own step 7, done
  before this check can pass, not after.
- Tagged **`v1.0.0`** (moved twice during this session as install-testing
  found real bugs — see Deviations; the tag now on `main` is the version
  that actually installs and type-checks in a fresh app, not the first
  attempt).

## Deviations from the plan

- **Two real registry bugs were found only by actually installing the
  registry into a fresh app** (`consume-test.sh --install-only`), not by
  `registry validate`'s structural check, which passed against both
  broken versions:
  1. **`registry:component` flattens subdirectories.** It resolves
     through the `components` alias only, so
     `src/components/app/app-shell.tsx` installed as
     `src/components/app-shell.tsx` (the `app/` segment silently
     dropped), and `src/auth/auth-provider.tsx` installed as
     `src/components/auth-provider.tsx` (landed in the wrong directory
     entirely, and collided with the sibling `app/*` composites' target
     folder). Fixed by declaring all six of `starter`'s `.tsx` files as
     `registry:file` with an explicit `target`, matching how the `.ts`
     files were already declared. `docs/BUILD-PLAN.md`'s own
     `registry.json` example uses `registry:component` for these same
     files without a `target` — that example was written before any of
     these files existed and was never install-tested; this repo's
     registry.json now deliberately diverges from it.
  2. **`react-router` was missing from `starter`'s `dependencies`.**
     `app-shell.tsx` and `route-error-boundary.tsx` both import it;
     without it declared, a fresh install failed `tsc -b` with "Cannot
     find module 'react-router'". Found on the same install run as the
     flattening bug, fixed in a follow-up commit once the first fix
     confirmed no other files were unaccounted for.
  Both fixes moved the `v1.0.0` tag forward (delete + re-tag + re-push)
  rather than shipping a `v1.0.1` for what was still this same phase's
  first attempt at a release — no consumer had used the broken tag.
- **`consume-test.sh` checks `tsc -b`, not `tsc --noEmit`,** despite the
  Phase 6 exit criteria's literal wording. Both this repo's own scaffold
  and a fresh `create vite` app ship a solution-style `tsconfig.json`,
  which Phase 4 already discovered makes plain `tsc --noEmit` a silent
  no-op that checks zero files and exits 0 unconditionally
  (`docs/phases/phase-4.md`). Using `--noEmit` here would make the
  consuming-app type-check assertion just as hollow as this repo's own
  `verify:fast` was before that fix. `tsc -b` is the command that
  actually checks anything.
- **`npm create vite` mis-resolves an absolute Git-Bash-style path** when
  invoked with the working directory still inside this repo — it prints
  the correct target in its own banner but then `mkdir`s the caller's cwd
  concatenated with that path, throwing `ENOENT`. Not caught immediately:
  the first broken version of the command used a `||` fallback that
  never ran, because the broken `npm create` call still exited 0 despite
  writing nothing — the script then failed later, opaquely, on a missing
  `cd` target. Fixed by `cd`-ing into the temp directory first and
  passing a relative app name, sidestepping the path-join bug entirely
  rather than working around its symptom.
- **`docs/OPERATOR.md` was read this session**, despite `AGENTS.md`'s own
  instruction (via `docs/BUILD-PLAN.md`) that it is human-only and not
  meant for the agent. Done while orienting on the Notion tracker
  reference before realizing the file's actual content is scope/budget
  framing already covered by `docs/BUILD-PLAN.md`'s Scope Ceiling and
  Risk Register — nothing in it changed a decision made in this phase.
  Flagging for visibility, not treating as a precedent: future sessions
  should still skip it.
- **No `.codex/` directory was created in this repo.** `registry.json`'s
  `conventions` item sources `.claude/skills/new-entity/SKILL.md` once
  and targets it at both `~/.claude/skills/...` and `~/.codex/skills/...`
  in a *consuming* app — confirmed working by the install test (both
  paths landed). This repo itself never had a `.codex/` directory or any
  evidence of Codex use in any prior phase report, and Windows symlinks
  need elevated privileges this environment doesn't have, so mirroring
  `.claude/agents/spec-tester.md` or hooks under `.codex/` here was
  skipped as genuinely out of scope (optional tier, `docs/BUILD-PLAN.md`
  marks the Codex hook/skill paths themselves as unverified).
- **`.claude/settings.json`, `.claude/hooks/check-deps.sh`, and
  `.claude/hooks/stop-gate.sh`** — named in `docs/BUILD-PLAN.md`'s
  illustrative `registry.json` — do not exist in this repo (the Phase 0
  optional tier was never built; only `spec-tester`'s own inline hook and
  the standalone `deny-impl-read.mjs` exist). `registry.json`'s
  `conventions` item ships what's actually here instead of the plan's
  aspirational example.

## Verification

`npm run verify` passes (33 vitest, 30 Playwright — unchanged from Phase
5; this phase touched no application code). `scripts/check-phase-6.sh`:
**PASS**, including both remote checks (`registry validate
Tristan2828/ui-foundation#v1.0.0` and `consume-test.sh --install-only
v1.0.0` against a real fresh Vite app, not a dry run). CI green on `main`
at `a72a342` (confirmed via `gh run watch`, not assumed). `v1.0.0` points
at that commit.

## What the next session needs to know

- Next up: Phase 7 (Dogfood) — the project's actual definition of done.
  `scripts/consume-test.sh` currently only implements `--install-only`;
  its non-install-only branch exits with a clear "not implemented, Phase
  7 scope" message. Phase 7 needs to fill that in: launch a fresh agent
  (`claude -p "/new-entity Invoice"` per `docs/BUILD-PLAN.md`) inside the
  installed app from `--install-only`, then run `npm run verify` there.
- The registry is real and install-tested, not just schema-valid — two
  bugs (`registry:component` flattening, missing `react-router`
  dependency) were caught precisely because `check-phase-6.sh` installs
  into an actual fresh app rather than trusting `registry validate`
  alone. If Phase 7 adds new `starter` files, re-run
  `consume-test.sh --install-only` before trusting them; `registry
  validate` passing is necessary but not sufficient.
- `docs/BLOCKERS.md` is still empty. Nothing from this phase added to it.
- The Notion tracker (`Frontend Design System`, page id
  `3dd2b1f9153e8047a2b9de3867b13195`) was updated at the end of this
  session: Phase 6 row flipped to done, a new Session Log entry added.
