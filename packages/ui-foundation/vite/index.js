// `@tristan2828/ui-foundation/vite` — what a production build says about
// itself. An app's vite.config.ts:
//
//   import buildInfo from '@tristan2828/ui-foundation/vite'
//   plugins: [react(), tailwindcss(), buildInfo({ repoUrl: 'https://github.com/me/app' })]
//
// On `vite build` it:
// - writes dist/build-info.json: which API the bundle calls ("real", or
//   "mock" for MSW), and the commit and PR it was built from. The reference
//   backend refuses to serve a mock bundle with APP_ENV=production.
// - sets import.meta.env.VITE_BUILD_COMMIT, VITE_BUILD_PR and
//   VITE_BUILD_REPO_URL from the environment's BUILD_COMMIT, BUILD_PR and
//   BUILD_REPO_URL (the repoUrl option when that's unset), for AppShell's
//   `version`. Unset, they're empty strings and nothing is shown.
//
// Build only: in development the three are undefined. Plain JavaScript, like
// the eslint entry: Vite loads the config before any TypeScript tooling runs.

/** @param {string | undefined} value */
function clean(value) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/** @param {{ repoUrl?: string }} [options] */
export default function buildInfo(options = {}) {
  const commit = clean(process.env.BUILD_COMMIT)
  const pr = clean(process.env.BUILD_PR)
  const repoUrl = clean(process.env.BUILD_REPO_URL) ?? clean(options.repoUrl)
  let api = 'mock'

  return {
    name: 'ui-foundation:build-info',
    apply: 'build',
    config() {
      return {
        define: {
          'import.meta.env.VITE_BUILD_COMMIT': JSON.stringify(commit ?? ''),
          'import.meta.env.VITE_BUILD_PR': JSON.stringify(pr ?? ''),
          'import.meta.env.VITE_BUILD_REPO_URL': JSON.stringify(repoUrl ?? ''),
        },
      }
    },
    configResolved(config) {
      // The same test as the app's main.tsx: anything but "real" ships MSW.
      api = config.env.VITE_API === 'real' ? 'real' : 'mock'
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'build-info.json',
        source: `${JSON.stringify({ api, commit, pr, builtAt: new Date().toISOString() }, null, 2)}\n`,
      })
    },
  }
}
