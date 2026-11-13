// EntityView's facts (4.106, record standard A1) as rendered markup: each
// kind's one short line, what counts as empty, and the facts in Details
// where the view has no room measured (server markup, a phone). The rail
// beside the tabs, at a desktop width, is e2e/facts-rail.spec.ts. The
// type checks at the bottom are the API's rule: a rail holds short kinds
// only, and a record link must say it's short.
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { EntityView, type EntityViewSection } from '../src/components/app/entity-view'
import { factValue, type EntityViewFact } from '../src/components/app/entity-view-facts'

const render = (node: ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)

describe('a fact draws its kind', () => {
  it('as one short line each', () => {
    expect(render(factValue({ kind: 'status', status: 'paused', word: 'On Hold' }))).toContain('data-kind="paused"')
    const text = render(factValue({ kind: 'text', text: 'Mar 2, 2026' }))
    expect(text).toContain('truncate')
    expect(text).toContain('title="Mar 2, 2026"')
    expect(render(factValue({ kind: 'text', text: 12 }))).toContain('>12<')
    expect(render(factValue({ kind: 'record', name: 'Sam Example', to: '/people/3', short: true }))).toContain('href="/people/3"')
    const out = render(factValue({ kind: 'link', href: 'https://example.com', name: 'Plan' }))
    expect(out).toContain('target="_blank"')
    expect(out).toContain('(opens in a new tab)')
    expect(render(factValue({ kind: 'count', count: 4, to: '/tasks' }))).toContain('href="/tasks"')
    expect(render(factValue({ kind: 'badges', items: ['Finance', 'Support'] })).match(/data-slot="badge"/g)).toHaveLength(2)
  })

  it('empty text and no badges are empty, so the empty label shows', () => {
    expect(factValue({ kind: 'text', text: null })).toBeNull()
    expect(factValue({ kind: 'text', text: '' })).toBeNull()
    expect(factValue({ kind: 'badges', items: [] })).toBeNull()
    // A count of 0 is a value, not empty.
    expect(factValue({ kind: 'count', count: 0 })).not.toBeNull()
  })
})

describe('without the room measured, the facts are in Details', () => {
  const sections: EntityViewSection[] = [
    { title: 'Purpose', tab: 'Purpose', content: <p>Move the team.</p> },
    {
      title: 'Facts',
      placement: 'rail',
      facts: [
        { label: 'Status', kind: 'status', status: 'active' },
        { label: 'Lift', kind: 'text', text: null, emptyLabel: 'Not booked' },
      ],
    },
  ]
  it('as a Details tab of rows, no rail', () => {
    const html = render(<EntityView isLoading={false} back={{ to: '/', label: 'Projects' }} title="Office move" factsRail sections={sections} />)
    expect(html).not.toContain('data-slot="entity-view-facts-rail"')
    expect(html).toMatch(/role="tab"[^>]*>Details</)
    expect(html).toContain('Not booked')
  })
})

// The API's rule, checked by tsc (tests/ is type-checked): no free markup,
// and no record link that hasn't said it's short.
export const FACT_RULES: EntityViewFact[] = [
  // @ts-expect-error a fact is a kind, never markup
  { label: 'Notes', value: <p>Long text</p> },
  // @ts-expect-error a record link must be marked short
  { label: 'Discussion', kind: 'record', name: 'Ask about it', to: '/d/3' },
  // @ts-expect-error a record link can't be marked otherwise
  { label: 'Discussion', kind: 'record', name: 'Ask about it', to: '/d/3', short: false },
]
