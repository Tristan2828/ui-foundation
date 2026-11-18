import type { Meta, StoryObj } from '@/fixtures/types'
import { useId, useState, type ReactNode } from 'react'
import { PencilIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { EqualItems, type EqualItem, type EqualItemsLook } from './equal-items'
import { IconAction } from './icon-action'

// A few equal things in a record (R10), all made up: the three phases of a
// training plan and three options (Basic, Plus, Pro), each in the four
// looks, then the edges: long titles, an item with no fields, one item,
// seven items and none. Axe, the token-colour check and the glyph check
// measure every one in both themes and each palette
// (e2e/fixtures-visual.spec.ts); e2e/equal-items.spec.ts uses featured's
// toggles from the keyboard and measures each look at a phone's width.
const meta: Meta = {
  title: 'app/EqualItems',
  parameters: { controls: { disable: true } },
}

export default meta

const PHASES: EqualItem[] = [
  {
    id: 'p1',
    title: 'Phase 1',
    state: { label: 'Done', tone: 'success' },
    fields: [
      { label: 'Weeks', value: '1–4' },
      { label: 'Focus', value: 'Easy base miles' },
      { label: 'Sessions', value: '3 a week' },
    ],
  },
  {
    id: 'p2',
    title: 'Phase 2',
    state: { label: 'Current', tone: 'info' },
    fields: [
      { label: 'Weeks', value: '5–8' },
      { label: 'Focus', value: 'Hills and tempo' },
      { label: 'Sessions', value: '4 a week' },
    ],
  },
  {
    id: 'p3',
    title: 'Phase 3',
    state: 'Planned',
    fields: [
      { label: 'Weeks', value: '9–12' },
      { label: 'Focus', value: 'Race pace' },
      { label: 'Sessions', value: null },
    ],
  },
]

const OPTIONS: EqualItem[] = [
  {
    id: 'basic',
    title: 'Basic',
    state: 'Free',
    fields: [
      { label: 'Price', value: '$0' },
      { label: 'Seats', value: '1' },
      { label: 'Storage', value: '2 GB' },
    ],
  },
  {
    id: 'plus',
    title: 'Plus',
    state: { label: 'Best value', tone: 'success' },
    fields: [
      { label: 'Price', value: '$8 / month' },
      { label: 'Seats', value: '3' },
      { label: 'Storage', value: '50 GB' },
    ],
  },
  {
    id: 'pro',
    title: 'Pro',
    state: { label: 'Over budget', tone: 'warning' },
    fields: [
      { label: 'Price', value: '$20 / month' },
      { label: 'Seats', value: '10' },
      { label: 'Storage', value: '1 TB' },
      { label: 'Support', value: 'Same day' },
    ],
  },
]

const LONG_TITLES: EqualItem[] = [
  {
    id: 'l1',
    title: 'Getting back to an easy half hour without stopping, three mornings a week',
    state: { label: 'Done', tone: 'success' },
    fields: [{ label: 'Weeks', value: '1–6' }, { label: 'Focus', value: 'An unusually long description of the focus for this phase, to see it wrap' }],
  },
  {
    id: 'l2',
    title: 'Building up the long run with one longer day at the end of each week',
    state: { label: 'Current', tone: 'info' },
    fields: [{ label: 'Weeks', value: '7–12' }, { label: 'Focus', value: 'Distance' }],
  },
  {
    id: 'l3',
    title: 'Tapering',
    state: 'Planned',
    fields: [{ label: 'Weeks', value: '13–14' }],
  },
]

const EDGES: EqualItem[] = [
  { id: 'e1', title: 'Phase 1', state: { label: 'Done', tone: 'success' }, fields: [{ label: 'Weeks', value: '1–4' }] },
  { id: 'e2', title: 'Rest week', state: 'Planned' },
  { id: 'e3', title: 'Phase 2', fields: [{ label: 'Weeks', value: '6–9' }, { label: 'Focus', value: 'Strength' }] },
]

const SEVEN: EqualItem[] = Array.from({ length: 7 }, (_, i) => ({
  id: `s${i + 1}`,
  title: `Week ${i + 1}`,
  state: i < 3 ? { label: 'Done', tone: 'success' as const } : i === 3 ? { label: 'Current', tone: 'info' as const } : 'Planned',
  fields: [
    { label: 'Distance', value: `${12 + i * 2} km` },
    { label: 'Long Run', value: `${6 + i} km` },
  ],
}))

const LOOKS: EqualItemsLook[] = ['cards', 'table', 'featured', 'panels']

function InSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="max-w-5xl">
      <CardHeader>
        <h2 className="type-section-title text-foreground">{title}</h2>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

const one = (look: EqualItemsLook, items: EqualItem[], label: string, extra?: { featuredId?: string; defaultOpenIds?: string[] }) => (
  <InSection title={label}>
    <EqualItems look={look} items={items} label={label} {...extra} />
  </InSection>
)

export const Cards: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-6">
      {one('cards', PHASES, 'Phases')}
      {one('cards', OPTIONS, 'Options')}
    </div>
  ),
}

export const TableLook: StoryObj = {
  name: 'Table',
  render: () => (
    <div className="flex flex-col gap-6">
      {one('table', PHASES, 'Phases')}
      {one('table', OPTIONS, 'Options')}
    </div>
  ),
}

export const Featured: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-6">
      {one('featured', PHASES, 'Phases', { featuredId: 'p2' })}
      {one('featured', OPTIONS, 'Options', { featuredId: 'plus', defaultOpenIds: ['pro'] })}
    </div>
  ),
}

export const Panels: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-6">
      {one('panels', PHASES, 'Phases')}
      {one('panels', OPTIONS, 'Options')}
    </div>
  ),
}

export const LongTitles: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-6">
      {LOOKS.map((look) => (
        <div key={look}>{one(look, LONG_TITLES, `Long titles, ${look}`, { featuredId: 'l2', defaultOpenIds: ['l1'] })}</div>
      ))}
    </div>
  ),
}

export const NoFields: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-6">
      {LOOKS.map((look) => (
        <div key={look}>{one(look, EDGES, `No fields, ${look}`, { featuredId: 'e2', defaultOpenIds: ['e1'] })}</div>
      ))}
    </div>
  ),
}

export const OneItem: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-6">
      {LOOKS.map((look) => (
        <div key={look}>{one(look, PHASES.slice(1, 2), `One item, ${look}`)}</div>
      ))}
    </div>
  ),
}

export const SevenItems: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-6">
      {LOOKS.map((look) => (
        <div key={look}>{one(look, SEVEN, `Seven items, ${look}`, { featuredId: 's4' })}</div>
      ))}
    </div>
  ),
}

// An item's own content and actions (4.94): the stores a price is
// compared at, each with Edit and Remove at its title line's end (the
// table's last column). Edit swaps the item's fields for an editor of
// several fields, as its `content`, and makes it `wide`: the whole row of
// cards or panels, never the label/value grid's narrow value column. One
// starts open so every look shows an editor. e2e/equal-items.spec.ts
// measures the editor's width and uses Edit, Save and Remove.
type Store = { id: string; name: string; price: string; delivery: string }

const STORES: Store[] = [
  { id: 'corner', name: 'Corner Hardware', price: '$42.00', delivery: 'Next day' },
  { id: 'northwind', name: 'Northwind Lumber', price: '$38.50', delivery: '3 days' },
  { id: 'example', name: 'Example Supply', price: '$40.25', delivery: '' },
]

function StoreEditor({ store, onSave, onCancel }: { store: Store; onSave: (next: Store) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(store)
  const id = useId()
  const field = (key: 'name' | 'price' | 'delivery', label: string) => (
    <Field>
      <FieldLabel htmlFor={`${id}-${key}`}>{label}</FieldLabel>
      <Input id={`${id}-${key}`} value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
    </Field>
  )
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSave(draft)
      }}
    >
      <FieldGroup className="sm:flex-row sm:[&>*]:flex-1">
        {field('name', 'Store')}
        {field('price', 'Price')}
        {field('delivery', 'Delivery')}
      </FieldGroup>
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Save
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function StoresWithEditor({ look }: { look: EqualItemsLook }) {
  const [stores, setStores] = useState(STORES)
  const [editing, setEditing] = useState<string | null>('northwind')
  const items: EqualItem[] = stores.map((store) => {
    const open = editing === store.id
    return {
      id: store.id,
      title: store.name,
      state: store.id === 'northwind' ? { label: 'Cheapest', tone: 'success' } : undefined,
      fields: open
        ? undefined
        : [
            { label: 'Price', value: store.price },
            { label: 'Delivery', value: store.delivery },
          ],
      wide: open,
      content: open && (
        <StoreEditor
          store={store}
          onCancel={() => setEditing(null)}
          onSave={(next) => {
            setStores((all) => all.map((one) => (one.id === next.id ? next : one)))
            setEditing(null)
          }}
        />
      ),
      actions: (
        <>
          <IconAction icon={PencilIcon} label={`Edit ${store.name}`} size="sm" variant="ghost" onClick={() => setEditing(store.id)} />
          <IconAction
            icon={Trash2Icon}
            label={`Remove ${store.name}`}
            tone="destructive"
            size="sm"
            variant="ghost"
            onClick={() => setStores((all) => all.filter((one) => one.id !== store.id))}
          />
        </>
      ),
    }
  })
  return (
    <InSection title={`Stores, ${look}`}>
      <EqualItems look={look} items={items} label={`Stores, ${look}`} featuredId="northwind" defaultOpenIds={['corner']} />
    </InSection>
  )
}

export const ContentAndActions: StoryObj = {
  name: 'Content and actions',
  render: () => (
    <div className="flex flex-col gap-6">
      {LOOKS.map((look) => (
        <StoresWithEditor key={look} look={look} />
      ))}
    </div>
  ),
}

export const Empty: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-6">
      {one('cards', [], 'Empty phases')}
    </div>
  ),
}
