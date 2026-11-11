// The record page standard in EntityView and KeyStats (4.80), as rendered
// markup: badges on the title's line, Print notes as an icon, the dash
// for an empty value (read as "Not set"), the strip's icons, and
// `emptyFields="fold"`'s count. The fold opening, the tooltips and the
// layout at each width are e2e/entity-view-standard.spec.ts.
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { CalendarIcon } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { EntityView, type EntityViewProps, type EntityViewSection } from '../src/components/app/entity-view'
import { KeyStats } from '../src/components/app/key-stats'

const render = (node: ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)

const view = (props: Partial<EntityViewProps>) => (
  <EntityView isLoading={false} back={{ to: '/', label: 'Suppliers' }} title="Northwind Lumber" sections={[]} {...props} />
)

const CONTACT: EntityViewSection = {
  title: 'Contact',
  placement: 'rail',
  fields: [
    { label: 'Phone', value: null },
    { label: 'Fax', value: '' },
    { label: 'Address', value: 'Dock 4' },
    { label: 'Tags', value: [] },
  ],
}

describe('EntityView header', () => {
  it('puts the badges on the title line, after the title and before the subtitle', () => {
    const html = render(view({ badges: <b>Active</b>, subtitle: 'Timber' }))
    const line = html.indexOf('data-slot="entity-view-title-line"')
    expect(line).toBeGreaterThan(-1)
    expect(html.indexOf('<h1')).toBeGreaterThan(line)
    expect(html.indexOf('<b>Active</b>')).toBeGreaterThan(html.indexOf('</h1>'))
    expect(html.indexOf('<b>Active</b>')).toBeLessThan(html.indexOf('data-slot="entity-view-subtitle"'))
  })

  it('draws Print notes as an icon named by printLabel, or in words with printLook="words"', () => {
    const sections: EntityViewSection[] = [{ title: 'Notes', print: true, content: 'Delivers on Tuesdays' }]
    const icon = render(view({ sections }))
    expect(icon).toContain('data-slot="icon-action"')
    expect(icon).toContain('aria-label="Print notes"')
    expect(icon).not.toContain('>Print notes<')
    const words = render(view({ sections, printLook: 'words', printLabel: 'Print the prep' }))
    expect(words).not.toContain('data-slot="icon-action"')
    expect(words).toContain('Print the prep')
  })
})

describe('EntityView empty values', () => {
  it('reads an empty value as a dash, spoken as "Not set"', () => {
    const html = render(view({ sections: [CONTACT] }))
    expect(html).toContain('<span aria-hidden="true">—</span><span class="sr-only">Not set</span>')
    expect(html.match(/data-slot="empty-value"/g)).toHaveLength(3)
  })

  it('uses emptyText, and a field\'s own emptyLabel over it, as plain words', () => {
    const sections: EntityViewSection[] = [
      { title: 'Summary', fields: [{ label: 'Budget', value: null }, { label: 'Owner', value: null, emptyLabel: 'Unassigned' }] },
    ]
    const html = render(view({ sections, emptyText: 'None' }))
    expect(html).toContain('>None</span>')
    expect(html).toContain('>Unassigned</span>')
    expect(html).not.toContain('sr-only')
  })

  it('shows every field by default, with no toggle', () => {
    const html = render(view({ layout: 'rail', sections: [CONTACT] }))
    expect(html).toContain('>Phone</dt>')
    expect(html).not.toContain('entity-view-empty-toggle')
  })

  it('folds a card\'s empty fields behind "N empty" with emptyFields="fold"', () => {
    const html = render(view({ layout: 'rail', sections: [CONTACT], emptyFields: 'fold' }))
    expect(html).toContain('>Address</dt>')
    expect(html).not.toContain('>Phone</dt>')
    expect(html).not.toContain('>Tags</dt>')
    expect(html).toMatch(/data-slot="entity-view-empty-toggle" aria-expanded="false"[^>]*>3 empty/)
  })

  it('draws no toggle on a card with nothing empty', () => {
    const sections: EntityViewSection[] = [{ title: 'Summary', fields: [{ label: 'Floor', value: 'Third' }] }]
    expect(render(view({ sections, emptyFields: 'fold' }))).not.toContain('entity-view-empty-toggle')
  })
})

describe('KeyStats', () => {
  it('draws a stat\'s icon before its label, hidden from screen readers', () => {
    const html = renderToStaticMarkup(<KeyStats stats={[{ label: 'Last order', icon: CalendarIcon, value: 'Oct 28' }]} />)
    const dt = html.slice(html.indexOf('<dt'), html.indexOf('</dt>'))
    expect(dt).toMatch(/<svg[^>]*size-3\.25[^>]*aria-hidden="true"/)
    expect(dt.indexOf('<svg')).toBeLessThan(dt.indexOf('Last order'))
  })

  it('reads an empty value as the dash, or as emptyLabel', () => {
    expect(renderToStaticMarkup(<KeyStats stats={[{ label: 'Open', value: null }]} />)).toContain('class="sr-only">Not set')
    expect(renderToStaticMarkup(<KeyStats stats={[{ label: 'Open', value: null }]} emptyLabel="None" />)).toContain('>None</span>')
  })
})
