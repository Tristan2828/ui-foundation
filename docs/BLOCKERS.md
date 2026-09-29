# Blockers

Open items that couldn't be resolved within a session's scope, or that
need a decision or an action only the developer can take
([`OPERATOR.md`](OPERATOR.md)). An item is removed once it's resolved: this
file is a queue, not a log.

## Open

- **npm: first publish and trusted publishing (developer action).** The
  release workflow publishes `@tristan2828/ui-foundation` through npm's
  trusted publishing. npm allows that only for a package that already
  exists, so 3.0.0 has to be published once by hand, **before the 3.0 PR
  merges**. Steps are in [`ARCHITECTURE.md`](ARCHITECTURE.md) "Releasing" →
  "One-time npm setup". Merged first, the `release` workflow's publish step
  fails (no tag, no release) until this is done. `create-app.sh` can't
  install from npm until then either. The install test on PRs doesn't
  need npm (it packs a tarball), so it is unaffected.
