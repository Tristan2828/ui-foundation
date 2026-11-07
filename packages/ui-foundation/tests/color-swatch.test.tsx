// ColorSwatch shows a stored colour beside its name: the fill only from a
// value storedColor accepts, the empty swatch for anything else, hidden
// from screen readers, the name always written.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ColorSwatch } from '../src/components/app/color-swatch'
import { storedColor } from '../src/lib/stored-color'

describe('storedColor', () => {
  it('accepts hex in 3, 4, 6 or 8 digits, with or without #, trimmed and lower-cased', () => {
    expect(storedColor('#C0392B')).toBe('#c0392b')
    expect(storedColor('c0392b')).toBe('#c0392b')
    expect(storedColor('  #fff ')).toBe('#fff')
    expect(storedColor('#fff8')).toBe('#fff8')
    expect(storedColor('#11223344')).toBe('#11223344')
  })

  it('refuses anything else', () => {
    for (const value of [null, undefined, '', '   ', '#', '#ff', '#12345', '#1234567', '#gggggg', 'red',
      'transparent', 'currentColor', 'inherit', 'rgb(1, 2, 3)', 'url(x)', '#fff; background: red', '##fff']) {
      expect(storedColor(value), String(value)).toBeNull()
    }
  })
})

describe('ColorSwatch', () => {
  it('fills the swatch with the stored colour, hidden, with its name beside it', () => {
    const html = renderToStaticMarkup(<ColorSwatch color="C0392B" label="Brick red" />)
    expect(html).toMatch(
      /<span aria-hidden="true" data-slot="color-swatch" data-color="#c0392b" class="[^"]*border-muted-foreground[^"]*" style="background-color:#c0392b"><\/span><span[^>]*>Brick red<\/span>/,
    )
    expect(html).not.toContain('data-empty')
    expect(html).not.toContain('border-dashed')
  })

  it('draws the empty swatch, with no fill, for a missing or invalid colour, and still names it', () => {
    for (const color of [null, undefined, '', 'not a colour', 'red; background: url(x)']) {
      const html = renderToStaticMarkup(<ColorSwatch color={color} label="No colour" />)
      expect(html, String(color)).toContain('data-empty=""')
      expect(html, String(color)).toContain('border-dashed')
      expect(html, String(color)).not.toContain('style=')
      expect(html, String(color)).not.toContain('data-color')
      expect(html, String(color)).toContain('>No colour</span>')
    }
  })

  it('is 16px by default and 12px at sm, the size of a Badge icon', () => {
    expect(renderToStaticMarkup(<ColorSwatch color="#000" label="Black" />)).toMatch(/data-slot="color-swatch"[^>]*class="[^"]*\bsize-4\b/)
    expect(renderToStaticMarkup(<ColorSwatch color="#000" label="Black" size="sm" />)).toMatch(/data-slot="color-swatch"[^>]*class="[^"]*\bsize-3\b/)
  })

  it('keeps a long name on one line, cut with its whole text in a tooltip', () => {
    const name = 'A very long paint name from the manufacturer, eggshell finish'
    const html = renderToStaticMarkup(<ColorSwatch color="#eee" label={name} />)
    expect(html).toContain(`<span class="min-w-0 truncate" title="${name}">${name}</span>`)
  })

  it('needs a label: the colour is never the only way to tell', () => {
    // @ts-expect-error label is required
    const element = <ColorSwatch color="#000" />
    expect(element).toBeTruthy()
  })
})
