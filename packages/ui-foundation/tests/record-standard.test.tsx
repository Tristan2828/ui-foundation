// The record standard's looks (4.98: 1A, 2A, 5B, 8A, 9C) as rendered
// markup and pure rules: the facts as a Details tab and never a rail by
// default, a small box beside a tab, the card dialog's record, the strip
// as wide as its numbers, the status kinds, and choice fields two to a
// row. The geometry (widths, wrapping, a phone) is
// e2e/entity-view-details.spec.ts, e2e/record-dialog.spec.ts and
// e2e/form-controls.spec.ts.
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { StarIcon } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { EntityView, type EntityViewProps, type EntityViewSection } from '../src/components/app/entity-view'
import { KeyStats } from '../src/components/app/key-stats'
import { RecordDialogContext } from '../src/components/app/record-dialog-context'
import { StatusMark } from '../src/components/app/status-mark'
import { fieldRows, type FieldRowItem } from '../src/lib/field-rows'
import { STATUS_KINDS, STATUS_KIND_ICONS, STATUS_KIND_TONES } from '../src/lib/status-kinds'

const render = (node: ReactNode, at = '/') =>
  renderToStaticMarkup(<MemoryRouter initialEntries={[at]}>{node}</MemoryRouter>)

const view = (props: Partial<EntityViewProps>) => (
  <EntityView isLoading={false} back={{ to: '/', label: 'Projects' }} title="Office move" sections={[]} {...props} />
)

const FACTS: EntityViewSection = { title: 'Summary', placement: 'rail', fields: [{ label: 'Floor', value: 'Third' }] }
const NOTES: EntityViewSection = { title: 'Notes', tab: 'Notes', content: <p>Pack the shelves first.</p> }
const CHANGES: EntityViewSection = { title: 'Changes', tab: 'Changes', content: <p>Moved to the morning.</p> }

const tabNames = (html: string) => [...html.matchAll(/role="tab"[^>]*>([^<]+)</g)].map((match) => match[1])

describe('EntityView, the tabs layout (1A)', () => {
  it('is the default: the facts are the last tab, Details, and there is no rail', () => {
    const html = render(view({ sections: [FACTS, NOTES, CHANGES] }))
    expect(html).toContain('data-layout="tabs"')
    expect(tabNames(html)).toEqual(['Notes', 'Changes', 'Details'])
    expect(html).not.toContain('<aside')
    // The facts are inside the tabs, in their capped facts panel.
    expect(html.indexOf('>Summary</h2>')).toBeGreaterThan(html.indexOf('role="tablist"'))
    expect(html).toContain('data-slot="entity-view-details"')
  })

  it('names the facts tab with detailsTab, and joins a tab of that name', () => {
    expect(tabNames(render(view({ detailsTab: 'Facts', sections: [FACTS, NOTES] })))).toEqual(['Notes', 'Facts'])
    const own: EntityViewSection = { title: 'Owner', tab: 'Details', content: <p>Ada</p> }
    expect(tabNames(render(view({ sections: [own, FACTS, NOTES] })))).toEqual(['Details', 'Notes'])
  })

  it('keeps the facts in the column, in their place, when there is no other tab', () => {
    const html = render(view({ sections: [FACTS, { title: 'Notes', content: <p>Pack</p> }] }))
    expect(html).not.toContain('role="tablist"')
    expect(html).not.toContain('<aside')
    expect(html.indexOf('>Summary</h2>')).toBeLessThan(html.indexOf('>Notes</h2>'))
  })

  it('puts a rail section with a tab beside that tab, in a box of its own', () => {
    const side: EntityViewSection = { ...FACTS, title: 'Packing', tab: 'Notes' }
    const html = render(view({ sections: [NOTES, side, CHANGES] }))
    expect(tabNames(html)).toEqual(['Notes', 'Changes'])
    expect(html).toContain('aria-label="Notes Facts"')
    expect(html.indexOf('>Notes</h2>')).toBeLessThan(html.indexOf('>Packing</h2>'))
  })

  it('leaves the rail and column layouts as they were', () => {
    const rail = render(view({ layout: 'rail', sections: [FACTS, NOTES] }))
    expect(rail).toContain('aria-label="Office move details"')
    expect(tabNames(rail)).toEqual(['Notes'])
    const column = render(view({ layout: 'column', sections: [FACTS, NOTES] }))
    expect(column).not.toContain('<aside')
    expect(tabNames(column)).toEqual(['Notes'])
  })
})

describe('EntityView in a card dialog (8A)', () => {
  const inCard = (sections: EntityViewSection[]) =>
    render(
      <RecordDialogContext.Provider
        value={{ titleId: 't', close: () => {}, look: 'card', controls: <button type="button">Close</button> }}
      >
        {view({ actions: <button type="button">Delete</button>, sections })}
      </RecordDialogContext.Provider>,
    )

  it('draws the facts as plain rows, the controls on the title line', () => {
    const html = inCard([FACTS])
    expect(html).toContain('data-look="card"')
    expect(html).not.toContain('data-slot="card"')
    expect(html).toContain('class="sr-only">Summary</h2>')
    const controls = html.slice(html.indexOf('data-slot="entity-view-card-controls"'))
    expect(controls.indexOf('Delete')).toBeLessThan(controls.indexOf('Close'))
  })

  it('shows each heading as a label when there are several', () => {
    const html = inCard([FACTS, { title: 'More', fields: [{ label: 'Order', value: 2 }] }])
    expect(html).not.toContain('sr-only">Summary')
    expect(html).toContain('type-label text-muted-foreground">More</h2>')
  })
})

describe('KeyStats width (2A)', () => {
  it('is as wide as its numbers by default, across the page with width="full"', () => {
    const stats = [{ label: 'Boxes', value: '12' }]
    expect(renderToStaticMarkup(<KeyStats stats={stats} />)).toContain('w-fit max-w-full')
    const full = renderToStaticMarkup(<KeyStats stats={stats} width="full" />)
    expect(full).not.toContain('w-fit')
    expect(full).toContain('data-width="full"')
  })
})

describe('StatusMark (5B)', () => {
  it('has an icon, a tone and a word for each of the six kinds', () => {
    expect(STATUS_KINDS).toHaveLength(6)
    expect(new Set(STATUS_KINDS.map((kind) => STATUS_KIND_ICONS[kind])).size).toBe(6)
    for (const kind of STATUS_KINDS) {
      expect(STATUS_KIND_TONES[kind]).toMatch(/^text-(success-text|info-text|warning-text|muted-foreground|destructive-text)$/)
    }
  })

  it("reads as the status's own word, the kind's by default, the icon hidden", () => {
    const own = renderToStaticMarkup(<StatusMark kind="paused">On Hold</StatusMark>)
    expect(own).toContain('data-kind="paused"')
    expect(own).toContain('text-warning-text')
    expect(own).toContain('>On Hold</span>')
    expect(own).toContain('aria-hidden="true"')
    expect(renderToStaticMarkup(<StatusMark kind="attention" />)).toContain('>Needs Attention</span>')
  })

  it("takes a place's own icon", () => {
    expect(renderToStaticMarkup(<StatusMark kind="done" icon={StarIcon} />)).toContain('lucide-star')
  })
})

describe('fieldRows, choices two to a row (9C)', () => {
  const choice = (size: FieldRowItem['size'] = 'm'): FieldRowItem => ({ size, kind: 'choice' })

  it('puts two choices on a row, evenly, and the third on the next', () => {
    const places = fieldRows([choice(), choice('s'), choice()])
    expect(places[0].share).toBeCloseTo(0.5)
    expect(places[1].share).toBeCloseTo(0.5)
    expect(places[2].share).toBeNull()
  })

  it('shares a choice row with another choice only', () => {
    // A date pair keeps its row; the choice before it is on its own.
    const places = fieldRows([choice(), { size: 'm', kind: 'date' }, { size: 'm', kind: 'date' }])
    expect(places[0].share).toBeNull()
    expect(places[1].phonePair && places[2].phonePair).toBe(true)
    const after = fieldRows([{ size: 's' }, { size: 's' }, choice(), choice()])
    expect(after[0].gaps).toBe(1)
    expect(after[2].gaps).toBe(1)
    expect(after[2].share).toBeCloseTo(0.5)
  })

  it('marks two choices to stay side by side on a phone while they fit', () => {
    const [a, b] = fieldRows([choice(), choice()])
    expect(a.phoneFit && b.phoneFit).toBe(true)
    expect(a.phonePair).toBe(false)
    const [c, d] = fieldRows([choice(), { size: 'm' }])
    expect(c.phoneFit || d.phoneFit).toBe(false)
  })

  it('leaves rows without a choice as they were', () => {
    expect(fieldRows([{ size: 'm' }, { size: 'm' }, { size: 'm' }]).every((place) => place.gaps === 2)).toBe(true)
  })
})
