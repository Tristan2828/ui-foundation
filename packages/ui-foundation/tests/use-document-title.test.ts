// The browser tab's title (src/hooks/use-document-title.ts) against a fake
// document: AppShell's nav title and a view's title compose in either
// order, the view's wins while it's mounted, and each one leaving puts
// back what was there before it. The hooks' binding to React (effects in
// AppShell and EntityView) is checked in a browser: e2e/app-shell.spec.ts.
import { describe, expect, it } from 'vitest'
import { createDocumentTitles } from '../src/hooks/use-document-title'

function setup() {
  const doc = { title: 'Example (index.html)' }
  return { doc, titles: createDocumentTitles(doc) }
}

describe('createDocumentTitles', () => {
  it('names the nav page with the app, and the home page with the app alone', () => {
    const { doc, titles } = setup()
    titles.setShell({ app: 'Example', page: 'Projects' })
    expect(doc.title).toBe('Projects · Example')
    titles.setShell({ app: 'Example' })
    expect(doc.title).toBe('Example')
  })

  it("a view's title wins when it arrives after the nav's", () => {
    const { doc, titles } = setup()
    titles.setShell({ app: 'Example', page: 'Projects' })
    titles.setView('view', 'Apollo')
    expect(doc.title).toBe('Apollo · Example')
  })

  it("a view's title wins when it arrives before the nav's", () => {
    // A child's effect runs before its parent's: the view's, then AppShell's.
    const { doc, titles } = setup()
    titles.setView('view', 'Apollo')
    expect(doc.title).toBe('Apollo')
    titles.setShell({ app: 'Example', page: 'Projects' })
    expect(doc.title).toBe('Apollo · Example')
    // And the nav changing under it (a query string, a sub-path) doesn't take over.
    titles.setShell({ app: 'Example', page: 'Categories' })
    expect(doc.title).toBe('Apollo · Example')
  })

  it("a view still loading leaves the nav's, until its title comes", () => {
    const { doc, titles } = setup()
    titles.setView('view', undefined)
    titles.setShell({ app: 'Example', page: 'Projects' })
    expect(doc.title).toBe('Projects · Example')
    titles.setView('view', 'Apollo')
    expect(doc.title).toBe('Apollo · Example')
    titles.setView('view', '')
    expect(doc.title).toBe('Projects · Example')
  })

  it("a view unmounting puts the nav's back", () => {
    const { doc, titles } = setup()
    titles.setShell({ app: 'Example', page: 'Projects' })
    titles.setView('view', 'Apollo')
    titles.releaseView('view')
    expect(doc.title).toBe('Projects · Example')
  })

  it('of two views, the latest to set one wins, and a renamed one keeps its place', () => {
    const { doc, titles } = setup()
    titles.setShell({ app: 'Example', page: 'Projects' })
    titles.setView('page', 'Apollo')
    titles.setView('dialog', 'New task')
    expect(doc.title).toBe('New task · Example')
    titles.setView('page', 'Apollo (renamed)')
    expect(doc.title).toBe('New task · Example')
    titles.releaseView('dialog')
    expect(doc.title).toBe('Apollo (renamed) · Example')
  })

  it('puts back the title it found once nothing names the tab', () => {
    const { doc, titles } = setup()
    titles.setShell({ app: 'Example', page: 'Projects' })
    titles.setView('view', 'Apollo')
    titles.releaseView('view')
    titles.setShell(null)
    expect(doc.title).toBe('Example (index.html)')
    // And reads it afresh next time: the page may have changed it meanwhile.
    doc.title = 'Signed out'
    titles.setShell({ app: 'Example' })
    titles.setShell(null)
    expect(doc.title).toBe('Signed out')
  })

  it('names the tab after a view alone outside AppShell', () => {
    const { doc, titles } = setup()
    titles.setView('view', 'Apollo')
    expect(doc.title).toBe('Apollo')
    titles.releaseView('view')
    expect(doc.title).toBe('Example (index.html)')
  })
})
