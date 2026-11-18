// EmptyText (4.96), the record's empty value as an export: the dash hidden
// from a screen reader and its words read instead, words shown as they are,
// and the package's own parts drawing through it. Axe in both themes is
// e2e/fixtures-visual.spec.ts's (app-emptytext--places).
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EmptyText, isEmptyValue } from '../src/index'
import { ValueList } from '../src/components/app/value-list'
import { KeyStats } from '../src/components/app/key-stats'

describe('EmptyText', () => {
  it('draws the muted dash, hidden from a screen reader, which reads "Not set"', () => {
    expect(renderToStaticMarkup(<EmptyText />)).toBe(
      '<span data-slot="empty-value" class="text-muted-foreground"><span aria-hidden="true">—</span><span class="sr-only">Not set</span></span>',
    )
  })

  it('reads its own words for the dash, and keeps a className and data attributes', () => {
    const html = renderToStaticMarkup(<EmptyText label="No reason given" className="type-label text-muted-foreground" data-state="empty" />)
    expect(html).toContain('<span class="sr-only">No reason given</span>')
    expect(html).toContain('class="type-label text-muted-foreground"')
    expect(html).toContain('data-state="empty"')
  })

  it('shows words given instead of the dash as they are, with nothing hidden', () => {
    expect(renderToStaticMarkup(<EmptyText text="No budget yet" />)).toBe(
      '<span data-slot="empty-value" class="text-muted-foreground">No budget yet</span>',
    )
  })

  it('is what the package parts draw: a list with nothing and a strip with an empty number', () => {
    expect(renderToStaticMarkup(<ValueList items={[]} />)).toContain('<span aria-hidden="true">—</span><span class="sr-only">None</span>')
    expect(renderToStaticMarkup(<KeyStats stats={[{ label: 'Last count', value: null }]} />)).toContain('data-slot="empty-value"')
  })

  it('counts null, undefined, false, an empty string and an empty list as empty', () => {
    for (const value of [null, undefined, false, '', []]) expect(isEmptyValue(value)).toBe(true)
    for (const value of [0, 'x', ['a']]) expect(isEmptyValue(value)).toBe(false)
  })
})
