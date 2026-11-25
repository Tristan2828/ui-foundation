// 4.147: a date calendar's days named so the number shown is a word of the
// name, the sidebar's page helpers from the root, and a hub row's line
// under its text. The open calendar's axe run is in a browser:
// e2e/week-start.spec.ts, e2e/date-field.spec.ts, e2e/date-choices.spec.ts.
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { HomeIcon } from 'lucide-react'
import { navItems, navPathname, type NavEntry } from '../src/index'
import { WidgetListItem } from '../src/components/app/widget-card'
import { Calendar } from '../src/components/ui/calendar'

const dayNames = (props: Partial<React.ComponentProps<typeof Calendar>> = {}) =>
  [
    ...renderToStaticMarkup(
      <Calendar mode="single" defaultMonth={new Date(2026, 8, 16)} {...(props as object)} />,
    ).matchAll(/<button[^>]*aria-label="([^"]*)"[^>]*>(\d+)<\/button>/g),
  ].map(([, name, shown]) => ({ name, shown }))

describe("Calendar's day names", () => {
  it('are the long date without an ordinal, so the number shown is a word of the name', () => {
    const days = dayNames()
    expect(days.find((day) => day.shown === '14' && day.name.includes('September'))?.name).toBe('Monday, September 14, 2026')
    for (const { name, shown } of days) expect(name.split(/[ ,]+/)).toContain(shown)
  })

  it('keep react-day-picker\'s "Today, " and ", selected"', () => {
    const days = dayNames({ selected: new Date(2026, 8, 16), today: new Date(2026, 8, 18) } as object)
    expect(days.map((day) => day.name)).toContain('Wednesday, September 16, 2026, selected')
    expect(days.map((day) => day.name)).toContain('Today, Friday, September 18, 2026')
  })

  it("give way to a caller's own labels", () => {
    const days = dayNames({ labels: { labelDayButton: () => 'A day' } })
    expect(new Set(days.map((day) => day.name))).toEqual(new Set(['A day']))
  })
})

describe("the sidebar's page helpers, from the package's root", () => {
  const nav: NavEntry[] = [
    { label: 'Home', to: '/', icon: HomeIcon },
    {
      label: 'Lists',
      items: [{ label: 'Tasks', to: '/tasks?status=open', icon: HomeIcon, children: [{ label: 'Done', to: '/tasks/done#top', icon: HomeIcon }] }],
    },
  ]

  it('navItems lists every page, sections and children flattened, in order', () => {
    expect(navItems(nav).map((item) => item.label)).toEqual(['Home', 'Tasks', 'Done'])
  })

  it("navPathname is a link's path without its query or hash", () => {
    expect(navItems(nav).map((item) => navPathname(item.to))).toEqual(['/', '/tasks', '/tasks/done'])
  })
})

const render = (node: ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)

describe("WidgetListItem's line", () => {
  it('is drawn under the text, outside the link, and the note stays beside it', () => {
    const html = render(
      <WidgetListItem to="/timers/1" note="7:00" line="Repeats · 3 moves">
        Pomodoro
      </WidgetListItem>,
    )
    const text = html.match(/<span data-slot="widget-list-item-text"[^>]*>(.*?)<\/span><span class="ml-auto/)![1]
    expect(text).toMatch(/^<a[^>]*>Pomodoro<\/a><span data-slot="widget-list-item-line"[^>]*>Repeats · 3 moves<\/span>$/)
    expect(html).toContain('>7:00<')
  })

  it('without one, the row is as before', () => {
    const html = render(<WidgetListItem to="/timers/1">Pomodoro</WidgetListItem>)
    expect(html).not.toContain('widget-list-item-line')
    expect(html).not.toContain('widget-list-item-text')
  })
})
