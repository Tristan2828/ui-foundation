import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import './harness.css'
import { fixtures } from './registry'
import { DENSITIES, THEMES, setGlobals } from './set-globals'

// Every fixture, grouped by title, each a link to its own page. The theme and
// density chosen here apply to this page and to the links.
const params = new URLSearchParams(location.search)

function Select({ label, value, options, onChange }: {
  label: string
  value: string
  options: readonly string[]
  onChange: (value: string) => void
}) {
  return (
    <label className="flex items-center gap-2">
      {label}
      <select
        className="rounded-md border border-input bg-background px-2 py-1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

function Index() {
  const [theme, setTheme] = useState(params.get('theme') === 'dark' ? 'dark' : 'light')
  const [density, setDensity] = useState(params.get('density') ?? 'default')
  setGlobals(new URLSearchParams({ theme, density }))
  const groups = new Map<string, typeof fixtures>()
  for (const fixture of fixtures) groups.set(fixture.title, [...(groups.get(fixture.title) ?? []), fixture])
  const href = (id: string) => `story.html?id=${id}&theme=${theme}&density=${density}`
  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold">Fixtures</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {fixtures.length} states of the package&apos;s components, the pages its browser tests open.
      </p>
      <div className="mt-4 flex gap-4 text-sm">
        <Select label="Theme" value={theme} options={THEMES} onChange={setTheme} />
        <Select label="Density" value={density} options={DENSITIES} onChange={setDensity} />
      </div>
      {[...groups].map(([title, items]) => (
        <section key={title} className="mt-6">
          <h2 className="text-base font-semibold">{title}</h2>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {items.map((fixture) => (
              <li key={fixture.id}>
                <a className="text-primary underline underline-offset-2" href={href(fixture.id)}>
                  {fixture.name}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<Index />)
