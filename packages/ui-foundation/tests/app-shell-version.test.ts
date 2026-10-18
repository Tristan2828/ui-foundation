// AppShell's version entry: what it says and where it links. The rendered
// entry is checked in a real browser: e2e/app-shell.spec.ts, on the
// app/AppShell Version story.
import { describe, expect, it } from 'vitest'
import { versionHref, versionLabel } from '../src/components/app/app-shell-version'

const commit = '3655449e1c2b7d0a9f8e6b5c4d3a2f1e0d9c8b7a'
const repoUrl = 'https://github.com/example/app'

describe('versionLabel', () => {
  it('shows nothing without a commit (development, or the build args unset)', () => {
    expect(versionLabel({})).toBeNull()
    expect(versionLabel({ commit: '', pr: '12', repoUrl })).toBeNull()
    expect(versionLabel({ commit: '  ' })).toBeNull()
  })

  it('names the short commit, and the PR when there is one', () => {
    expect(versionLabel({ commit })).toBe('Version 3655449')
    expect(versionLabel({ commit, pr: 139 })).toBe('Version 3655449 · PR #139')
    expect(versionLabel({ commit, pr: '139' })).toBe('Version 3655449 · PR #139')
    expect(versionLabel({ commit, pr: '' })).toBe('Version 3655449')
  })
})

describe('versionHref', () => {
  it('links to the PR, else to the commit', () => {
    expect(versionHref({ commit, pr: 139, repoUrl })).toBe(`${repoUrl}/pull/139`)
    expect(versionHref({ commit, repoUrl: `${repoUrl}/` })).toBe(`${repoUrl}/commit/${commit}`)
  })

  it('makes no link without a commit or an http(s) repository', () => {
    expect(versionHref({ pr: 139, repoUrl })).toBeNull()
    expect(versionHref({ commit })).toBeNull()
    expect(versionHref({ commit, repoUrl: 'javascript:alert(1)//' })).toBeNull()
    expect(versionHref({ commit, repoUrl: 'github.com/example/app' })).toBeNull()
  })

  it('ignores a PR that is not a number', () => {
    expect(versionHref({ commit, pr: '../../evil', repoUrl })).toBe(`${repoUrl}/commit/${commit}`)
  })
})
