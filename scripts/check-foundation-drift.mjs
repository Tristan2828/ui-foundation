#!/usr/bin/env node
// Where this app has drifted from the foundation release it is pinned to.
//
// The shadcn model is that installed files are yours — nothing updates
// behind your back. The cost is that divergence is invisible: a file you
// edited locally is a file you now maintain twice, and nothing says so
// until someone reads both copies side by side. The first app built on
// this registry sat on one release through seven more and grew its own
// copies of things the foundation already shipped better; it took a human
// reading both repos to notice.
//
// For every file `starter` ships at the pinned ref, this compares the
// local copy and reports:
//
//   DRIFTED        you changed it. Push the change up to the foundation,
//                  take the release's version, or declare it in `forked`.
//   MISSING        the release ships it and you don't have it. Take it, or
//                  declare it in `removed`.
//   DECLARED FORK  differs on purpose (listed in `forked`, with a reason).
//   NOT IMPORTED   present, but nothing imports it. Informational only:
//                  taking a file is not adopting it, and a content
//                  comparison can't tell the difference — an unused
//                  module reads as perfectly in sync, and neither tsc nor
//                  ESLint flags an unused *module*.
//
// Configuration is `foundation.json` at the project root, which the
// registry never ships (so taking a release can't overwrite it):
//
//   {
//     "tag": "v2.1.9",                       // the release you installed
//     "appOwned": ["src/routes/games/"],     // meant to differ, never reported
//     "removed": { "e2e/smoke.spec.ts": "why it's absent on purpose" },
//     "forked": { "src/main.tsx": "why it differs on purpose" }
//   }
//
// Every `removed`/`forked` entry needs a reason: that is what turns a fork
// into a decision on record instead of an accident nobody remembers.
// Entries ending in `/` match a whole directory.
//
// Usage: node scripts/check-foundation-drift.mjs [ref]
//   `ref` overrides the tag — e.g. a newer release, to preview what
//   taking it would change. Exits 1 on anything DRIFTED or MISSING, 2 if
//   the config or the release can't be read. Not part of `verify`: a fork
//   is legitimate and being behind a release is not a build failure.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { posix } from 'node:path'

const REPO = 'Tristan2828/ui-foundation'
const CONFIG = 'foundation.json'

// Files every app is expected to change — the "you'll edit these" column
// of the foundation's docs/consuming.md, plus what the entity playbook
// edits in place. Never reported.
const DEFAULT_APP_OWNED = [
  'openapi.yaml',
  'deps-allowlist.json',
  'src/App.tsx',
  'src/components/app/app-shell.tsx',
  'src/mocks/handlers.ts',
  'src/mocks/data.ts',
  'tests/mocks/conformance.test.ts',
  'e2e/shell.spec.ts',
  'e2e/a11y.spec.ts',
]

// The Widgets demo, which docs/consuming.md says to delete once the app
// has its own entity. Absent is expected; present is compared as usual.
const DEFAULT_REMOVABLE = [
  'src/routes/widgets/',
  'src/api/gateway/widgets.ts',
  'src/api/gateway/categories.ts',
  'tests/gateway/widgets.test.ts',
  'tests/gateway/categories.test.ts',
  'tests/widget-schema.test.ts',
  'e2e/widget-form.spec.ts',
  'e2e/widgets-table.spec.ts',
  'docs/entities/widget.md',
]

// Loaded by something other than an import: index.html's <script> tag.
const ENTRY_POINTS = ['src/main.tsx']

const fail = (message) => {
  console.error(`check-foundation-drift: ${message}`)
  process.exit(2)
}

const matches = (list, path) => list.some((p) => (p.endsWith('/') ? path.startsWith(p) : path === p))
const matchKey = (map, path) => Object.keys(map).find((p) => matches([p], path))
const normalise = (text) => text.replace(/\r\n/g, '\n').trimEnd()

function readConfig() {
  if (!existsSync(CONFIG)) {
    fail(
      `no ${CONFIG} at the project root. Create one naming the release you installed:\n` +
        `  { "tag": "<tag>", "appOwned": [], "removed": {}, "forked": {} }\n` +
        `(scripts/create-app.sh writes it for a new app; the tag is in your first commit's message).`,
    )
  }
  let config
  try {
    config = JSON.parse(readFileSync(CONFIG, 'utf8'))
  } catch (error) {
    fail(`${CONFIG} is not valid JSON: ${error.message}`)
  }
  const { tag, appOwned = [], removed = {}, forked = {} } = config
  if (typeof tag !== 'string' || tag === '') fail(`${CONFIG} needs a "tag" — the release you installed`)
  if (!Array.isArray(appOwned)) fail(`${CONFIG}: "appOwned" must be an array of paths`)
  for (const [name, map] of [['removed', removed], ['forked', forked]]) {
    for (const [path, reason] of Object.entries(map)) {
      if (typeof reason !== 'string' || reason.trim() === '') {
        fail(`${CONFIG}: "${name}" entry "${path}" has no reason — say why, or remove the entry`)
      }
    }
  }
  return { tag, appOwned, removed, forked }
}

async function fetchText(url) {
  try {
    const response = await fetch(url)
    return response.ok ? await response.text() : null
  } catch {
    return null
  }
}

// --- NOT IMPORTED: which shipped modules does nothing import? ---

const SOURCE = /\.(ts|tsx|mts|js|jsx|mjs)$/
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.claude', 'coverage', 'playwright-report', 'test-results'])

function listSources(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const path = posix.join(dir, name)
    if (statSync(path).isDirectory()) return SKIP_DIRS.has(name) ? [] : listSources(path)
    // Stories aren't shipped and don't mean the app uses a component.
    return SOURCE.test(name) && !name.includes('.stories.') ? [path] : []
  })
}

// Static imports, re-exports, side-effect imports and dynamic import().
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g

function resolveSpecifier(importer, specifier) {
  let base
  if (specifier.startsWith('@/')) base = posix.join('src', specifier.slice(2))
  else if (specifier.startsWith('.')) base = posix.join(posix.dirname(importer), specifier)
  else return null // a package
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

function importedPaths() {
  const importers = [
    ...listSources('src'),
    ...listSources('tests'),
    ...listSources('e2e'),
    ...readdirSync('.').filter((name) => SOURCE.test(name)),
  ]
  const imported = new Set()
  for (const importer of importers) {
    for (const [, specifier] of readFileSync(importer, 'utf8').matchAll(SPECIFIER)) {
      const target = resolveSpecifier(importer, specifier)
      if (target && target !== importer) imported.add(target)
    }
  }
  return imported
}

// --- main ---

const config = readConfig()
const ref = process.argv[2] ?? config.tag
const raw = (path) => `https://raw.githubusercontent.com/${REPO}/${ref}/${path}`
const appOwned = [...DEFAULT_APP_OWNED, ...config.appOwned]

const registryText = await fetchText(raw('registry.json'))
if (!registryText) fail(`can't read registry.json at ${REPO}@${ref} — is "${ref}" a real tag or commit SHA?`)
const starter = JSON.parse(registryText).items.find((item) => item.name === 'starter')
if (!starter) fail(`registry.json at ${ref} has no "starter" item`)

// Keyed by where the file lands in the app, which isn't always its path in
// the foundation repo (SKILL.md is also installed under .codex/).
const shipped = new Map()
for (const file of starter.files) shipped.set(file.target.replace(/^~\//, ''), file.path)

const drifted = []
const missing = []
const forks = []
const staleForks = []
const staleRemoved = []
const unfetchable = []

await Promise.all(
  [...shipped].map(async ([target, source]) => {
    if (matches(appOwned, target)) return
    const removedKey = matchKey(config.removed, target)
    if (!existsSync(target)) {
      if (!removedKey && !matches(DEFAULT_REMOVABLE, target)) missing.push(target)
      return
    }
    if (removedKey && !removedKey.endsWith('/')) staleRemoved.push(target)
    const upstream = await fetchText(raw(source))
    if (upstream === null) {
      unfetchable.push(target)
      return
    }
    const forkKey = matchKey(config.forked, target)
    if (normalise(readFileSync(target, 'utf8')) === normalise(upstream)) {
      if (forkKey && !forkKey.endsWith('/')) staleForks.push(target)
      return
    }
    ;(forkKey ? forks : drifted).push(target)
  }),
)

if (unfetchable.length > 0) {
  fail(`couldn't fetch ${unfetchable.length} file(s) at ${ref} (network?): ${unfetchable.sort().join(', ')}`)
}

const imported = importedPaths()
const notImported = [...shipped.keys()]
  .filter((path) => /^src\/.*\.(ts|tsx)$/.test(path) && !path.endsWith('.d.ts'))
  .filter((path) => existsSync(path) && !ENTRY_POINTS.includes(path) && !imported.has(path))

const report = (label, paths, note, reasons = {}) => {
  if (paths.length === 0) return
  console.log(`\n${label} (${paths.length})`)
  for (const path of paths.sort()) {
    const key = matchKey(reasons, path)
    console.log(`  ${path}${key ? `  — ${reasons[key]}` : ''}`)
  }
  if (note) console.log(`  ${note}`)
}

console.log(`check-foundation-drift: comparing against ${REPO}@${ref}${ref === config.tag ? '' : ` (${CONFIG} pins ${config.tag})`}`)
report('DRIFTED — differs from the release, not declared as a fork', drifted,
  `Push the change up to the foundation, take the release's version, or add it to "forked" in ${CONFIG} with a reason.`)
report('MISSING — the release ships this and this app does not have it', missing,
  `Take it, or add it to "removed" in ${CONFIG} with a reason.`)
report('DECLARED FORKS — differ on purpose', forks, null, config.forked)
report(`STALE ${CONFIG} ENTRIES — declared forked or removed, but identical or present`, [...staleForks, ...staleRemoved],
  `Remove them from ${CONFIG} so the declarations stay true.`)
report('NOT IMPORTED — shipped and present, but nothing imports it (informational)', notImported,
  'Taking a file is not adopting it. Wire it in, or delete it and declare it in "removed".')

// Being behind is the other half of drift, and the one that is silent even
// when every file matches. Best-effort: no network, no line.
const latest = await fetchText(`https://api.github.com/repos/${REPO}/releases/latest`)
const latestTag = latest ? JSON.parse(latest).tag_name : null
if (latestTag && latestTag !== ref) {
  console.log(`\nThe latest foundation release is ${latestTag}. See docs/consuming.md in the foundation, "Taking a later release".`)
}

const failed = drifted.length + missing.length
console.log(failed === 0 ? `\nIn sync with ${ref}.` : `\n${drifted.length} drifted, ${missing.length} missing.`)
process.exit(failed === 0 ? 0 : 1)
