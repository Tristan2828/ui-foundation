import type { Meta, StoryObj } from '@/fixtures/types'
import type { CSSProperties } from 'react'
import { Card, CardContent } from '@/components/ui/card'

// Not a component: the heat scale's five steps (styles/theme.css, the "Heat
// scale" section of conventions/docs/design-language.md) the two ways an app
// uses them, as shapes filled with `fill-heat-*` and cells filled with
// `bg-heat-*` holding their own text. Default shows both on the page and on a
// card, so the fixtures checks measure each step against both surfaces.
// SideBySide shows both themes at once, under normal vision and simulated
// deuteranopia and protanopia.
//
// Whole class names, as an app's own step -> class map has them: Tailwind
// only generates classes it finds written out.
const STEPS = [
  { step: 1, fill: 'fill-heat-1', cell: 'bg-heat-1 text-heat-1-foreground', name: 'Coldest' },
  { step: 2, fill: 'fill-heat-2', cell: 'bg-heat-2 text-heat-2-foreground', name: 'Cool' },
  { step: 3, fill: 'fill-heat-3', cell: 'bg-heat-3 text-heat-3-foreground', name: 'Middle' },
  { step: 4, fill: 'fill-heat-4', cell: 'bg-heat-4 text-heat-4-foreground', name: 'Warm' },
  { step: 5, fill: 'fill-heat-5', cell: 'bg-heat-5 text-heat-5-foreground', name: 'Hottest' },
] as const

const meta: Meta = {
  title: 'patterns/HeatScale',
  parameters: { controls: { disable: true } },
}

export default meta

function Steps({ surface }: { surface?: string }) {
  return (
    <div className="flex flex-col gap-2" data-surface={surface}>
      <svg aria-hidden="true" viewBox="0 0 100 10" className="h-8 w-full max-w-md">
        {STEPS.map(({ step, fill }, i) => (
          <rect key={step} data-heat-fill={step} className={fill} x={i * 20} width="20" height="10" />
        ))}
      </svg>
      <ul className="grid max-w-md grid-cols-5 gap-1">
        {STEPS.map(({ step, cell, name }) => (
          <li key={step} data-heat-cell={step} className={`rounded-sm px-1 py-2 text-center type-caption ${cell}`}>
            {name}
          </li>
        ))}
      </ul>
    </div>
  )
}

export const Default: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-6 text-foreground">
      <section className="flex flex-col gap-2">
        <h2 className="type-label">On the page</h2>
        <Steps surface="background" />
      </section>
      <Card>
        <CardContent className="flex flex-col gap-2">
          <h2 className="type-label">On a card</h2>
          <Steps surface="card" />
        </CardContent>
      </Card>
    </div>
  ),
}

// Machado, Oliveira & Fernandes (2009), full severity, on sRGB values: the
// same simulation tests/heat-scale.test.ts measures.
const VISIONS = [
  { id: 'normal', label: 'Normal vision', matrix: null },
  {
    id: 'deuteranopia',
    label: 'Deuteranopia (simulated)',
    matrix: '0.367322 0.860646 -0.227968 0 0 0.280085 0.672501 0.047413 0 0 -0.011820 0.042940 0.968881 0 0 0 0 0 1 0',
  },
  {
    id: 'protanopia',
    label: 'Protanopia (simulated)',
    matrix: '0.152286 1.052583 -0.204868 0 0 0.114503 0.786281 0.099216 0 0 -0.003882 -0.048116 1.051998 0 0 0 0 0 1 0',
  },
] as const

// Each panel pins its own theme, whichever theme the page is in: the page
// colours from the primitives the themes use, each step from its own shade
// (-700 light, -400 dark) and its text as that theme has it.
function themeStyle(theme: 'light' | 'dark'): CSSProperties {
  const shade = theme === 'light' ? '700' : '400'
  return {
    background: theme === 'light' ? 'var(--white)' : 'var(--black)',
    color: theme === 'light' ? 'var(--black)' : 'var(--gray-50)',
    ...Object.fromEntries(
      STEPS.flatMap(({ step }) => [
        [`--heat-${step}`, `var(--heat-${step}-${shade})`],
        [`--heat-${step}-foreground`, theme === 'light' && step >= 4 ? 'var(--white)' : 'var(--black)'],
      ]),
    ),
  }
}

export const SideBySide: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-6 text-foreground">
      <svg aria-hidden="true" className="absolute size-0">
        {VISIONS.map(({ id, matrix }) =>
          matrix ? (
            <filter key={id} id={`heat-${id}`} colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values={matrix} />
            </filter>
          ) : null,
        )}
      </svg>
      {VISIONS.map(({ id, label, matrix }) => (
        <section key={id} className="flex flex-col gap-2">
          <h2 className="type-label">{label}</h2>
          <div className="grid gap-4 lg:grid-cols-2" style={matrix ? { filter: `url(#heat-${id})` } : undefined}>
            {(['light', 'dark'] as const).map((theme) => (
              <div key={theme} className="flex flex-col gap-2 rounded-lg border border-border p-4" style={themeStyle(theme)}>
                <span className="type-caption opacity-70">{theme === 'light' ? 'Light' : 'Dark'}</span>
                <Steps />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  ),
}
