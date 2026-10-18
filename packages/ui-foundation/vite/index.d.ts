import type { Plugin } from 'vite'

export type BuildInfoOptions = {
  /** The app's repository, e.g. `https://github.com/me/app`. `BUILD_REPO_URL` wins over it. */
  repoUrl?: string
  /**
   * The Alembic versions folder, from the Vite root (`backend/migrations/versions`).
   * Adds `schema`, the head revision, to `build-info.json`; no head or
   * several fails the build.
   */
  alembic?: string
  /**
   * More fields for `build-info.json`, merged in. `api`, `commit`, `pr`,
   * `builtAt` and `schema` are the plugin's own: returning one fails the build.
   */
  extra?: () => Record<string, unknown>
}

/**
 * On `vite build`, writes `dist/build-info.json` (`api`: "real" or "mock",
 * `commit`, `pr`, `builtAt`, and `schema` with `alembic`) and sets
 * `import.meta.env.VITE_BUILD_COMMIT`, `VITE_BUILD_PR` and
 * `VITE_BUILD_REPO_URL` from `BUILD_COMMIT`, `BUILD_PR` and
 * `BUILD_REPO_URL`.
 */
export default function buildInfo(options?: BuildInfoOptions): Plugin
