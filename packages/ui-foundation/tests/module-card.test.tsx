// ModuleCard shows one number, or none; its states are the number's; a
// place outside the app opens in a new tab. The strip's layout and the
// phone tile are measured in e2e/module-card.spec.ts.
import { ListTodoIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ModuleCard, ModuleStrip } from '../src/components/app/module-card'

const render = (node: ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)

describe('ModuleCard', () => {
  it('shows the number and the note, the band linking to the place', () => {
    const html = render(<ModuleCard title="Projects" icon={ListTodoIcon} category={1} to="/projects" value={5} note="open" />)
    const band = html.match(/<a [^>]*data-slot="module-card-band"[^>]*>/)?.[0] ?? ''
    expect(band).toContain('href="/projects"')
    expect(band).toContain('bg-category-1/10')
    expect(html).toMatch(/data-slot="module-card-value" class="type-numeric[^"]*">5</)
    expect(html).toContain('>open<')
  })

  it('shows no number without a value, and that is not an empty state', () => {
    const html = render(<ModuleCard title="Recipes" icon={ListTodoIcon} href="https://example.com" note="Opens its own app" />)
    expect(html).not.toContain('module-card-value')
    expect(html).toContain('data-state="success"')
    expect(html).toMatch(/<a href="https:\/\/example.com" target="_blank" rel="noreferrer"/)
    expect(html).toContain('(opens in a new tab)')
  })

  it('skeletons the number while loading, keeping the note', () => {
    const html = render(<ModuleCard title="Projects" icon={ListTodoIcon} to="/projects" value={5} note="open" isLoading />)
    expect(html).toContain('aria-busy="true"')
    expect(html).not.toContain('module-card-value')
    expect(html).toContain('>open<')
  })

  it('fails inside the card, with Retry, and keeps the band and the action', () => {
    const html = render(
      <ModuleCard
        title="Projects"
        icon={ListTodoIcon}
        to="/projects"
        value={5}
        action={{ to: '/projects?view=today', label: 'Today' }}
        error={{ kind: 'network', message: "Couldn't reach the server." }}
        onRetry={() => {}}
      />,
    )
    expect(html).toContain('data-state="error"')
    expect(html).toContain('Couldn&#x27;t load')
    expect(html).toMatch(/<button[^>]*>Retry<\/button>/)
    expect(html).toContain('href="/projects?view=today"')
    expect(html).not.toContain('module-card-value')
  })
})

describe('ModuleStrip', () => {
  it('is a named navigation landmark with one list item per card', () => {
    const html = render(
      <ModuleStrip aria-label="Places">
        <ModuleCard title="Projects" icon={ListTodoIcon} to="/projects" />
        {null}
        <ModuleCard title="Recipes" icon={ListTodoIcon} to="/recipes" />
      </ModuleStrip>,
    )
    expect(html).toMatch(/^<nav aria-label="Places"/)
    expect(html.match(/<li/g)).toHaveLength(2)
  })
})
