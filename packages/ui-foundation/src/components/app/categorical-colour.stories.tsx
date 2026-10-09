import type { Meta, StoryObj } from '@storybook/react-vite'
import { TagIcon } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Card, CardContent } from '@/components/ui/card'

// Not a component: every categorical slot (styles/theme.css, the
// "Categorical colour" section of conventions/docs/design-language.md)
// side by side, as a tinted glyph beside a foreground label, the way an app
// uses one. Default shows them once on the page and once on a card, the two
// surfaces a slot sits on, so the glyph contrast check measures each slot
// against both in both themes (e2e/storybook-visual.spec.ts). The slot near
// info is marked. SideBySide shows both themes at once, and as readers
// with the two common colour-vision deficiencies see them.
//
// Whole class names, as an app's own slot -> class map has them: Tailwind
// only generates classes it finds written out.
const SLOTS = [
  { slot: 1, colour: 'text-category-1', name: 'blue', nearInfo: true },
  { slot: 2, colour: 'text-category-2', name: 'orange' },
  { slot: 3, colour: 'text-category-3', name: 'green' },
  { slot: 4, colour: 'text-category-4', name: 'purple' },
  { slot: 5, colour: 'text-category-5', name: 'pink' },
  { slot: 6, colour: 'text-category-6', name: 'brown' },
  { slot: 7, colour: 'text-category-7', name: 'teal' },
  { slot: 8, colour: 'text-category-8', name: 'red' },
  { slot: 9, colour: 'text-category-9', name: 'gold' },
  { slot: 10, colour: 'text-category-10', name: 'navy' },
  { slot: 11, colour: 'text-category-11', name: 'lime' },
  { slot: 12, colour: 'text-category-12', name: 'magenta' },
] as const

const meta: Meta = {
  title: 'patterns/CategoricalColour',
  parameters: { controls: { disable: true } },
}

export default meta

function Slots({ surface, muted = 'text-muted-foreground' }: { surface?: string; muted?: string }) {
  return (
    <ul className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4" data-surface={surface}>
      {SLOTS.map(({ slot, colour, name, ...rest }) => (
        <li key={slot} className="flex items-center gap-2 type-body" data-slot-number={slot}>
          <TagIcon aria-hidden="true" className={`size-4 shrink-0 ${colour}`} />
          <span className="whitespace-nowrap">{slot}. {name}</span>
          {'nearInfo' in rest && <span className={`type-caption ${muted}`}>near info</span>}
        </li>
      ))}
    </ul>
  )
}

export const Default: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-6 text-foreground">
      <section className="flex flex-col gap-2">
        <h2 className="type-label">On the page</h2>
        <Slots surface="background" />
      </section>
      <Card>
        <CardContent className="flex flex-col gap-2">
          <h2 className="type-label">On a card</h2>
          <Slots surface="card" />
        </CardContent>
      </Card>
    </div>
  ),
}

// Machado, Oliveira & Fernandes (2009), full severity, on sRGB values: the
// same simulation tests/category-slots.test.ts measures.
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

// Each panel pins its own theme, whichever one Storybook is in: the page
// colours from the primitives the themes use, and each slot from its own
// shade (-700 light, -400 dark).
function themeStyle(theme: 'light' | 'dark'): CSSProperties {
  const shade = theme === 'light' ? '700' : '400'
  return {
    background: theme === 'light' ? 'var(--white)' : 'var(--black)',
    color: theme === 'light' ? 'var(--black)' : 'var(--gray-50)',
    ...Object.fromEntries(SLOTS.map(({ slot }) => [`--category-${slot}`, `var(--category-${slot}-${shade})`])),
  }
}

export const SideBySide: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-6 text-foreground">
      <svg aria-hidden="true" className="absolute size-0">
        {VISIONS.map(({ id, matrix }) =>
          matrix ? (
            <filter key={id} id={`categorical-${id}`} colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values={matrix} />
            </filter>
          ) : null,
        )}
      </svg>
      {VISIONS.map(({ id, label, matrix }) => (
        <section key={id} className="flex flex-col gap-2">
          <h2 className="type-label">{label}</h2>
          <div className="grid gap-4 lg:grid-cols-2" style={matrix ? { filter: `url(#categorical-${id})` } : undefined}>
            {(['light', 'dark'] as const).map((theme) => (
              <div key={theme} className="flex flex-col gap-2 rounded-lg border border-border p-4" style={themeStyle(theme)}>
                <span className="type-caption opacity-70">{theme === 'light' ? 'Light' : 'Dark'}</span>
                <Slots muted="opacity-70" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  ),
}
