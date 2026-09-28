#!/usr/bin/env node
// Prints the registry-shipped paths that changed between two git refs, one
// per line, and exits 0 either way — an empty output means "nothing the
// registry ships was touched".
//
// Both release gates key off this: the PR install-test only runs when a
// shipped path changed, and the auto-tag workflow only cuts a tag then.
// Deriving the list from registry.json rather than hardcoding it means a
// newly-shipped file is covered the moment it is added to the registry.
//
// Usage: node scripts/registry-paths-changed.mjs <base-ref> <head-ref>
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const [base, head] = process.argv.slice(2)
if (!base || !head) {
  console.error('usage: registry-paths-changed.mjs <base-ref> <head-ref>')
  process.exit(2)
}

const registry = JSON.parse(readFileSync(new URL('../registry.json', import.meta.url), 'utf8'))
const shipped = new Set()
for (const item of registry.items ?? []) {
  for (const file of item.files ?? []) {
    if (file.path) shipped.add(file.path)
  }
}

// Two dots, not three: "what actually differs between these two commits".
// Three dots would measure from the merge base, which on a stale branch
// reports files the base has since changed on its own.
const diff = execFileSync('git', ['diff', '--name-only', `${base}..${head}`], {
  encoding: 'utf8',
})

const changed = diff.split('\n').filter((path) => path && shipped.has(path))
if (changed.length > 0) console.log(changed.join('\n'))
