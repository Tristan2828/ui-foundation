// The parts that draw an emoji beside the words that name them (4.145):
// a hub row's `lead` and a calendar entry's `emoji`, each Noto's picture,
// decorative, the words left as they were. The rail's Emoji fact is
// facts-rail.test.tsx's.
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { Emoji } from '../src/components/app/emoji'
import { MonthCalendar } from '../src/components/app/month-calendar'
import { WidgetListItem } from '../src/components/app/widget-card'

const render = (node: ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)

describe("WidgetListItem's lead", () => {
  it('is drawn inside the link before the text, hidden from a screen reader', () => {
    const html = render(
      <WidgetListItem to="/routines/1" lead={<Emoji emoji="🌅" className="size-4" />}>
        Morning
      </WidgetListItem>,
    )
    const link = html.match(/<a[^>]*>.*<\/a>/)![0]
    expect(link).toContain('data-slot="widget-list-item-lead" aria-hidden="true"')
    expect(link).toContain('data-slot="emoji"')
    // Before the words, which still name the link and its tooltip.
    expect(link.indexOf('data-slot="emoji"')).toBeLessThan(link.indexOf('>Morning<'))
    expect(link).toContain('title="Morning"')
  })

  it('without one, the row is as before', () => {
    const html = render(<WidgetListItem to="/routines/1">Morning</WidgetListItem>)
    expect(html).not.toContain('widget-list-item-lead')
    expect(html).toMatch(/<a[^>]*>Morning<\/a>/)
  })
})

describe("MonthCalendarItem's emoji", () => {
  const html = render(
    <MonthCalendar
      label="Events"
      today="2026-11-20"
      selected="2026-11-20"
      items={[
        { id: 1, day: '2026-11-20', title: 'Book club', emoji: '📚', to: '/events/1' },
        { id: 2, day: '2026-11-20', title: 'Parade' },
      ]}
    />,
  )

  it('is a size-3.5 picture before the title, in the month cell and in the day list', () => {
    const pictures = html.match(/<img[^>]*data-slot="emoji"[^>]*>/g) ?? []
    expect(pictures).toHaveLength(2)
    for (const picture of pictures) {
      expect(picture).toContain('size-3.5')
      expect(picture).toContain('aria-hidden="true"')
    }
  })

  it("leaves the day's summary line in words", () => {
    expect(html).toContain('2 items: Book club, Parade')
    expect(html).not.toContain('📚')
  })
})
