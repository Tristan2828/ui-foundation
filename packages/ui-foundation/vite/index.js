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
// - with `alembic` (the migrations' versions folder, from the Vite root),
//   adds `schema`: the head revision the backend migrates to. Read from the
//   files, so the build needs no Python. No head, or several, fails the
//   build, as `alembic upgrade head` would refuse at start.
// - with `extra`, merges what it returns into the file. It can't replace the
//   fields above: the backend's production check reads `api`.
//
// Build only: in development the three are undefined. Plain JavaScript, like
// the eslint entry: Vite loads the config before any TypeScript tooling runs.

import fs from 'node:fs'
import path from 'node:path'

export { pwa } from './pwa.js'

const OWN_FIELDS = ['api', 'commit', 'pr', 'builtAt', 'schema']

/** @param {string | undefined} value */
function clean(value) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

// `revision = "abc"` or `revision: str = "abc"`, as Alembic writes them.
const REVISION = /^revision(?:\s*:[^=\n]+)?\s*=\s*(['"])([^'"]+)\1/m
// None, one revision, or a tuple of them (a merge), possibly over lines.
const DOWN_REVISION = /^down_revision(?:\s*:[^=\n]+)?\s*=\s*(\([^)]*\)|[^\n]*)/m

/**
 * The one revision no other migration names as its down_revision.
 * @param {string} dir
 */
function alembicHead(dir) {
  if (!fs.existsSync(dir)) throw new Error(`buildInfo: no Alembic versions folder at ${dir}.`)
  const revisions = new Set()
  const downs = new Set()
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.py'))) {
    const source = fs.readFileSync(path.join(dir, file), 'utf8')
    const revision = REVISION.exec(source)
    if (!revision) continue
    revisions.add(revision[2])
    const down = DOWN_REVISION.exec(source)?.[1] ?? ''
    for (const [, , name] of down.matchAll(/(['"])([^'"]+)\1/g)) downs.add(name)
  }
  const heads = [...revisions].filter((revision) => !downs.has(revision)).sort()
  if (heads.length === 1) return heads[0]
  throw new Error(
    heads.length === 0
      ? `buildInfo: no Alembic head in ${dir} (no migrations, or they form a loop).`
      : `buildInfo: several Alembic heads in ${dir} (${heads.join(', ')}); alembic upgrade head would refuse. Merge them first.`,
  )
}

/**
 * @param {{
 *   repoUrl?: string,
 *   alembic?: string,
 *   extra?: () => Record<string, unknown>,
 * }} [options]
 */
export default function buildInfo(options = {}) {
  const commit = clean(process.env.BUILD_COMMIT)
  const pr = clean(process.env.BUILD_PR)
  const repoUrl = clean(process.env.BUILD_REPO_URL) ?? clean(options.repoUrl)
  let api = 'mock'
  let root = process.cwd()
  /** @type {Record<string, unknown>} */
  let fields = {}

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
      root = config.root
    },
    // Read before bundling, so a bad migration chain fails the build early.
    buildStart() {
      fields = {}
      if (options.alembic) fields.schema = alembicHead(path.resolve(root, options.alembic))
      if (options.extra) {
        const extra = options.extra()
        const taken = Object.keys(extra).filter((key) => OWN_FIELDS.includes(key))
        if (taken.length > 0) {
          throw new Error(`buildInfo: extra can't set ${taken.join(', ')}; build-info.json's own fields.`)
        }
        Object.assign(fields, extra)
      }
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'build-info.json',
        source: `${JSON.stringify({ api, commit, pr, builtAt: new Date().toISOString(), ...fields }, null, 2)}\n`,
      })
    },
  }
}
