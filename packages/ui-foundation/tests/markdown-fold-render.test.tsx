// <Markdown> with `foldKey`, and NotesOutline, rendered to markup: a fold
// button before each top-level toggle heading with something under it, none
// before a plain heading, the toggle marker never shown, nothing
// changed without a key, and the outline's headings. Folding itself is
// e2e/folding.spec.ts's.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Markdown } from '../src/components/app/markdown'
import { NotesOutline } from '../src/components/app/notes-outline'

const T = ' {toggle="true"}'
const TEXT = `# Plan${T}\n\nIntro.\n\n## Beds${T}\n\nThree beds.\n\n## Empty${T}\n\n> ## Quoted${T}\n`

describe('Markdown foldKey', () => {
  it('without a key, renders headings as before', () => {
    const html = renderToStaticMarkup(<Markdown>{TEXT}</Markdown>)
    expect(html).not.toContain('fold')
    expect(html).not.toContain('toggle')
    expect(html).toMatch(/<h3 data-band="true"/)
  })

  it('puts an open fold button before each top-level heading with something under it', () => {
    const html = renderToStaticMarkup(<Markdown foldKey="test:notes">{TEXT}</Markdown>)
    expect(html).toContain('data-fold-scope="test:notes"')
    expect(html.match(/data-slot="fold-button"/g)).toHaveLength(3)
    expect(html).toContain('aria-expanded="true" aria-label="Plan"')
    expect(html).toContain('aria-expanded="true" aria-label="Beds"')
    // The quote under Empty is its section; the quote's own heading isn't one.
    expect(html).toContain('aria-label="Empty"')
    expect(html).not.toContain('data-fold-id="2:Quoted"')
    expect(html).not.toContain('{toggle')
  })

  it('draws a plain heading plain: no button, no room for one, still found by its fold id', () => {
    const html = renderToStaticMarkup(<Markdown foldKey="test:plain">{'## Plain\n\nUnder it.\n\n## Toggle {toggle="true"}\n\nUnder that.\n'}</Markdown>)
    expect(html.match(/data-slot="fold-button"/g)).toHaveLength(1)
    expect(html).toContain('aria-label="Toggle"')
    expect(html).not.toContain('aria-label="Plain"')
    expect(html).toMatch(/<h4 data-fold-id="2:Plain"[^>]*>Plain<\/h4>/)
  })
})

describe('NotesOutline', () => {
  it('lists the top two levels with Fold All and Open All', () => {
    const html = renderToStaticMarkup(<NotesOutline markdown={`# A${T}\n\nx\n\n## B\n\ny\n\n### C\n\nz\n`} foldKey="test:outline" />)
    expect(html).toContain('aria-label="Outline"')
    expect(html).toContain('Fold All')
    expect(html).toContain('Open All')
    expect(html).toContain('>A<')
    expect(html).toContain('>B<')
    expect(html).not.toContain('>C<')
  })

  it('lists plain headings too, without Fold All and Open All when nothing folds', () => {
    const html = renderToStaticMarkup(<NotesOutline markdown={'# A\n\nx\n\n## B\n\ny\n'} foldKey="test:outline-plain" />)
    expect(html).toContain('>A<')
    expect(html).toContain('>B<')
    expect(html).not.toContain('Fold All')
    expect(html).not.toContain('Open All')
  })

  it('shows nothing for a text with fewer headings than minHeadings', () => {
    expect(renderToStaticMarkup(<NotesOutline markdown={'# Only\n\ntext\n'} foldKey="k" />)).toBe('')
  })
})
