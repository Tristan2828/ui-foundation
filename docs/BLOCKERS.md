# Blockers

Open items that couldn't be resolved within a session's scope, or that need
a human decision made in `docs/OPERATOR.md` terms. Resolved items are
removed once fixed — this file is a queue, not a log.

## `spec-tester` cannot be invoked as a real isolated subagent in this harness

**What:** `.claude/agents/spec-tester.md` exists (since Phase 0) with its
deny-hook declared in its own frontmatter, per the plan's explicit warning
that subagents don't inherit `.claude/settings.json` hooks. But the Claude
session used for Phases 0-2 runs inside a harness with a fixed built-in
agent roster (`claude`, `claude-code-guide`, `Explore`, `general-purpose`,
`Plan`, `statusline-setup`) that does not discover project-level
`.claude/agents/*.md` files at all — confirmed via the `claude-code-guide`
agent in Phase 2. This is not a project misconfiguration; it's a property
of this specific harness (not stock Claude Code CLI).

**Why it matters:** `spec-tester`'s whole value is context isolation — an
agent that mechanically cannot read `src/api/gateway/` or
`src/api/transport/` while writing tests against `openapi.yaml`. Without
being able to invoke it, that guarantee has no enforcer in this harness.

**What was done instead (Phase 2):** temporal isolation. The Phase 2
gateway tests (`tests/gateway/*.test.ts`) were written by a fresh
`general-purpose` agent, with no memory of this session, given only
`openapi.yaml`, `src/api/contracts.ts`, and `src/api/schema.d.ts`, and
instructed not to read anything under `src/api/gateway/` or
`src/api/transport/` — which at the time contained only `.gitkeep`
placeholders, so there was nothing to read even if it had tried. This is
weaker than context isolation (nothing mechanically prevents a future
session's test-writer from peeking) but was judged sufficient for now; see
`docs/phases/phase-2.md`.

**What needs a human decision:** whether to run Phase 0's optional-tier
unattended loop (`scripts/run-phase.sh`) at all in this harness, since it
assumes stock Claude Code's `Task` tool with custom subagents. If the
answer is "run phases from a stock Claude Code CLI session instead," this
blocker likely resolves itself the next time `.claude/agents/spec-tester.md`
is invoked from that environment — confirm with the same refusal test
described in `docs/phases/phase-0.md` before trusting it.
