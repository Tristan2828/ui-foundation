// ColorField's value handling: which choice a stored value is (compared in
// full, so another spelling of a named colour is still its name), Custom
// for a colour that's none of them, nothing for a value that isn't a
// colour, and what the browser's own picker can show. The picking itself,
// by pointer, keyboard and Custom, is e2e/color-field.spec.ts.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ColorField } from '../src/components/app/color-field'
import { choiceIndex, COLOR_CHOICES, fullHex, pickerHex } from '../src/lib/color-choices'
import { storedColor } from '../src/lib/stored-color'

const COLORS = [
  { name: 'White', color: '#ffffff' },
  { name: 'Brick', color: '#c0392b' },
  { name: 'Half-clear', color: '#11223344' },
]

describe('fullHex', () => {
  it('spells out a short hex and keeps a long one, in storedColor’s form', () => {
    expect(fullHex('#FFF')).toBe('#ffffff')
    expect(fullHex('fff8')).toBe('#ffffff88')
    expect(fullHex(' C0392B ')).toBe('#c0392b')
    expect(fullHex('#11223344')).toBe('#11223344')
  })

  it('is null for anything that isn’t a colour', () => {
    for (const value of [null, undefined, '', 'red', '#12345', 'url(x)']) expect(fullHex(value), String(value)).toBeNull()
  })
})

describe('choiceIndex', () => {
  it('finds a named colour however it’s stored', () => {
    expect(choiceIndex('#c0392b', COLORS)).toBe(1)
    expect(choiceIndex('C0392B', COLORS)).toBe(1)
    expect(choiceIndex('#FFF', COLORS)).toBe(0)
    expect(choiceIndex('fff', COLORS)).toBe(0)
    expect(choiceIndex('#11223344', COLORS)).toBe(2)
  })

  it('is -1 for a colour that’s none of them, and for a value that isn’t a colour', () => {
    expect(choiceIndex('#c0392c', COLORS)).toBe(-1)
    // The same colour without its alpha is a different stored value.
    expect(choiceIndex('#112233', COLORS)).toBe(-1)
    for (const value of [null, undefined, '', 'white', '#ggg']) expect(choiceIndex(value, COLORS), String(value)).toBe(-1)
  })
})

describe('pickerHex', () => {
  it('is what <input type="color"> takes: #rrggbb, a short hex spelt out, an alpha dropped', () => {
    expect(pickerHex('#ABC')).toBe('#aabbcc')
    expect(pickerHex('#11223344')).toBe('#112233')
    expect(pickerHex('c0392b')).toBe('#c0392b')
  })

  it('is black, the input’s own default, without a colour', () => {
    for (const value of [null, undefined, '', 'nope']) expect(pickerHex(value)).toBe('#000000')
  })
})

describe('COLOR_CHOICES', () => {
  it('is about twelve named colours, each a distinct colour in storedColor’s form', () => {
    expect(COLOR_CHOICES.length).toBe(12)
    for (const { name, color } of COLOR_CHOICES) {
      expect(name.trim(), color).not.toBe('')
      expect(storedColor(color), name).toBe(color)
    }
    expect(new Set(COLOR_CHOICES.map(({ color }) => color)).size).toBe(12)
    expect(new Set(COLOR_CHOICES.map(({ name }) => name)).size).toBe(12)
  })
})

// The radios as rendered: each one's name (its label's text) and whether
// it's checked, in order, Custom last.
function radios(html: string) {
  return [...html.matchAll(/<label[^>]*>(.*?)<\/label>/g)].map(([, inside]) => ({
    checked: /role="radio"[^>]*aria-checked="true"/.test(inside),
    name: inside.replace(/<[^>]+>/g, ''),
  }))
}

const render = (value: string | null | undefined, colors = COLORS) =>
  renderToStaticMarkup(<ColorField id="colour" aria-label="Colour" value={value} onChange={() => {}} colors={colors} />)

describe('ColorField', () => {
  it('is one radio group, each named colour a radio labelled with its name, then Custom', () => {
    const html = render('#c0392b')
    expect(html).toMatch(/role="radiogroup"[^>]*id="colour"|id="colour"[^>]*role="radiogroup"/)
    expect(radios(html).map(({ name }) => name)).toEqual(['White', 'Brick', 'Half-clear', 'Custom'])
    expect(html).toContain('style="background-color:#c0392b"')
    expect(html).toContain('aria-label="Custom colour"')
    expect(html).toContain('type="color"')
  })

  it('checks the named colour the value is, however it’s stored, with no hex beside Custom', () => {
    for (const value of ['#c0392b', 'C0392B', '#C0392B']) {
      const html = render(value)
      expect(radios(html).filter(({ checked }) => checked).map(({ name }) => name), value).toEqual(['Brick'])
      expect(html, value).not.toContain('data-slot="color-field-hex"')
    }
    expect(radios(render('#FFF')).find(({ checked }) => checked)?.name).toBe('White')
  })

  it('checks Custom for a colour that’s none of them, with its hex in storedColor’s form, and the picker on it', () => {
    for (const [value, hex, picker] of [
      ['C0FFEE', '#c0ffee', '#c0ffee'],
      ['#ABC', '#abc', '#aabbcc'],
      ['#123', '#123', '#112233'],
      ['#11223355', '#11223355', '#112233'],
    ]) {
      const html = render(value)
      expect(radios(html).filter(({ checked }) => checked).map(({ name }) => name), value).toEqual(['Custom'])
      expect(html.match(/data-slot="color-field-hex"[^>]*>([^<]*)</)?.[1], value).toBe(hex)
      expect(html, value).toContain(`value="${picker}"`)
    }
  })

  it('checks nothing for a value that isn’t a colour', () => {
    for (const value of [null, undefined, '', 'red', '#12345']) {
      const html = render(value)
      expect(radios(html).some(({ checked }) => checked), String(value)).toBe(false)
      expect(html, String(value)).not.toContain('data-slot="color-field-hex"')
      expect(html, String(value)).toContain('value="#000000"')
    }
  })

  it('offers the default twelve without a list of its own', () => {
    const html = renderToStaticMarkup(<ColorField aria-label="Colour" value="#2563eb" onChange={() => {}} />)
    expect(radios(html).map(({ name }) => name)).toEqual([...COLOR_CHOICES.map(({ name }) => name), 'Custom'])
    expect(radios(html).find(({ checked }) => checked)?.name).toBe('Blue')
  })

  it('marks a refused value on the group', () => {
    const html = renderToStaticMarkup(<ColorField aria-label="Colour" value="#000" onChange={() => {}} invalid />)
    expect(html).toMatch(/role="radiogroup"[^>]*aria-invalid="true"|aria-invalid="true"[^>]*role="radiogroup"/)
  })
})
