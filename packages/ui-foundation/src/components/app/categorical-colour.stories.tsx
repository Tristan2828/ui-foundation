import type { Meta, StoryObj } from '@storybook/react-vite'
import { TagIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

// Not a component: every categorical slot (styles/theme.css, the
// "Categorical colour" section of conventions/docs/design-language.md)
// side by side, as a tinted glyph beside a foreground label, the way an app
// uses one. Once on the page and once on a card, the two surfaces a slot
// sits on, so the glyph contrast check measures each slot against both in
// both themes (e2e/storybook-visual.spec.ts). Slot 9 onward are the deep
// shades; the blue slots near info are marked.
//
// Whole class names, as an app's own slot -> class map has them: Tailwind
// only generates classes it finds written out.
const SLOTS = [
  { slot: 1, colour: 'text-category-1', nearInfo: true },
  { slot: 2, colour: 'text-category-2' },
  { slot: 3, colour: 'text-category-3' },
  { slot: 4, colour: 'text-category-4' },
  { slot: 5, colour: 'text-category-5' },
  { slot: 6, colour: 'text-category-6', nearInfo: true },
  { slot: 7, colour: 'text-category-7' },
  { slot: 8, colour: 'text-category-8', nearInfo: true },
  { slot: 9, colour: 'text-category-9' },
  { slot: 10, colour: 'text-category-10' },
  { slot: 11, colour: 'text-category-11' },
  { slot: 12, colour: 'text-category-12' },
] as const

const meta: Meta = {
  title: 'patterns/CategoricalColour',
  parameters: { controls: { disable: true } },
}

export default meta

function Slots({ surface }: { surface: string }) {
  return (
    <ul className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4" data-surface={surface}>
      {SLOTS.map(({ slot, colour, ...rest }) => (
        <li key={slot} className="flex items-center gap-2 type-body text-foreground" data-slot-number={slot}>
          <TagIcon aria-hidden="true" className={`size-4 shrink-0 ${colour}`} />
          category-{slot}
          {'nearInfo' in rest && <span className="type-caption text-muted-foreground">near info</span>}
        </li>
      ))}
    </ul>
  )
}

export const Default: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-6">
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
