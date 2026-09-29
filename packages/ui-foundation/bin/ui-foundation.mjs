#!/usr/bin/env node
// The `ui-foundation` command, run from an app's root:
//
//   ui-foundation sync [--check]
//     Writes the foundation's conventions into the app: the rules block in
//     AGENTS.md, docs/foundation/ (the entity playbook and design docs), and
//     the agent files (.claude/, .codex/). --check writes nothing and fails
//     if any of them differ from this installed version, which is how
//     `verify` catches a package upgrade that skipped `sync`, or a synced
//     file edited in the app.
//
//   ui-foundation check-contract [openapi.yaml]
//     Fails unless the app's spec contains the foundation's part of the
//     contract (auth paths, error envelopes) unchanged — the part the
//     package's own code calls.
//
//   ui-foundation check-deps [--allowlist deps-allowlist.json]
//     Fails if package.json names a dependency the allowlist doesn't.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { load as loadYaml } from 'js-yaml'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGE = JSON.parse(readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'))
const APP_ROOT = process.cwd()

const read = (file) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const fail = (message) => {
  console.error(message)
  process.exit(1)
}

// ---------------------------------------------------------------- sync

const BLOCK_START = '<!-- ui-foundation:start'
const BLOCK_END = '<!-- ui-foundation:end -->'
const BLOCK_HEADER = `${BLOCK_START} — synced from ${PACKAGE.name} by \`npx ui-foundation sync\`. Don't edit inside this block: your app's own notes go below it, and a change to the rules belongs in the foundation. -->`

// docs/foundation/ belongs to sync entirely: files the package no longer
// ships are removed from it. Everything else is written file by file.
const DOCS_DIR = 'docs/foundation'

function syncedFiles() {
  const conventions = path.join(PACKAGE_ROOT, 'conventions')
  const files = new Map()
  for (const doc of readdirSync(path.join(conventions, 'docs'))) {
    files.set(`${DOCS_DIR}/${doc}`, read(path.join(conventions, 'docs', doc)))
  }
  const skill = read(path.join(conventions, 'agents/skills/new-entity/SKILL.md'))
  files.set('.claude/skills/new-entity/SKILL.md', skill)
  files.set('.codex/skills/new-entity/SKILL.md', skill)
  files.set('.claude/agents/spec-tester.md', read(path.join(conventions, 'agents/spec-tester.md')))
  files.set('.claude/hooks/deny-impl-read.mjs', read(path.join(conventions, 'agents/deny-impl-read.mjs')))
  return files
}

function agentsBlock() {
  const rules = read(path.join(PACKAGE_ROOT, 'conventions/AGENTS.md')).trimEnd()
  return `${BLOCK_HEADER}\n\n${rules}\n\n${BLOCK_END}`
}

// The app's AGENTS.md with the block replaced (or added, above the app's
// own content, when an older app has none yet).
function agentsMdWithBlock(current) {
  const block = agentsBlock()
  if (current === null) {
    return `${block}\n\n## This app\n\nWhat this app is, and anything an agent needs that the rules above don't cover.\n`
  }
  const start = current.indexOf(BLOCK_START)
  const end = current.indexOf(BLOCK_END)
  if (start === -1 || end === -1) return `${block}\n\n${current.trimStart()}`
  return current.slice(0, start) + block + current.slice(end + BLOCK_END.length)
}

function sync({ check }) {
  const problems = []
  const write = (relative, content) => {
    const target = path.join(APP_ROOT, relative)
    const current = existsSync(target) ? read(target) : null
    if (current === content) return
    if (check) {
      problems.push(`${current === null ? 'missing' : 'differs'}: ${relative}`)
      return
    }
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, content)
    console.log(`sync: wrote ${relative}`)
  }

  const files = syncedFiles()
  for (const [relative, content] of files) write(relative, content)

  const docsDir = path.join(APP_ROOT, DOCS_DIR)
  if (existsSync(docsDir)) {
    for (const file of readdirSync(docsDir)) {
      const relative = `${DOCS_DIR}/${file}`
      if (files.has(relative)) continue
      if (check) problems.push(`no longer shipped: ${relative}`)
      else {
        rmSync(path.join(docsDir, file), { recursive: true })
        console.log(`sync: removed ${relative}`)
      }
    }
  }

  const agentsPath = path.join(APP_ROOT, 'AGENTS.md')
  const agents = existsSync(agentsPath) ? read(agentsPath) : null
  if (check && agents !== null && !agents.includes(BLOCK_START)) {
    problems.push('AGENTS.md has no ui-foundation block')
  } else {
    write('AGENTS.md', agentsMdWithBlock(agents))
  }
  if (agents !== null && !agents.includes(BLOCK_START) && !check) {
    console.log(
      'sync: AGENTS.md had no foundation block; added one at the top. Delete any older copy of the foundation rules below it.',
    )
  }

  // Claude Code reads CLAUDE.md, which imports AGENTS.md. Created once;
  // the app may add to it.
  if (!existsSync(path.join(APP_ROOT, 'CLAUDE.md'))) {
    if (check) problems.push('missing: CLAUDE.md')
    else write('CLAUDE.md', '@AGENTS.md\n')
  }

  if (check) {
    if (problems.length > 0) {
      fail(
        [
          `sync --check: the app's conventions don't match ${PACKAGE.name}@${PACKAGE.version}:`,
          ...problems.map((problem) => `  ${problem}`),
          'Run `npx ui-foundation sync`. If a synced file was edited on purpose, that change belongs in the foundation — raise it there; the next sync overwrites it here.',
        ].join('\n'),
      )
    }
    console.log(`sync --check: conventions match ${PACKAGE.name}@${PACKAGE.version}`)
  } else {
    console.log(`sync: conventions match ${PACKAGE.name}@${PACKAGE.version}`)
  }
}

// ---------------------------------------------------------- check-contract

// Wording may differ between the app's spec and the foundation's; shapes may not.
const IGNORED_KEYS = new Set(['description', 'summary', 'example', 'examples', 'tags', 'x-optional'])

function normalise(value) {
  if (Array.isArray(value)) return value.map(normalise)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => !IGNORED_KEYS.has(key))
        .sort()
        .map((key) => [key, normalise(value[key])]),
    )
  }
  return value
}

const same = (a, b) => JSON.stringify(normalise(a)) === JSON.stringify(normalise(b))

function checkContract(specPath) {
  const target = path.resolve(APP_ROOT, specPath)
  if (!existsSync(target)) fail(`check-contract: no ${specPath} here`)
  const app = loadYaml(read(target))
  const foundation = loadYaml(read(path.join(PACKAGE_ROOT, 'openapi/foundation.yaml')))
  const problems = []

  for (const [route, item] of Object.entries(foundation.paths)) {
    const appItem = app.paths?.[route]
    if (appItem === undefined) {
      if (!item['x-optional']) problems.push(`missing path ${route}`)
    } else if (!same(appItem, item)) {
      problems.push(`path ${route} differs`)
    }
  }
  for (const [section, entries] of Object.entries(foundation.components)) {
    for (const [name, entry] of Object.entries(entries)) {
      const appEntry = app.components?.[section]?.[name]
      if (appEntry === undefined) problems.push(`missing components.${section}.${name}`)
      else if (!same(appEntry, entry)) problems.push(`components.${section}.${name} differs`)
    }
  }

  if (problems.length > 0) {
    fail(
      [
        `check-contract: ${specPath} doesn't contain ${PACKAGE.name}'s part of the contract unchanged:`,
        ...problems.map((problem) => `  ${problem}`),
        `The package's auth and error handling call exactly these shapes. Copy them from node_modules/${PACKAGE.name}/openapi/foundation.yaml (wording may differ, shapes may not).`,
      ].join('\n'),
    )
  }
  console.log(`check-contract: ${specPath} contains the foundation contract`)
}

// -------------------------------------------------------------- check-deps

function checkDeps(allowlistPath) {
  const allowlistFile = path.resolve(APP_ROOT, allowlistPath)
  const packageFile = path.join(APP_ROOT, 'package.json')
  if (!existsSync(allowlistFile)) fail(`check-deps: no ${allowlistPath} here`)
  const allowlist = JSON.parse(read(allowlistFile))
  const allowed = new Set([...allowlist.dependencies, ...allowlist.devDependencies])
  const pkg = JSON.parse(read(packageFile))
  const declared = new Set(
    ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].flatMap((field) =>
      Object.keys(pkg[field] ?? {}),
    ),
  )
  const violations = [...declared].filter((name) => !allowed.has(name))
  if (violations.length > 0) {
    fail(
      violations
        .map(
          (name) =>
            `check-deps: "${name}" is not in ${allowlistPath}. If it is needed, write the case in docs/BLOCKERS.md and stop.`,
        )
        .join('\n'),
    )
  }
  console.log(`check-deps: all ${declared.size} declared dependencies are allowlisted`)
}

// ------------------------------------------------------------------- main

const [command, ...args] = process.argv.slice(2)
const option = (name, fallback) => {
  const index = args.indexOf(name)
  return index === -1 ? fallback : args[index + 1]
}

switch (command) {
  case 'sync':
    sync({ check: args.includes('--check') })
    break
  case 'check-contract':
    checkContract(args.find((arg) => !arg.startsWith('--')) ?? 'openapi.yaml')
    break
  case 'check-deps':
    checkDeps(option('--allowlist', 'deps-allowlist.json'))
    break
  case '--version':
    console.log(PACKAGE.version)
    break
  default:
    fail('usage: ui-foundation <sync [--check] | check-contract [openapi.yaml] | check-deps [--allowlist file] | --version>')
}
