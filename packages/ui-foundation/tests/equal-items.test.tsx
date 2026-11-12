// EqualItems (record standard R10): what each look draws for the same
// items, by markup. Featured's toggles from the keyboard, and each look at
// a phone's width, are e2e/equal-items.spec.ts; axe and the glyph check
// e2e/fixtures-visual.spec.ts.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EqualItems, type EqualItem } from '../src/components/app/equal-items'

const ITEMS: EqualItem[] = [
  { id: 'a', title: 'Phase 1', state: { label: 'Done', tone: 'success' }, fields: [{ label: 'Weeks', value: '1–4' }] },
  { id: 'b', title: 'Phase 2', state: 'Current', fields: [{ label: 'Weeks', value: '5–8' }, { label: 'Focus', value: 'Hills' }] },
  { id: 'c', title: 'Rest week' },
]

const count = (html: string, needle: string) => html.split(needle).length - 1

describe('EqualItems', () => {
  it('cards: a named list, one card per item, each title a heading with its state as a badge', () => {
    const html = renderToStaticMarkup(<EqualItems label="Phases" items={ITEMS} />)
    expect(html).toContain('data-look="cards"')
    expect(html).toContain('<ul aria-label="Phases"')
    expect(count(html, 'data-slot="equal-item"')).toBe(3)
    expect(html).toContain('<h3 class="min-w-0 type-body font-semibold break-words text-foreground">Phase 1</h3>')
    // A tone draws its outline badge; words alone are the neutral one.
    expect(html).toMatch(/data-slot="equal-item-state"[^>]*border-success-text[^>]*>Done</)
    expect(html).toMatch(/class="[^"]*border-border text-foreground[^"]*"[^>]*>Current</)
    expect(html).toMatch(/<dt class="type-label text-muted-foreground[^"]*">Focus<\/dt>/)
  })

  it('says No details for an item with no fields, and Nothing yet for no items', () => {
    expect(renderToStaticMarkup(<EqualItems label="Phases" items={ITEMS} />)).toContain('>No details<')
    const empty = renderToStaticMarkup(<EqualItems label="Phases" items={[]} emptyText="No phases yet" />)
    expect(empty).toContain('data-state="empty"')
    expect(empty).toContain('No phases yet')
  })

  it('table: a captioned table, a column per field label in first-seen order, a dash where an item has none', () => {
    const html = renderToStaticMarkup(<EqualItems look="table" label="Phases" items={ITEMS} />)
    expect(html).toContain('<caption class="sr-only">Phases</caption>')
    const heads = [...html.matchAll(/<th[^>]*scope="col"[^>]*>([^<]*)</g)].map((m) => m[1])
    expect(heads).toEqual(['Name', 'Status', 'Weeks', 'Focus'])
    expect(count(html, 'scope="row"')).toBe(3)
    // Phase 1 has no Focus, the rest week no state and no fields.
    expect(count(html, '<span class="sr-only">Not set</span>')).toBe(4)
  })

  it('table: no state column when no item has a state', () => {
    const html = renderToStaticMarkup(
      <EqualItems look="table" label="Stores" items={[{ id: 's', title: 'Corner shop', fields: [{ label: 'Price', value: '$3' }] }]} />,
    )
    expect(html).not.toContain('>Status<')
  })

  it('featured: the named item in full, the rest as closed toggles in headings', () => {
    const html = renderToStaticMarkup(<EqualItems look="featured" featuredId="b" label="Phases" items={ITEMS} />)
    expect(html).toContain('role="group" aria-label="Phases"')
    expect(html).toMatch(/data-featured=""[^>]*aria-label="Phase 2"/)
    expect(html).toContain('>Hills<')
    expect(count(html, 'data-slot="equal-item-toggle"')).toBe(2)
    expect(html).toMatch(/<h3 class="m-0[^"]*"><button[^>]*aria-expanded="false"/)
    // Closed toggles draw nothing of their fields.
    expect(html).not.toContain('>1–4<')
  })

  it('featured: an unknown featuredId features the first item, and defaultOpenIds opens a toggle', () => {
    const html = renderToStaticMarkup(
      <EqualItems look="featured" featuredId="nope" defaultOpenIds={['c']} label="Phases" items={ITEMS} />,
    )
    expect(html).toMatch(/data-featured=""[^>]*aria-label="Phase 1"/)
    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('>No details<')
  })

  it('panels: every detail labelled, with the heading level asked for', () => {
    const html = renderToStaticMarkup(<EqualItems look="panels" headingLevel={4} label="Phases" items={ITEMS} />)
    expect(html).toContain('data-look="panels"')
    expect(count(html, '<h4')).toBe(3)
    expect(count(html, '<dt')).toBe(3)
  })
  it("content and actions: the item's own, the content outside the fields' grid", () => {
    const items = [
      { id: 'a', title: 'Phase 1', content: <form aria-label="Edit Phase 1" />, wide: true, actions: <button type="button">Edit Phase 1</button> },
      { id: 'b', title: 'Phase 2', fields: [{ label: 'Weeks', value: '5–8' }] },
    ]
    const cards = renderToStaticMarkup(<EqualItems label="Phases" items={items} />)
    expect(cards).toMatch(/data-wide=""[^>]*class="[^"]*col-span-full/)
    expect(cards).toMatch(/data-slot="equal-item-actions"[^>]*><button type="button">Edit Phase 1<\/button>/)
    // Content alone reads no "No details", and sits outside any <dl>.
    expect(cards).not.toContain('>No details<')
    expect(cards).toMatch(/data-slot="equal-item-content"[^>]*><form aria-label="Edit Phase 1"/)
    expect(count(cards, '<dl')).toBe(1)

    const table = renderToStaticMarkup(<EqualItems look="table" label="Phases" items={items} />)
    expect(table).toContain('<span class="sr-only">Actions</span>')
    // Name, Weeks and Actions: the content row spans all three.
    expect(table).toMatch(/data-slot="equal-item-content-row"[^>]*><td[^>]*colSpan="3"/i)

    const featured = renderToStaticMarkup(<EqualItems look="featured" featuredId="b" label="Phases" items={items} />)
    // The actions sit beside the toggle's button, not inside it.
    expect(featured).toMatch(/<\/button><\/h3><div data-slot="equal-item-actions"/)
  })
})
