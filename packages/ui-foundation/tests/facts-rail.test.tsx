// EntityView's facts (record standard A1) as rendered markup: each
// kind's one short line, what counts as empty, and the facts in Details
// where the view has no room measured (server markup, a phone). The rail
// beside the tabs, at a desktop width, is e2e/facts-rail.spec.ts. The
// type checks at the bottom are the API's rule: a rail holds short kinds
// only, and a record link must say it's short.
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { editInPlace } from '../src/components/app/edit-in-place'
import { EntityView, type EntityViewSection } from '../src/components/app/entity-view'
import { factValue, type EntityViewFact } from '../src/components/app/entity-view-facts'

const render = (node: ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)

describe('a fact draws its kind', () => {
  it('each in its own way, never cut (4.145)', () => {
    expect(render(factValue({ kind: 'status', status: 'paused', word: 'On Hold' }))).toContain('data-kind="paused"')
    // A long value wraps, unbroken text anywhere: no ellipsis, so no tooltip with its whole text.
    const text = render(factValue({ kind: 'text', text: 'Mar 2, 2026' }))
    expect(text).toContain('wrap-anywhere')
    expect(text).not.toContain('truncate')
    expect(text).not.toContain('title=')
    for (const fact of [
      { kind: 'badges', items: ['A long label'] },
      { kind: 'record', name: 'Sam Example', to: '/people/3', short: true },
      { kind: 'link', href: 'https://example.com', name: 'Plan' },
    ] as const) {
      const html = render(factValue(fact))
      expect(html).not.toContain('truncate')
      expect(html).not.toContain('title=')
    }
    // A badge grows a line rather than cutting its label.
    expect(render(factValue({ kind: 'badges', items: ['A long label'] }))).toContain('whitespace-normal')
    expect(render(factValue({ kind: 'text', text: 12 }))).toContain('>12<')
    expect(render(factValue({ kind: 'record', name: 'Sam Example', to: '/people/3', short: true }))).toContain('href="/people/3"')
    const out = render(factValue({ kind: 'link', href: 'https://example.com', name: 'Plan' }))
    expect(out).toContain('target="_blank"')
    expect(out).toContain('(opens in a new tab)')
    expect(render(factValue({ kind: 'count', count: 4, to: '/tasks' }))).toContain('href="/tasks"')
    expect(render(factValue({ kind: 'badges', items: ['Finance', 'Support'] })).match(/data-slot="badge"/g)).toHaveLength(2)
  })

  it("an emoji as Noto's picture, named by the emoji; printed as the character", () => {
    const html = render(factValue({ kind: 'emoji', emoji: '🔧' }))
    expect(html).toContain('data-slot="emoji"')
    expect(html).toContain('alt="🔧"')
    expect(html).toContain('size-5')
    expect(factValue({ kind: 'emoji', emoji: '🔧' }, 'Emoji', true)).toBe('🔧')
    expect(factValue({ kind: 'emoji', emoji: null })).toBeNull()
    expect(factValue({ kind: 'emoji', emoji: '' })).toBeNull()
  })

  it('empty text and no badges are empty, so the empty label shows', () => {
    expect(factValue({ kind: 'text', text: null })).toBeNull()
    expect(factValue({ kind: 'text', text: '' })).toBeNull()
    expect(factValue({ kind: 'badges', items: [] })).toBeNull()
    // A count of 0 is a value, not empty.
    expect(factValue({ kind: 'count', count: 0 })).not.toBeNull()
  })
})

describe('a badge takes a tone (4.123)', () => {
  const flags = factValue({
    kind: 'badges',
    items: [{ label: 'Blocked', tone: 'destructive' }, { label: 'Needs you', tone: 'warning' }, 'Plain'],
  })
  const badges = (html: string) => html.match(/<span[^>]*data-slot="badge"[^>]*>/g) ?? []

  it("as the outline badge in that tone's text colour, the word kept", () => {
    const [blocked, needsYou] = badges(render(flags))
    expect(blocked).toContain('data-tone="destructive"')
    expect(blocked).toContain('text-destructive-text')
    expect(needsYou).toContain('data-tone="warning"')
    expect(needsYou).toContain('text-warning-text')
    expect(render(flags)).toContain('>Blocked<')
    expect(render(flags)).toContain('>Needs you<')
  })

  it('and an untoned badge is the plain outline, as before', () => {
    const plain = badges(render(flags))[2]
    expect(plain).not.toContain('data-tone')
    expect(plain).not.toMatch(/-text\b/)
    expect(badges(render(factValue({ kind: 'badges', items: ['Finance'] })))[0]).toBe(plain)
  })

  it('folded into Details (a phone), the tone comes along, edited in place there too', () => {
    const sections: EntityViewSection[] = [
      { title: 'Purpose', tab: 'Purpose', content: <p>Swap the shelving.</p> },
      {
        title: 'Facts',
        placement: 'rail',
        facts: [
          {
            label: 'Flags',
            kind: 'badges',
            items: [{ label: 'Blocked', tone: 'destructive' }],
            edit: editInPlace<string[]>({ kind: 'multi', value: ['blocked'], save: async () => {}, control: () => null }),
          },
        ],
      },
    ]
    const html = render(<EntityView isLoading={false} back={{ to: '/', label: 'Items' }} title="Shelving swap" factsRail sections={sections} />)
    expect(html).not.toContain('data-slot="entity-view-facts-rail"')
    expect(html).toMatch(/data-slot="badge"[^>]*data-tone="destructive"|data-tone="destructive"[^>]*data-slot="badge"/)
    expect(html).toContain('aria-label="Edit Flags"')
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
    expect(html).toMatch(/role="tab"[^>]*>(<[^>]+>)*Details</)
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
