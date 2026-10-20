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

export type PwaOptions = {
  /** The app's name, as the Home Screen and the install prompt show it. */
  name: string
  /** A shorter one for under the icon. Defaults to `name`; its first letter is the SVG icon's. */
  shortName?: string
  description?: string
  /** `#rrggbb`. Defaults to the package's `--primary` token. */
  themeColor?: string
  /** The letter's colour on the SVG icon, `#rrggbb`. Defaults to `--primary-foreground`. */
  themeForegroundColor?: string
  /** The splash screen's, `#rrggbb`. Defaults to `--background`. */
  backgroundColor?: string
  /**
   * The app's own icon, a square PNG of at least 512×512 (path from the Vite
   * root). Replaces the generated ones everywhere.
   */
  icon?: string
}

/**
 * Makes the app installable and receives reminders: serves and builds
 * `/manifest.webmanifest`, `/icons/*` and `/push-sw.js` (the service worker
 * usePushPermission registers), and adds the manifest, theme-color and
 * apple-touch-icon tags to index.html.
 */
export function pwa(options: PwaOptions): Plugin
