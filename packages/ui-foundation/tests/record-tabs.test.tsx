// A record's tab bar (4.101, record standard 3B) as rendered markup: the
// counts beside the names (by name, none for zero), the bar that sticks,
// at the dialog's offset unless the screen gives one. Sticking and its
// name are e2e/record-tabs.spec.ts.
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { EntityView, type EntityViewProps, type EntityViewSection } from '../src/components/app/entity-view'

const render = (node: ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)

const SECTIONS: EntityViewSection[] = [
  { title: 'Purpose', tab: 'Purpose', content: <p>Ask what it shows.</p> },
  { title: 'Updates', tab: 'Updates', content: <p>Two updates.</p> },
  { title: 'Linked', tab: 'Linked', content: <p>One link.</p> },
]

const view = (props: Partial<EntityViewProps>) => (
  <EntityView isLoading={false} back={{ to: '/', label: 'Notes' }} title="Ask about it" sections={SECTIONS} {...props} />
)

const tabTexts = (html: string) =>
  [...html.matchAll(/role="tab"[^>]*>(.*?)<\/button>/g)].map((match) => match[1].replace(/<[^>]+>/g, ' ').trim())

describe('the tab bar (3B)', () => {
  it('shows each tab its count by name, none for zero or left out', () => {
    const html = render(view({ tabCounts: { updates: 2, Linked: 1, Purpose: 0 } }))
    expect(tabTexts(html)).toEqual(['Purpose', 'Updates 2', 'Linked 1'])
    expect(html.match(/data-slot="entity-view-tab-count"/g)).toHaveLength(2)
  })

  it('has no counts without tabCounts', () => {
    expect(render(view({}))).not.toContain('entity-view-tab-count')
  })

  it('sticks at the dialog offset by default, or the screen given one', () => {
    expect(render(view({}))).toContain('top:var(--entity-view-sticky-top, 0px)')
    expect(render(view({ tabsStickyTop: '3.5rem' }))).toContain('top:3.5rem')
  })

  it('shows the name above the tabs only once stuck', () => {
    expect(render(view({}))).not.toContain('entity-view-tab-bar-title')
  })
})
