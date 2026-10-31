// <Markdown> with `foldKey`, and NotesOutline, rendered to markup: a fold
// button before each top-level heading with something under it, nothing
// changed without a key, and the outline's headings. Folding itself is
// e2e/folding.spec.ts's.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Markdown } from '../src/components/app/markdown'
import { NotesOutline } from '../src/components/app/notes-outline'

const TEXT = '# Plan\n\nIntro.\n\n## Beds\n\nThree beds.\n\n## Empty\n\n> ## Quoted\n'

describe('Markdown foldKey', () => {
  it('without a key, renders headings as before', () => {
    const html = renderToStaticMarkup(<Markdown>{TEXT}</Markdown>)
    expect(html).not.toContain('fold')
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
  })
})

describe('NotesOutline', () => {
  it('lists the top two levels with Fold all and Open all', () => {
    const html = renderToStaticMarkup(<NotesOutline markdown={'# A\n\nx\n\n## B\n\ny\n\n### C\n\nz\n'} foldKey="test:outline" />)
    expect(html).toContain('aria-label="Outline"')
    expect(html).toContain('Fold all')
    expect(html).toContain('Open all')
    expect(html).toContain('>A<')
    expect(html).toContain('>B<')
    expect(html).not.toContain('>C<')
  })

  it('shows nothing for a text with fewer headings than minHeadings', () => {
    expect(renderToStaticMarkup(<NotesOutline markdown={'# Only\n\ntext\n'} foldKey="k" />)).toBe('')
  })
})
