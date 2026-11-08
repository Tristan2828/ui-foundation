// Page links (src/lib/page-link.ts): what <Markdown> draws for a link the
// app marks as a page, that the Markdown under one is never rewritten by
// an edit elsewhere (mergeMarkdown over the editor's real output), the
// slash menu's Page item, and how PageTrail folds a long trail. Clicks,
// "/page" and the trail at a phone's width: e2e/page-links.spec.ts.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Markdown } from '../src/components/app/markdown'
import { PageTrail } from '../src/components/app/page-trail'
import { MARKDOWN_FIXTURES } from '../src/components/app/rich-text-editor.fixtures'
import { slashItems } from '../src/components/app/rich-text-slash'
import { mergeMarkdown } from '../src/lib/markdown-merge'
import type { PageLinkInfo } from '../src/lib/page-link'
import { crumbsToFold } from '../src/lib/page-trail'

const PAGES: Record<string, PageLinkInfo> = {
  '/pages/3': { title: 'Safety Cheat Sheet' },
  '/pages/9': { title: 'Old plan', removed: true, onRestore: () => {} },
  '/pages/11': { removed: true },
}
const pageLink = (href: string) => PAGES[href] ?? null

describe('<Markdown> page links', () => {
  it('draws a page alone in its paragraph as a page line, opening in this tab', () => {
    const html = renderToStaticMarkup(<Markdown pageLink={pageLink}>{'[Safety](/pages/3)\n'}</Markdown>)
    expect(html).toContain('<p data-page-line="" class="page-line">')
    expect(html).toMatch(/<a href="\/pages\/3" data-slot="page-link" class="page-link"><svg aria-hidden="true"[^>]*class="page-link-icon"/)
    // The app's title, not the words as written (a renamed page reads renamed).
    expect(html).toContain('Safety Cheat Sheet</a>')
    expect(html).not.toContain('target="_blank"')
  })

  it('draws a page inside a sentence inline, the paragraph left plain', () => {
    const html = renderToStaticMarkup(<Markdown pageLink={pageLink}>{'See [this](/pages/3) first.\n'}</Markdown>)
    expect(html).toContain('<p>See <a href="/pages/3"')
    expect(html).not.toContain('page-line')
  })

  it('draws a removed page as "Page removed", with Restore only when the app can', () => {
    const html = renderToStaticMarkup(<Markdown pageLink={pageLink}>{'[Old plan](/pages/9)\n\n[Lost](/pages/11)\n'}</Markdown>)
    expect(html.match(/Page removed/g)).toHaveLength(2)
    expect(html.match(/aria-label="Restore Old plan"/g)).toHaveLength(1)
    expect(html).not.toContain('href="/pages/9"')
    expect(html).not.toContain('Restore Lost')
  })

  it('leaves every link the app doesn’t mark as it was', () => {
    const text = '[Safety](/pages/3) and [docs](https://example.com/docs)\n'
    const plain = renderToStaticMarkup(<Markdown>{text}</Markdown>)
    const marked = renderToStaticMarkup(<Markdown pageLink={() => null}>{text}</Markdown>)
    expect(marked).toBe(plain)
    expect(plain).toContain('href="/pages/3" target="_blank"')
    const docs = renderToStaticMarkup(<Markdown pageLink={pageLink}>{text}</Markdown>)
    expect(docs).toContain('href="https://example.com/docs" target="_blank"')
  })
})

describe('page links in the saved Markdown', () => {
  const { markdown, editorWrites } = MARKDOWN_FIXTURES.pageLinks

  it('the editor writes a page link exactly as it was', () => {
    expect(editorWrites).toBe(markdown)
  })

  it('an edit elsewhere keeps every page link byte for byte', () => {
    const edited = editorWrites.replace('Last line.', 'Last line, edited.').replace('Notes for the move.', 'Notes for the house move.')
    const merged = mergeMarkdown(markdown, editorWrites, edited)
    expect(merged).toContain('\n\n[Safety Cheat Sheet](/tasks/84/pages/3)\n\n')
    expect(merged).toContain('The [packing list](/tasks/84/pages/5) is a page too.')
    expect(merged).toBe(markdown.replace('Last line.', 'Last line, edited.').replace('Notes for the move.', 'Notes for the house move.'))
  })

  it('a page link written its own way (a title, angle brackets) is kept as written when untouched', () => {
    const original = 'Intro.\n\n[Plan](</tasks/84/pages/3> "The plan")\n\nOutro.\n'
    // What the editor would write for that line on load.
    const baseline = 'Intro.\n\n[Plan](/tasks/84/pages/3 "The plan")\n\nOutro.\n'
    const merged = mergeMarkdown(original, baseline, baseline.replace('Outro.', 'Outro, edited.'))
    expect(merged).toBe('Intro.\n\n[Plan](</tasks/84/pages/3> "The plan")\n\nOutro, edited.\n')
  })
})

describe('the slash menu’s Page', () => {
  it('is offered only when the app can make pages', () => {
    expect(slashItems('').some((item) => item.id === 'page')).toBe(false)
    expect(slashItems('page').some((item) => item.id === 'page')).toBe(false)
    expect(slashItems('', { page: true }).at(-1)?.id).toBe('page')
  })

  it('comes first once "/pa…" names it, and answers to its keywords', () => {
    expect(slashItems('pa', { page: true })[0].id).toBe('page')
    expect(slashItems('page', { page: true }).map((item) => item.id)).toEqual(['page'])
    expect(slashItems('subpage', { page: true }).map((item) => item.id)).toEqual(['page'])
    expect(slashItems('h2', { page: true }).some((item) => item.id === 'page')).toBe(false)
  })
})

describe('PageTrail', () => {
  it('folds nothing when the trail fits', () => {
    expect(crumbsToFold([40, 60, 80], 10, 20, 500)).toBe(0)
    expect(crumbsToFold([400, 600], 10, 20, 100)).toBe(0)
  })

  it('folds from the top down, keeping the first and the page itself', () => {
    // 50 + 100 + 100 + 100 + 60, four gaps of 10: 450.
    const widths = [50, 100, 100, 100, 60]
    expect(crumbsToFold(widths, 10, 20, 449)).toBe(1) // 50 + 20 + 100 + 100 + 60 + 40 = 370
    expect(crumbsToFold(widths, 10, 20, 300)).toBe(2) // 50 + 20 + 100 + 60 + 30 = 260
    expect(crumbsToFold(widths, 10, 20, 200)).toBe(3) // 50 + 20 + 60 + 20 = 150
    expect(crumbsToFold(widths, 10, 20, 50)).toBe(3) // never the first or the last
  })

  it('links every crumb but the last, which is the page you are on', () => {
    const html = renderToStaticMarkup(
      <PageTrail crumbs={[{ label: 'Tasks', href: '/tasks' }, { label: 'Move', href: '/tasks/84' }, { label: 'Safety' }]} />,
    )
    expect(html).toContain('aria-label="Breadcrumb"')
    expect(html).toContain('href="/tasks"')
    expect(html).toContain('href="/tasks/84"')
    expect(html).toMatch(/aria-current="page"[^>]*>Safety</)
  })
})
