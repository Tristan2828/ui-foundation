import type { Meta, StoryObj } from '@/fixtures/types'
import type { LegacyColumnDef } from '@tanstack/react-table/legacy'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { PALETTES } from '@/lib/palettes'
import { ColorSwatch } from './color-swatch'
import { DataTable } from './data-table'

// ColorSwatch, a colour stored as data beside its name (the design
// language's "A stored colour"), in a real browser
// (e2e/fixtures-visual.spec.ts): axe, the token check (the stored fill is
// the one colour exempt from it) and the ring's 3:1 against what's behind
// it, in light, dark and every palette.
// - Default: colours that are hard to see on one surface or another (white,
//   black, the page's own greys, a translucent one), on the page, on a card
//   and on a muted surface, at both sizes.
// - InvalidAndMissing: the empty swatch for a missing, empty or bad value.
// - InABadge: the small size inside every Badge style an app would use.
// - InATable: a DataTable column of stored colours (cell pattern 2's shape).
// - LongName: a name too long for its column, cut, its whole text kept.
// - EveryPalette: dark and each palette side by side, for a look; the
//   checks run each palette on the stories above.

const COLOURS = [
  { color: '#c0392b', label: 'Brick red' },
  { color: '#1f3a5f', label: 'Deep navy' },
  { color: '#ffffff', label: 'Plain white' },
  { color: '#000000', label: 'Black' },
  { color: '#f5f5f5', label: 'Off white' },
  { color: '#171717', label: 'Near black' },
  { color: '#2d6a4f80', label: 'Half-clear green' },
  { color: 'E9C46A', label: 'Sand (stored without #)' },
] as const

const meta: Meta = {
  title: 'app/ColorSwatch',
  parameters: { controls: { disable: true } },
}

export default meta

function Swatches({ size }: { size?: 'sm' | 'default' }) {
  return (
    <ul className="grid grid-cols-2 gap-x-6 gap-y-2 type-body sm:grid-cols-4">
      {COLOURS.map(({ color, label }) => (
        <li key={label}>
          <ColorSwatch color={color} label={label} size={size} />
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
        <Swatches />
        <Swatches size="sm" />
      </section>
      <Card>
        <CardContent className="flex flex-col gap-2">
          <h2 className="type-label">On a card</h2>
          <Swatches />
          <Swatches size="sm" />
        </CardContent>
      </Card>
      <section className="flex flex-col gap-2 rounded-lg bg-muted p-4">
        <h2 className="type-label">On a muted surface</h2>
        <Swatches />
      </section>
    </div>
  ),
}

export const InvalidAndMissing: StoryObj = {
  render: () => (
    <Card>
      <CardContent>
        <ul className="flex flex-col gap-2 type-body">
          <li><ColorSwatch color={null} label="No colour" /></li>
          <li><ColorSwatch color="" label="Left blank" /></li>
          <li><ColorSwatch color="not a colour" label="Typed wrong" /></li>
          <li><ColorSwatch color="#12345" label="Five digits" /></li>
          <li><ColorSwatch color="red" label="A word, not a hex" /></li>
          <li><ColorSwatch color={undefined} label="No colour" size="sm" /></li>
        </ul>
      </CardContent>
    </Card>
  ),
}

export const InABadge: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-4 text-foreground">
      {(['outline', 'secondary', 'default'] as const).map((variant) => (
        <div key={variant} className="flex flex-wrap items-center gap-2">
          <span className="type-caption w-20 text-muted-foreground">{variant}</span>
          <Badge variant={variant}><ColorSwatch size="sm" color="#c0392b" label="Brick red" /></Badge>
          <Badge variant={variant}><ColorSwatch size="sm" color="#ffffff" label="Plain white" /></Badge>
          <Badge variant={variant}><ColorSwatch size="sm" color="#000000" label="Black" /></Badge>
          <Badge variant={variant}><ColorSwatch size="sm" color={null} label="No colour" /></Badge>
        </div>
      ))}
    </div>
  ),
}

type Label = { id: number; name: string; color: string | null }

const LABELS: Label[] = [
  { id: 1, name: 'Work', color: '#1f3a5f' },
  { id: 2, name: 'Home', color: '#e9c46a' },
  { id: 3, name: 'Garden', color: '#2d6a4f' },
  { id: 4, name: 'Errands', color: '#ffffff' },
  { id: 5, name: 'Someday', color: null },
]

// Made once, outside the render, as a columns file has them.
const LABEL_COLUMNS: LegacyColumnDef<Label, unknown>[] = [
  { id: 'name', header: 'Label', cell: ({ row }) => row.original.name },
  {
    id: 'color',
    header: 'Colour',
    // The value's own text beside the swatch: the hex, or "No colour".
    cell: ({ row }) => <ColorSwatch color={row.original.color} label={row.original.color ?? 'No colour'} />,
  },
]

const noop = () => {}

export const InATable: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-4">
      <h1 className="type-page-title text-foreground">Labels</h1>
      <DataTable<Label>
        width="content"
        columns={LABEL_COLUMNS}
        data={LABELS}
        total={LABELS.length}
        page={1}
        pageSize={25}
        onPageChange={noop}
        sorting={[]}
        onSortingChange={noop}
        isLoading={false}
        error={null}
        onRetry={noop}
        emptyTitle="No labels yet"
        getRowId={(row) => String(row.id)}
      />
    </div>
  ),
}

export const LongName: StoryObj = {
  render: () => (
    <Card className="w-64">
      <CardContent className="flex flex-col gap-2 type-body">
        <h2 className="type-label">A name longer than its column</h2>
        <ColorSwatch color="#8d99ae" label="Manufacturer's very long colour name, eggshell finish, interior" />
        <Badge variant="outline" className="max-w-full">
          <ColorSwatch size="sm" color="#8d99ae" label="Manufacturer's very long colour name, eggshell finish, interior" />
        </Badge>
      </CardContent>
    </Card>
  ),
}

export const EveryPalette: StoryObj = {
  render: () => (
    <div className="grid gap-4 lg:grid-cols-2">
      {(['none', ...PALETTES] as const).map((palette) => (
        <div
          key={palette}
          className="dark flex flex-col gap-2 rounded-lg border border-border bg-background p-4 text-foreground"
          data-palette={palette === 'none' ? undefined : palette}
        >
          <span className="type-caption text-muted-foreground">{palette === 'none' ? 'Dark' : palette}</span>
          <Card>
            <CardContent>
              <Swatches />
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  ),
}
