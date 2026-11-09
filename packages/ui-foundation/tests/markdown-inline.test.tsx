// <Markdown inline>: one run of words for a one-line value. The kept marks,
// and what a block written in such a value reads as (src/lib/markdown-inline.ts).
// Its height in a row and a link's click are e2e/markdown-inline.spec.ts's.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Markdown } from '../src/components/app/markdown'

const html = (text: string) => renderToStaticMarkup(<Markdown inline>{text}</Markdown>)
// The words a reader gets, the link's screen-reader note left out.
const words = (text: string) =>
  html(text)
    .replace(/<span class="sr-only">[^<]*<\/span>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

describe('<Markdown inline>', () => {
  it('is a span with no block inside it', () => {
    const out = html('Some **bold** words\n\nand a second paragraph')
    expect(out.startsWith('<span data-slot="markdown" data-inline=""')).toBe(true)
    expect(out).not.toMatch(/<(p|div|ul|ol|li|table|h\d|blockquote|pre)[\s>]/)
    expect(words('Some **bold** words\n\nand a second paragraph')).toBe('Some bold words and a second paragraph')
  })

  it('keeps bold, italic, code and links, and nothing else', () => {
    const out = html('**b** *i* `c` [l](https://example.com) ~~s~~ ==h==')
    expect(out).toContain('<strong>b</strong>')
    expect(out).toContain('<em>i</em>')
    expect(out).toMatch(/<code[^>]*>c<\/code>/)
    expect(out).toMatch(/<a href="https:\/\/example.com" target="_blank" rel="noreferrer"/)
    expect(out).not.toMatch(/<(del|mark)[\s>]/)
    expect(words('~~s~~ ==h==')).toBe('s h')
  })

  it('takes the font and colour of where it sits', () => {
    const out = html('plain')
    expect(out).not.toMatch(/type-body|text-foreground|flex|gap-/)
  })

  it('reads a list as its items, numbered ones with their numbers and tasks with their state', () => {
    expect(words('- milk\n- eggs\n- bread')).toBe('milk · eggs · bread')
    expect(words('3. first\n4. second')).toBe('3. first · 4. second')
    expect(words('- [x] booked\n- [ ] packed')).toBe('✓ booked · ☐ packed')
    expect(words('- a\n  - a1\n- b')).toBe('a · a1 · b')
  })

  it('reads a table as each row in Header: value pairs', () => {
    expect(words('| Size | Price |\n| --- | ---: |\n| S | $4 |\n| L | **$6** |')).toBe('Size: S, Price: $4 · Size: L, Price: $6')
    expect(words('| Size | |\n| --- | --- |\n| S | x |\n| M | |')).toBe('Size: S, x · Size: M')
  })

  it('reads headings, quotes, callouts, code blocks and images as their words', () => {
    expect(words('# Title\nUnder it')).toBe('Title · Under it')
    expect(words('> quoted')).toBe('quoted')
    expect(words('> [!WARNING]\n> Hot')).toBe('Warning: Hot')
    expect(words('```\nnpm run\nverify\n```')).toBe('npm run verify')
    expect(words('![a chart](/x.png) after')).toBe('a chart after')
    expect(words('one\n\n---\n\ntwo')).toBe('one · two')
  })

  it('never renders raw HTML, and drops an unsafe link to its words', () => {
    expect(words('<b>x</b>')).toContain('<b>x</b>')
    expect(html('[bad](javascript:alert(1))')).not.toContain('javascript:')
  })
})
