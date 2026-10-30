// defineA11ySuite (issue #234): which tests it registers for the options
// given, so a modular app can split it into a spec per module. Playwright's
// `test` is replaced by a recorder; the tests themselves run in the
// template's e2e/a11y.spec.ts.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const titles: string[] = []
const prefix: string[] = []

vi.mock('@playwright/test', () => {
  const test = Object.assign((title: string) => titles.push([...prefix, title].join(' › ')), {
    describe: (title: string, body: () => void) => {
      prefix.push(title)
      body()
      prefix.pop()
    },
    beforeEach: () => {},
    // The package's `test` (the page waits for the app's boot) is this one.
    extend: () => test,
  })
  return { test, expect: () => {} }
})
vi.mock('@axe-core/playwright', () => ({ default: class {} }))

const { defineA11ySuite } = await import('../src/testing')

const TASKS_NAV = [{ label: 'Tasks', items: [{ to: '/tasks', label: 'Tasks', icon: () => null }] }]

beforeEach(() => {
  titles.length = 0
})

describe('defineA11ySuite', () => {
  it("given nav, checks the sidebar links exactly its pages, and each page in both themes", () => {
    defineA11ySuite({ nav: TASKS_NAV, formRoutes: ['/tasks/new'], loggedOutRoutes: ['/login'] })
    expect(titles).toEqual([
      'the sidebar links exactly the pages in nav',
      'accessibility (light) › nav page /tasks has zero axe violations',
      'accessibility (light) › /tasks/new has zero axe violations',
      'accessibility (light) › /login has zero axe violations',
      'accessibility (dark) › nav page /tasks has zero axe violations',
      'accessibility (dark) › /tasks/new has zero axe violations',
      'accessibility (dark) › /login has zero axe violations',
    ])
  })

  it('checkSidebar: false checks only the pages given, and loggedOutRoutes can be left out', () => {
    defineA11ySuite({ nav: TASKS_NAV, checkSidebar: false, formRoutes: ['/tasks/new'], viewRoutes: ['/tasks/1'] })
    expect(titles).toEqual([
      'accessibility (light) › nav page /tasks has zero axe violations',
      'accessibility (light) › /tasks/new has zero axe violations',
      'accessibility (light) › /tasks/1 has zero axe violations',
      'accessibility (dark) › nav page /tasks has zero axe violations',
      'accessibility (dark) › /tasks/new has zero axe violations',
      'accessibility (dark) › /tasks/1 has zero axe violations',
    ])
  })
})
