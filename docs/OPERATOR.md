# Operator Notes

The judgment calls that are yours, not an agent's: what's worth building,
when to say no, and how to respond when a session goes sideways. What gets
built and what waits is set in [`DEFERRED.md`](DEFERRED.md) "Direction".
How the repo works is [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Saying no to structure work

- **The test for new structure:** has a real app hit the need? If not, it's
  a row in `DEFERRED.md` with a revisit condition, not code. An agent
  proposing "while we're here…" structure is the building-forever failure
  mode. Design-language work doesn't take this test.
- **An app's finding counts as a real need.** When an app works around the
  package, bring the workaround here as a prop, slot or fix: port the app's
  working version, don't redesign it. Rows whose revisit condition is "next
  time X is touched" won't be picked up by an agent on its own. To do one
  now, hand it over as the session's named task.
- **Before an app is reachable by strangers:** login rate limiting and
  error reporting (`DEFERRED.md`, the app's `docs/deploy.md`). Not before.

## Decisions that are yours

- **Releases go live when you approve them.** Every merge that touches the
  package or the template stages a version on npm. Approve it with your
  passkey on npmjs.com (the package → Staged Packages), then run the
  `release-smoke` workflow for its tag (`ARCHITECTURE.md` "Releasing").
  Approving is the moment to look at the result. Reject a release you
  don't want apps to get.
- **Versions.** Patch versions are picked automatically. A minor or major release is
  a version bump in `packages/ui-foundation/package.json`, made in the PR.
  Anything that breaks an app's code or its synced files is a major, with a
  `CHANGELOG.md` entry and upgrade steps. When an agent's change looks
  breaking, decide whether it's worth a major or should be made additive.
- **When an app upgrades.** Nothing upgrades an app behind its back. It
  moves when someone runs `npm install …@<version> && npx ui-foundation
  sync`. Upgrading each app regularly is what keeps the shared code shared.
- **New dependencies.** An agent that needs one writes the case in
  `docs/BLOCKERS.md` and stops. Decide in allowlist terms: the package has
  `packages/ui-foundation/deps-allowlist.json`, each app has its own (the
  Python side has no enforcer yet). Expect auto-mode to refuse the install
  itself; you run it.
- **Secrets.** Database passwords, tokens and API keys never go in a chat
  with an agent. Write them to the gitignored `backend/.env` yourself.
  Publishing to npm needs no token (trusted publishing, staging only), and
  approving needs your passkey. Keep it that way: never create an npm
  access token for CI.
- **Merging.** `main` requires no review and no passing checks (force-pushes
  and deletion are still blocked), so you can push to it directly or merge
  a PR yourself. Every push to `main` that touches the package or the
  template stages a release. A direct push skips the PR-only install test,
  so changes there are safer as a PR.

## When a session goes sideways

- **Work declared complete without a green gate:** don't accept it. Point
  it back at `npm run verify` (plus `npm run verify:backend` and
  `template/scripts/check-backend-postgres.sh` for backend changes). A Fresh
  UI Build PASS only counts after checking its transcript used the version
  you meant to test.
- **A gate is permanently red** (a check that only passes on one OS, for
  example — why the pixel screenshot baselines were retired): fix the gate
  before anything else. A gate that's always red teaches the agent to
  ignore it.
- **The agent disables or works around a check to get green:** revert that
  change. The check is right.
- **An app copies a package file to change it:** lint should already have
  stopped it. If it didn't, that's a gap in the lint rules, so fix it here.
  Then turn the change into a prop, a slot or a release.
- **The same failure keeps recurring across sessions:** read
  `docs/BLOCKERS.md` and the relevant PRs before another attempt. It
  usually needs a decision from you, not more agent time.
