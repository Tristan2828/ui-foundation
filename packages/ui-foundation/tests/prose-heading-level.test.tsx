// Headings in written text follow the page's outline (`headingLevel`,
// src/components/app/prose-look.ts): `#` renders at the level given, each
// level under it one deeper, never past <h6>, and <h3> by default, as the
// text always did. <Markdown> is checked rendered to HTML; the editor's
// headings come from the same headingTag (e2e/rich-text-editor.spec.ts
// "heading levels" checks them in a browser, and the saved Markdown).
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Markdown } from '../src/components/app/markdown'
import { DEFAULT_HEADING_LEVEL, headingBand, headingTag } from '../src/components/app/prose-look'
import { textTopHeading } from '../src/lib/markdown-top-heading'

const NOTE = '# One\n\n## Two\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six\n'

// Each heading in the HTML, as its element and its words.
function headings(html: string): string[] {
  return [...html.matchAll(/<(h[1-6])\b[^>]*>([^<]*)</g)].map((found) => `${found[1]} ${found[2]}`)
}

describe('headingTag', () => {
  it('starts at <h3> by default: the page owns <h1>, each section its <h2>', () => {
    expect(DEFAULT_HEADING_LEVEL).toBe(3)
    expect([1, 2, 3, 4, 5, 6].map((level) => headingTag(level))).toEqual(['h3', 'h4', 'h5', 'h6', 'h6', 'h6'])
  })

  it('puts `#` at the level given, each level under it one deeper', () => {
    expect([1, 2, 3].map((level) => headingTag(level, 2))).toEqual(['h2', 'h3', 'h4'])
    expect([1, 2, 3].map((level) => headingTag(level, 1))).toEqual(['h1', 'h2', 'h3'])
  })

  it('never goes past <h6>', () => {
    expect([1, 2, 3].map((level) => headingTag(level, 5))).toEqual(['h5', 'h6', 'h6'])
    expect([1, 6].map((level) => headingTag(level, 6))).toEqual(['h6', 'h6'])
  })

  it('reads a level that is no level as `#`', () => {
    expect(headingTag(0, 2)).toBe('h2')
    expect(headingTag(Number.NaN, 2)).toBe('h2')
  })

  it('puts `#` and `##` on a band, nothing deeper', () => {
    expect([1, 2, 3, 4].map(headingBand)).toEqual([true, true, false, false])
  })
})

describe('<Markdown headingLevel>', () => {
  it('renders as it always did by default', () => {
    expect(headings(renderToString(<Markdown>{NOTE}</Markdown>))).toEqual([
      'h3 One',
      'h4 Two',
      'h5 Three',
      'h6 Four',
      'h6 Five',
      'h6 Six',
    ])
  })

  it('follows the level given, capped at <h6>', () => {
    expect(headings(renderToString(<Markdown headingLevel={2}>{NOTE}</Markdown>)).slice(0, 4)).toEqual([
      'h2 One',
      'h3 Two',
      'h4 Three',
      'h5 Four',
    ])
    expect(headings(renderToString(<Markdown headingLevel={5}>{NOTE}</Markdown>)).slice(0, 3)).toEqual([
      'h5 One',
      'h6 Two',
      'h6 Three',
    ])
  })

  it('keeps each level its look: the band and the classes go with `#`, whatever the element', () => {
    const at = (headingLevel: 2 | 3 | 5) => {
      const html = renderToString(<Markdown headingLevel={headingLevel}>{'# One\n\n### Three\n'}</Markdown>)
      return [...html.matchAll(/<h[1-6]([^>]*)>/g)].map((found) => found[1])
    }
    expect(at(2)).toEqual(at(3))
    expect(at(5)).toEqual(at(3))
    expect(at(3)[0]).toContain('data-band')
    expect(at(3)[1]).not.toContain('data-band')
  })
})

// headingFrom="text" (#235): the text's own highest heading takes
// headingLevel, for notes that start at `##` or deeper.
describe('textTopHeading', () => {
  it("finds the text's highest heading, nested ones included", () => {
    expect(textTopHeading('## Two\n\n### Three\n')).toBe(2)
    expect(textTopHeading('### Three\n\n> # One in a quote\n')).toBe(1)
    expect(textTopHeading('Setext\n---\n\n### Three\n')).toBe(2)
  })

  it('reads no heading as `#`, and a `#` in code as no heading', () => {
    expect(textTopHeading('Just words.\n')).toBe(1)
    expect(textTopHeading('```\n# not a heading\n```\n\n### Three\n')).toBe(3)
  })
})

describe("headingTag with the text's top level", () => {
  it('puts that level at the level given, the rest keeping their distance, a heading above it at the top', () => {
    expect([2, 3, 4].map((level) => headingTag(level, 2, 2))).toEqual(['h2', 'h3', 'h4'])
    expect([3, 4].map((level) => headingTag(level, 2, 3))).toEqual(['h2', 'h3'])
    expect(headingTag(1, 2, 2)).toBe('h2')
  })
})

describe('<Markdown headingFrom>', () => {
  const FROM_TWO = '## Two\n\n### Three\n\n#### Four\n'

  it("'hash' (the default) maps `#` to headingLevel, as before", () => {
    expect(headings(renderToString(<Markdown headingLevel={2}>{FROM_TWO}</Markdown>))).toEqual(['h3 Two', 'h4 Three', 'h5 Four'])
  })

  it("'text' maps the text's own highest to headingLevel", () => {
    expect(
      headings(
        renderToString(
          <Markdown headingLevel={2} headingFrom="text">
            {FROM_TWO}
          </Markdown>,
        ),
      ),
    ).toEqual(['h2 Two', 'h3 Three', 'h4 Four'])
    expect(
      headings(
        renderToString(
          <Markdown headingLevel={2} headingFrom="text">
            {'### Three\n\n#### Four\n'}
          </Markdown>,
        ),
      ),
    ).toEqual(['h2 Three', 'h3 Four'])
  })

  it("'text' keeps the look of each heading's own level", () => {
    const attributes = (html: string) => [...html.matchAll(/<h[1-6]([^>]*)>/g)].map((found) => found[1])
    const fromText = renderToString(
      <Markdown headingLevel={2} headingFrom="text">
        {FROM_TWO}
      </Markdown>,
    )
    expect(attributes(fromText)).toEqual(attributes(renderToString(<Markdown headingLevel={2}>{FROM_TWO}</Markdown>)))
  })

  it("'text' with no headings renders the text as it is", () => {
    expect(renderToString(<Markdown headingFrom="text">{'Just words.'}</Markdown>)).toBe(
      renderToString(<Markdown>{'Just words.'}</Markdown>),
    )
  })
})
