import type { Meta, StoryObj } from '@/fixtures/types'
import type { CSSProperties } from 'react'
import { Card, CardContent } from '@/components/ui/card'

// Not a component: the depth ramps (styles/theme.css, the "Depth ramps"
// section of conventions/docs/design-language.md), five steps for each
// categorical slot, the two ways an app uses them: shapes filled with
// `fill-category-N-depth-M` and cells filled with `bg-category-N-depth-M`
// holding their own text. Default shows every ramp on the page and on a
// card, so the fixtures checks measure each step against both surfaces.
// SideBySide shows both themes at once, each ramp beside the muted greys
// (--muted and --muted-foreground) of its theme, under normal vision and
// simulated deuteranopia and protanopia.
//
// Whole class names, as an app's own step -> class map has them: Tailwind
// only generates classes it finds written out.
const RAMPS = [
  {
    slot: 1,
    name: 'Blue',
    steps: [
      { step: 1, fill: 'fill-category-1-depth-1', cell: 'bg-category-1-depth-1 text-category-1-depth-1-foreground' },
      { step: 2, fill: 'fill-category-1-depth-2', cell: 'bg-category-1-depth-2 text-category-1-depth-2-foreground' },
      { step: 3, fill: 'fill-category-1-depth-3', cell: 'bg-category-1-depth-3 text-category-1-depth-3-foreground' },
      { step: 4, fill: 'fill-category-1-depth-4', cell: 'bg-category-1-depth-4 text-category-1-depth-4-foreground' },
      { step: 5, fill: 'fill-category-1-depth-5', cell: 'bg-category-1-depth-5 text-category-1-depth-5-foreground' },
    ],
  },
  {
    slot: 2,
    name: 'Orange',
    steps: [
      { step: 1, fill: 'fill-category-2-depth-1', cell: 'bg-category-2-depth-1 text-category-2-depth-1-foreground' },
      { step: 2, fill: 'fill-category-2-depth-2', cell: 'bg-category-2-depth-2 text-category-2-depth-2-foreground' },
      { step: 3, fill: 'fill-category-2-depth-3', cell: 'bg-category-2-depth-3 text-category-2-depth-3-foreground' },
      { step: 4, fill: 'fill-category-2-depth-4', cell: 'bg-category-2-depth-4 text-category-2-depth-4-foreground' },
      { step: 5, fill: 'fill-category-2-depth-5', cell: 'bg-category-2-depth-5 text-category-2-depth-5-foreground' },
    ],
  },
  {
    slot: 3,
    name: 'Green',
    steps: [
      { step: 1, fill: 'fill-category-3-depth-1', cell: 'bg-category-3-depth-1 text-category-3-depth-1-foreground' },
      { step: 2, fill: 'fill-category-3-depth-2', cell: 'bg-category-3-depth-2 text-category-3-depth-2-foreground' },
      { step: 3, fill: 'fill-category-3-depth-3', cell: 'bg-category-3-depth-3 text-category-3-depth-3-foreground' },
      { step: 4, fill: 'fill-category-3-depth-4', cell: 'bg-category-3-depth-4 text-category-3-depth-4-foreground' },
      { step: 5, fill: 'fill-category-3-depth-5', cell: 'bg-category-3-depth-5 text-category-3-depth-5-foreground' },
    ],
  },
  {
    slot: 4,
    name: 'Purple',
    steps: [
      { step: 1, fill: 'fill-category-4-depth-1', cell: 'bg-category-4-depth-1 text-category-4-depth-1-foreground' },
      { step: 2, fill: 'fill-category-4-depth-2', cell: 'bg-category-4-depth-2 text-category-4-depth-2-foreground' },
      { step: 3, fill: 'fill-category-4-depth-3', cell: 'bg-category-4-depth-3 text-category-4-depth-3-foreground' },
      { step: 4, fill: 'fill-category-4-depth-4', cell: 'bg-category-4-depth-4 text-category-4-depth-4-foreground' },
      { step: 5, fill: 'fill-category-4-depth-5', cell: 'bg-category-4-depth-5 text-category-4-depth-5-foreground' },
    ],
  },
  {
    slot: 5,
    name: 'Pink',
    steps: [
      { step: 1, fill: 'fill-category-5-depth-1', cell: 'bg-category-5-depth-1 text-category-5-depth-1-foreground' },
      { step: 2, fill: 'fill-category-5-depth-2', cell: 'bg-category-5-depth-2 text-category-5-depth-2-foreground' },
      { step: 3, fill: 'fill-category-5-depth-3', cell: 'bg-category-5-depth-3 text-category-5-depth-3-foreground' },
      { step: 4, fill: 'fill-category-5-depth-4', cell: 'bg-category-5-depth-4 text-category-5-depth-4-foreground' },
      { step: 5, fill: 'fill-category-5-depth-5', cell: 'bg-category-5-depth-5 text-category-5-depth-5-foreground' },
    ],
  },
  {
    slot: 6,
    name: 'Brown',
    steps: [
      { step: 1, fill: 'fill-category-6-depth-1', cell: 'bg-category-6-depth-1 text-category-6-depth-1-foreground' },
      { step: 2, fill: 'fill-category-6-depth-2', cell: 'bg-category-6-depth-2 text-category-6-depth-2-foreground' },
      { step: 3, fill: 'fill-category-6-depth-3', cell: 'bg-category-6-depth-3 text-category-6-depth-3-foreground' },
      { step: 4, fill: 'fill-category-6-depth-4', cell: 'bg-category-6-depth-4 text-category-6-depth-4-foreground' },
      { step: 5, fill: 'fill-category-6-depth-5', cell: 'bg-category-6-depth-5 text-category-6-depth-5-foreground' },
    ],
  },
  {
    slot: 7,
    name: 'Teal',
    steps: [
      { step: 1, fill: 'fill-category-7-depth-1', cell: 'bg-category-7-depth-1 text-category-7-depth-1-foreground' },
      { step: 2, fill: 'fill-category-7-depth-2', cell: 'bg-category-7-depth-2 text-category-7-depth-2-foreground' },
      { step: 3, fill: 'fill-category-7-depth-3', cell: 'bg-category-7-depth-3 text-category-7-depth-3-foreground' },
      { step: 4, fill: 'fill-category-7-depth-4', cell: 'bg-category-7-depth-4 text-category-7-depth-4-foreground' },
      { step: 5, fill: 'fill-category-7-depth-5', cell: 'bg-category-7-depth-5 text-category-7-depth-5-foreground' },
    ],
  },
  {
    slot: 8,
    name: 'Red',
    steps: [
      { step: 1, fill: 'fill-category-8-depth-1', cell: 'bg-category-8-depth-1 text-category-8-depth-1-foreground' },
      { step: 2, fill: 'fill-category-8-depth-2', cell: 'bg-category-8-depth-2 text-category-8-depth-2-foreground' },
      { step: 3, fill: 'fill-category-8-depth-3', cell: 'bg-category-8-depth-3 text-category-8-depth-3-foreground' },
      { step: 4, fill: 'fill-category-8-depth-4', cell: 'bg-category-8-depth-4 text-category-8-depth-4-foreground' },
      { step: 5, fill: 'fill-category-8-depth-5', cell: 'bg-category-8-depth-5 text-category-8-depth-5-foreground' },
    ],
  },
  {
    slot: 9,
    name: 'Gold',
    steps: [
      { step: 1, fill: 'fill-category-9-depth-1', cell: 'bg-category-9-depth-1 text-category-9-depth-1-foreground' },
      { step: 2, fill: 'fill-category-9-depth-2', cell: 'bg-category-9-depth-2 text-category-9-depth-2-foreground' },
      { step: 3, fill: 'fill-category-9-depth-3', cell: 'bg-category-9-depth-3 text-category-9-depth-3-foreground' },
      { step: 4, fill: 'fill-category-9-depth-4', cell: 'bg-category-9-depth-4 text-category-9-depth-4-foreground' },
      { step: 5, fill: 'fill-category-9-depth-5', cell: 'bg-category-9-depth-5 text-category-9-depth-5-foreground' },
    ],
  },
  {
    slot: 10,
    name: 'Navy',
    steps: [
      { step: 1, fill: 'fill-category-10-depth-1', cell: 'bg-category-10-depth-1 text-category-10-depth-1-foreground' },
      { step: 2, fill: 'fill-category-10-depth-2', cell: 'bg-category-10-depth-2 text-category-10-depth-2-foreground' },
      { step: 3, fill: 'fill-category-10-depth-3', cell: 'bg-category-10-depth-3 text-category-10-depth-3-foreground' },
      { step: 4, fill: 'fill-category-10-depth-4', cell: 'bg-category-10-depth-4 text-category-10-depth-4-foreground' },
      { step: 5, fill: 'fill-category-10-depth-5', cell: 'bg-category-10-depth-5 text-category-10-depth-5-foreground' },
    ],
  },
  {
    slot: 11,
    name: 'Lime',
    steps: [
      { step: 1, fill: 'fill-category-11-depth-1', cell: 'bg-category-11-depth-1 text-category-11-depth-1-foreground' },
      { step: 2, fill: 'fill-category-11-depth-2', cell: 'bg-category-11-depth-2 text-category-11-depth-2-foreground' },
      { step: 3, fill: 'fill-category-11-depth-3', cell: 'bg-category-11-depth-3 text-category-11-depth-3-foreground' },
      { step: 4, fill: 'fill-category-11-depth-4', cell: 'bg-category-11-depth-4 text-category-11-depth-4-foreground' },
      { step: 5, fill: 'fill-category-11-depth-5', cell: 'bg-category-11-depth-5 text-category-11-depth-5-foreground' },
    ],
  },
  {
    slot: 12,
    name: 'Magenta',
    steps: [
      { step: 1, fill: 'fill-category-12-depth-1', cell: 'bg-category-12-depth-1 text-category-12-depth-1-foreground' },
      { step: 2, fill: 'fill-category-12-depth-2', cell: 'bg-category-12-depth-2 text-category-12-depth-2-foreground' },
      { step: 3, fill: 'fill-category-12-depth-3', cell: 'bg-category-12-depth-3 text-category-12-depth-3-foreground' },
      { step: 4, fill: 'fill-category-12-depth-4', cell: 'bg-category-12-depth-4 text-category-12-depth-4-foreground' },
      { step: 5, fill: 'fill-category-12-depth-5', cell: 'bg-category-12-depth-5 text-category-12-depth-5-foreground' },
    ],
  },
] as const

const meta: Meta = {
  title: 'patterns/DepthRamps',
  parameters: { controls: { disable: true } },
}

export default meta

// Whole class names, as above: the grid gains a last column for the greys.
const ROW = 'grid max-w-xl grid-cols-[4.5rem_1fr] items-center gap-2 sm:grid-cols-[4.5rem_8rem_1fr]'
const ROW_WITH_GREYS = 'grid max-w-xl grid-cols-[4.5rem_1fr_auto] items-center gap-2 sm:grid-cols-[4.5rem_8rem_1fr_auto]'

function Ramps({ surface, greys }: { surface?: string; greys?: boolean }) {
  return (
    <div className="flex flex-col gap-2" data-surface={surface}>
      {RAMPS.map(({ slot, name, steps }) => (
        <div key={slot} className={greys ? ROW_WITH_GREYS : ROW}>
          <span className="type-caption">{name}</span>
          <svg aria-hidden="true" viewBox="0 0 100 10" className="hidden h-6 w-full sm:block" preserveAspectRatio="none">
            {steps.map(({ step, fill }, i) => (
              <rect key={step} data-depth-fill={`${slot}-${step}`} className={fill} x={i * 20} width="20" height="10" />
            ))}
          </svg>
          <ul className="grid grid-cols-5 gap-1">
            {steps.map(({ step, cell }) => (
              <li key={step} data-depth-cell={`${slot}-${step}`} className={`rounded-sm px-1 py-1 text-center type-caption ${cell}`}>
                <span className="hidden sm:inline">Depth </span>
                {step}
              </li>
            ))}
          </ul>
          {greys ? (
            <span aria-hidden="true" className="flex gap-1">
              <span data-grey="muted" className="size-6 rounded-sm border border-border bg-muted" />
              <span data-grey="muted-foreground" className="size-6 rounded-sm bg-muted-foreground" />
            </span>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export const Default: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-6 text-foreground">
      <section className="flex flex-col gap-2">
        <h2 className="type-label">On the page</h2>
        <Ramps surface="background" />
      </section>
      <Card>
        <CardContent className="flex flex-col gap-2">
          <h2 className="type-label">On a card</h2>
          <Ramps surface="card" />
        </CardContent>
      </Card>
    </div>
  ),
}

// Machado, Oliveira & Fernandes (2009), full severity, on sRGB values: the
// same simulation tests/depth-ramps.test.ts measures.
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

// Each panel pins its own theme, whichever theme the page is in: each step
// from its own shade (-700 light, -400 dark), its text as that theme has it
// (black on every dark step; in light, black on step 1 of every slot and
// white on the rest, as theme.css has it: tests/depth-ramps.test.ts checks
// this against theme.css) and the muted greys it draws beside them.
const LIGHT_BLACK_TEXT = new Set(['1-1', '2-1', '3-1', '4-1', '5-1', '6-1', '7-1', '8-1', '9-1', '10-1', '11-1', '12-1'])
function themeStyle(theme: 'light' | 'dark'): CSSProperties {
  const shade = theme === 'light' ? '700' : '400'
  return {
    background: theme === 'light' ? 'var(--white)' : 'var(--black)',
    color: theme === 'light' ? 'var(--black)' : 'var(--gray-50)',
    ...Object.fromEntries([
      ['--muted', theme === 'light' ? 'var(--gray-100)' : 'var(--gray-900)'],
      ['--muted-foreground', theme === 'light' ? 'var(--gray-500)' : 'var(--gray-400)'],
      ...RAMPS.flatMap(({ slot, steps }) =>
        steps.flatMap(({ step }) => [
          [`--category-${slot}-depth-${step}`, `var(--category-${slot}-depth-${step}-${shade})`],
          [`--category-${slot}-depth-${step}-foreground`, theme === 'light' && !LIGHT_BLACK_TEXT.has(`${slot}-${step}`) ? 'var(--white)' : 'var(--black)'],
        ]),
      ),
    ]),
  }
}

export const SideBySide: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-6 text-foreground">
      <svg aria-hidden="true" className="absolute size-0">
        {VISIONS.map(({ id, matrix }) =>
          matrix ? (
            <filter key={id} id={`depth-${id}`} colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values={matrix} />
            </filter>
          ) : null,
        )}
      </svg>
      {VISIONS.map(({ id, label, matrix }) => (
        <section key={id} className="flex flex-col gap-2">
          <h2 className="type-label">{label}</h2>
          <div className="grid gap-4 xl:grid-cols-2" style={matrix ? { filter: `url(#depth-${id})` } : undefined}>
            {(['light', 'dark'] as const).map((theme) => (
              <div key={theme} className="flex flex-col gap-2 rounded-lg border border-border p-4" style={themeStyle(theme)}>
                <span className="type-caption opacity-70">
                  {theme === 'light' ? 'Light' : 'Dark'}: each ramp, then --muted and --muted-foreground
                </span>
                <Ramps greys />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  ),
}
