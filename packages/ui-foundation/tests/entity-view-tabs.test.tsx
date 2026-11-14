// EntityView's tabs (#303), leading slot and rail fields beside, as
// rendered markup: which sections go under which tab, the address's
// tab, and nothing new without the props. The layouts, keyboard and the
// address changing on a click are e2e/entity-view-tabs.spec.ts.
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { EntityView, type EntityViewProps, type EntityViewSection } from '../src/components/app/entity-view'
import { entityViewTabSlug } from '../src/lib/entity-view-tab'

const render = (node: ReactNode, at = '/') =>
  renderToStaticMarkup(<MemoryRouter initialEntries={[at]}>{node}</MemoryRouter>)

const view = (props: Partial<EntityViewProps>) => (
  <EntityView isLoading={false} back={{ to: '/', label: 'Guides' }} title="Packing a desk" sections={[]} {...props} />
)

const SECTIONS: EntityViewSection[] = [
  { title: 'Summary', placement: 'rail', tab: 'Ignored', fields: [{ label: 'Floor', value: 'Third' }] },
  { title: 'Overview', content: <p>Above the tabs</p> },
  { title: 'Steps', tab: 'Steps', content: <p>Step one</p> },
  { title: 'Where it applies', tab: 'Used in', content: <p>Week 1</p> },
  { title: 'Exceptions', tab: 'used in', content: null },
]

// The tab panel that holds a section's heading, and whether it's hidden.
function panelOf(html: string, heading: string) {
  const at = html.indexOf(`>${heading}</h2>`)
  const start = html.lastIndexOf('data-slot="tabs-content"', at)
  const open = html.lastIndexOf('<div', start)
  return html.slice(open, html.indexOf('>', start) + 1)
}

describe('entityViewTabSlug', () => {
  it('lower-cases, dashes and strips accents', () => {
    expect(entityViewTabSlug('Used in')).toBe('used-in')
    expect(entityViewTabSlug('  Why: the order! ')).toBe('why-the-order')
    expect(entityViewTabSlug('Café notes')).toBe('cafe-notes')
    expect(entityViewTabSlug('***')).toBe('tab')
  })
})

describe('EntityView tabs', () => {
  it('adds no tab list without a tab', () => {
    const html = render(view({ layout: 'rail', sections: SECTIONS.map((section) => ({ ...section, tab: undefined })) }))
    expect(html).not.toContain('role="tablist"')
    expect(html).not.toContain('entity-view-tabs')
  })

  it('one tab per name in first-named order, a rail section never under one', () => {
    const html = render(view({ layout: 'rail', sections: SECTIONS }))
    const tabs = [...html.matchAll(/role="tab"[^>]*>(.*?)<\/button>/g)].map((match) => match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    expect(tabs).toEqual(['Steps', 'Used in'])
    expect(html).toContain('aria-label="Packing a desk sections"')
    expect(html).not.toContain('Ignored')
    // Untabbed main sections come before the list; the rail is outside it.
    expect(html.indexOf('>Overview</h2>')).toBeLessThan(html.indexOf('role="tablist"'))
    // Rail first (the default order): the rail is before the tabs, not in them.
    expect(html.indexOf('>Summary</h2>')).toBeLessThan(html.indexOf('data-slot="entity-view-tabs"'))
  })

  it('selects the first tab at the bare address, keeping the others mounted and hidden', () => {
    const html = render(view({ layout: 'rail', sections: SECTIONS }))
    expect(panelOf(html, 'Steps')).not.toContain('hidden')
    expect(panelOf(html, 'Where it applies')).toContain('hidden')
    // Two names with one slug are one tab.
    expect(panelOf(html, 'Exceptions')).toBe(panelOf(html, 'Where it applies'))
  })

  it('selects the address’s tab, and the first for one it doesn’t know', () => {
    const asked = render(view({ layout: 'column', sections: SECTIONS }), '/?tab=used-in')
    expect(panelOf(asked, 'Where it applies')).not.toContain('hidden')
    expect(panelOf(asked, 'Steps')).toContain('hidden')
    const unknown = render(view({ layout: 'column', sections: SECTIONS }), '/?tab=nope')
    expect(panelOf(unknown, 'Steps')).not.toContain('hidden')
  })
})

describe('EntityView leading and rail fields', () => {
  it('puts leading before the title, and nothing without it', () => {
    const html = render(view({ leading: <span>AL</span> }))
    expect(html.indexOf('data-slot="entity-view-leading"')).toBeLessThan(html.indexOf('<h1'))
    expect(html).toContain('>AL</span>')
    expect(render(view({}))).not.toContain('entity-view-leading')
  })

  it('lays rail labels beside their values by default (4.81), above them with railFields="stacked"', () => {
    const sections: EntityViewSection[] = [{ title: 'Summary', placement: 'rail', fields: [{ label: 'Floor', value: 'Third' }] }]
    expect(render(view({ layout: 'rail', sections }))).toContain('@2xs/fields:grid')
    expect(render(view({ layout: 'rail', sections, railFields: 'beside' }))).toContain('@2xs/fields:grid')
    expect(render(view({ layout: 'rail', sections, railFields: 'stacked' }))).not.toContain('@2xs/fields:grid')
  })
})
