import type { Meta, StoryObj } from '@/fixtures/types'
import type { LegacyColumnDef } from '@tanstack/react-table/legacy'
import { useCallback, useMemo, useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { AppError } from '@/api/contracts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from './data-table'
import { inPlace } from './edit-in-place-presets'
import { EditableValue } from './editable-value'
import { EntityView, type EntityViewSection } from './entity-view'
import { Markdown } from './markdown'
import { RatingInput } from './rating-input'

// RatingInput: a score set by clicking a star. Default holds every
// state on a card (set, empty, hearts out of ten, disabled), each with its
// value written beside it, so e2e/rating-input.spec.ts can read what a
// click, a key or a second press did. InARecord is `inPlace.rating` in the
// facts rail and in a table's rows, saving to a slow "server" that refuses
// one value, so a save, a clear and a refusal each show where they land.

function Row({ label, initial, ...rest }: { label: string; initial: number | null } & Partial<Parameters<typeof RatingInput>[0]>) {
  const [value, setValue] = useState<number | null>(initial)
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-28 type-label text-foreground">{label}</span>
      <RatingInput label={label} value={value} onChange={(next) => setValue(next)} {...rest} />
      <output data-testid={`${label} value`} className="type-caption text-muted-foreground">
        {value === null ? 'None' : String(value)}
      </output>
    </div>
  )
}

function States() {
  return (
    <div className="p-6">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Ratings</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Row label="Taste" initial={3} />
          <Row label="Value" initial={null} />
          <Row label="Loved" initial={7} max={10} glyph="heart" />
          <Row label="Locked" initial={2} disabled />
        </CardContent>
      </Card>
    </div>
  )
}

type Dish = { id: number; name: string; rating: number | null }

const REFUSED = 1
const refusal: AppError = {
  kind: 'validation',
  message: 'One star needs a note first',
  fieldErrors: { rating: ['One star needs a note first'] },
}

// A "server": saves after a short wait, and refuses one star.
function useServer(initial: Dish[]) {
  const [dishes, setDishes] = useState(initial)
  const save = useCallback(
    (id: number, rating: number | null) =>
      new Promise<void>((resolve, reject) =>
        setTimeout(() => {
          if (rating === REFUSED) return reject(refusal)
          setDishes((all) => all.map((dish) => (dish.id === id ? { ...dish, rating } : dish)))
          resolve()
        }, 250),
      ),
    [],
  )
  return [dishes, save] as const
}

function Record() {
  const [dishes, save] = useServer([
    { id: 1, name: 'Lentil Soup', rating: 4 },
    { id: 2, name: 'Plum Tart', rating: null },
    { id: 3, name: 'Green Salad', rating: 2 },
  ])
  const dish = dishes[0]
  const columns = useMemo<LegacyColumnDef<Dish, unknown>[]>(
    () => [
      { id: 'name', header: 'Dish', cell: ({ row }) => row.original.name },
      {
        id: 'rating',
        header: 'Rating',
        cell: ({ row }) => (
          <EditableRating label={`Rating of ${row.original.name}`} value={row.original.rating} save={(rating) => save(row.original.id, rating)} />
        ),
      },
    ],
    [save],
  )
  const sections: EntityViewSection[] = [
    { title: 'Recipe', tab: 'Recipe', content: <Markdown>{'Simmer the lentils with an onion until soft.'}</Markdown> },
    {
      title: 'Others',
      tab: 'Others',
      content: (
        <DataTable<Dish>
          width="content"
          columns={columns}
          data={dishes}
          total={dishes.length}
          page={1}
          pageSize={25}
          onPageChange={() => {}}
          sorting={[]}
          onSortingChange={() => {}}
          isLoading={false}
          emptyTitle="No dishes"
          getRowId={(row) => String(row.id)}
        />
      ),
    },
    {
      title: 'Facts',
      placement: 'rail',
      facts: [
        { label: 'Course', kind: 'text', text: 'Starter' },
        {
          label: 'My Rating',
          kind: 'rating',
          value: dish.rating,
          edit: inPlace.rating({ value: dish.rating, save: (rating) => save(dish.id, rating) }),
        },
        { label: 'Serves', kind: 'text', text: 4 },
      ],
    },
  ]
  return <EntityView isLoading={false} back={{ to: '/', label: 'Dishes' }} title={dish.name} factsRail sections={sections} />
}

// A table cell's rating: the preset in an EditableValue, inside DataTable's edit-in-place store.
function EditableRating({ label, value, save }: { label: string; value: number | null; save: (rating: number | null) => Promise<unknown> }) {
  return <EditableValue label={label} layout="inline" edit={inPlace.rating({ value, save })} />
}

function RecordInRouter() {
  const [router] = useState(() => {
    const tab = new URLSearchParams(window.location.search).get('tab')
    return createMemoryRouter([{ path: '*', element: <Record /> }], {
      initialEntries: [tab ? `/?tab=${encodeURIComponent(tab)}` : '/'],
    })
  })
  return <RouterProvider router={router} />
}

const meta: Meta = {
  title: 'app/RatingInput',
  parameters: { controls: { disable: true } },
}

export default meta

export const Default: StoryObj = { render: () => <States /> }

export const InARecord: StoryObj = { name: 'In a record', render: () => <RecordInRouter /> }
