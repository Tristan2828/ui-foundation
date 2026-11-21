// verify.yml runs `npm run verify` in parts, on several runners at once.
// This checks that the parts still add up to the whole, so nothing added
// later runs locally and silently not in CI:
//
// 1. The verify scripts are the ones the parts were cut from. CI runs the
//    package's verify:fast, the template's verify, and the package's
//    verify:harness in three runs (below). A step added to either verify
//    script fails here until verify.yml runs it too.
// 2. The harness split loses no test. CI runs it in three parts that name
//    their projects: the shards ($HARNESS_SHARDED), phone ($HARNESS_PHONE)
//    and perf ($HARNESS_PERF, alone on its runner: it is a CPU-throttled
//    typing budget). A project added to playwright.harness.config.ts and
//    named in none fails here, and so does one named in two.
//
// Run from the repo root after `npm ci`: node .github/scripts/check-ci-split.mjs
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const problems = []

const scripts = (path) => JSON.parse(readFileSync(path, 'utf8')).scripts
const expected = [
  ['package.json', 'verify', 'npm run verify -w @tristan2828/ui-foundation && npm run verify -w template'],
  ['packages/ui-foundation/package.json', 'verify', 'npm run verify:fast && npm run verify:harness'],
]
for (const [path, name, value] of expected) {
  const actual = scripts(path)[name]
  if (actual !== value) {
    problems.push(`${path} "${name}" is ${JSON.stringify(actual)}, not ${JSON.stringify(value)}: verify.yml runs it in parts, so change those parts (and this check) with it.`)
  }
}

const parts = ['HARNESS_SHARDED', 'HARNESS_PHONE', 'HARNESS_PERF'].map((name) => ({
  name,
  args: (process.env[name] ?? '').split(/\s+/).filter(Boolean),
}))
for (const { name, args } of parts) {
  if (args.length === 0) problems.push(`${name} must be set (verify.yml sets it).`)
}

const count = (args) => {
  const result = spawnSync('npx', ['playwright', 'test', '-c', 'playwright.harness.config.ts', '--list', ...args], {
    cwd: 'packages/ui-foundation',
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  const total = /^Total: (\d+) tests? in/m.exec(result.stdout ?? '')
  if (result.status !== 0 || !total) {
    console.error(result.stdout, result.stderr)
    throw new Error(`playwright --list ${args.join(' ')} failed (exit ${result.status})`)
  }
  return Number(total[1])
}

if (problems.length === 0) {
  const all = count([])
  const counted = parts.map((part) => ({ ...part, tests: count(part.args) }))
  const sum = counted.reduce((total, { tests }) => total + tests, 0)
  console.log(`Harness tests: ${all} in all; ${counted.map(({ name, args, tests }) => `${tests} in ${name} (${args.join(' ')})`).join(', ')}.`)
  if (counted.some(({ tests }) => tests === 0) || sum !== all) {
    problems.push(`CI's harness runs list ${sum} tests, but the harness has ${all}: a project is run in none of them, or in two. Fix HARNESS_SHARDED, HARNESS_PHONE or HARNESS_PERF in verify.yml.`)
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`::error::${problem}`)
  process.exit(1)
}
console.log('CI runs every part of npm run verify.')
