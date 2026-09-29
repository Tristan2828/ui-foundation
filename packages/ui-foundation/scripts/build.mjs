#!/usr/bin/env node
// Builds dist/: tsc emits JavaScript and declarations, then every import
// specifier in the output is made resolvable outside this package's own
// tooling. tsc leaves specifiers exactly as written, so without this step
// dist/ would still say `@/components/ui/button` (an alias only this
// package's tsconfig and Vite config know) and `./auth-context` (no
// extension, which Node's ESM loader — and so Playwright — refuses).
//
// Rewrites, in .js and .d.ts alike:
//   '@/x/y'   -> './relative/path/x/y.js'
//   './x'     -> './x.js' or './x/index.js', whichever exists
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')

rmSync(dist, { recursive: true, force: true })

const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc')
const result = spawnSync(process.execPath, [tsc, '-p', path.join(root, 'tsconfig.build.json')], {
  stdio: 'inherit',
})
if (result.status !== 0) process.exit(result.status ?? 1)

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) yield* walk(full)
    else yield full
  }
}

// Resolves an emitted specifier to the .js file it means, relative to the
// importing file. Declarations resolve through the same .js path: a .d.ts
// next to it is what TypeScript picks up.
function resolveSpecifier(fromFile, specifier) {
  let target
  if (specifier.startsWith('@/')) target = path.join(dist, specifier.slice(2))
  else if (specifier.startsWith('./') || specifier.startsWith('../')) target = path.resolve(path.dirname(fromFile), specifier)
  else return null

  if (/\.(js|css|json)$/.test(target) && existsSync(target)) return null
  const candidates = [`${target}.js`, path.join(target, 'index.js')]
  const found = candidates.find((candidate) => existsSync(candidate))
  if (!found) throw new Error(`build: cannot resolve '${specifier}' from ${path.relative(root, fromFile)}`)

  let relative = path.relative(path.dirname(fromFile), found).split(path.sep).join('/')
  if (!relative.startsWith('.')) relative = `./${relative}`
  return relative
}

// `from '…'`, `import '…'` and `import('…')` — the only three places a
// specifier appears in tsc output.
const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"]+)\2/g

let rewritten = 0
for (const file of walk(dist)) {
  if (!file.endsWith('.js') && !file.endsWith('.d.ts')) continue
  const source = readFileSync(file, 'utf8')
  const output = source.replace(SPECIFIER, (match, prefix, quote, specifier) => {
    const resolved = resolveSpecifier(file, specifier)
    if (resolved === null) return match
    rewritten++
    return `${prefix}${quote}${resolved}${quote}`
  })
  if (output !== source) writeFileSync(file, output)
}

console.log(`build: dist/ written, ${rewritten} import specifiers made resolvable`)
