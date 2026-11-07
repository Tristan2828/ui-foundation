import type { Meta, StoryObj } from '@/fixtures/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const ROWS = [
  { name: 'Wireless Mouse', status: 'Active', price: '24.99' },
  { name: 'Standing Desk', status: 'Draft', price: '389.00' },
  { name: 'USB-C Hub', status: 'Archived', price: '49.50' },
]

function SampleTable({ caption }: { caption: string }) {
  return (
    <Table aria-label={caption}>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Price</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ROWS.map((row) => (
          <TableRow key={row.name}>
            <TableCell>{row.name}</TableCell>
            <TableCell>{row.status}</TableCell>
            <TableCell className="text-right tabular-nums">{row.price}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

const meta: Meta<typeof Table> = {
  title: 'ui/Table',
  component: Table,
  parameters: { controls: { disable: true } },
}

export default meta
type Story = StoryObj<typeof Table>

export const Default: Story = {
  render: () => <SampleTable caption="Widgets" />,
}

// The four densities side by side. Density is a token set, not a prop:
// data-density on any ancestor retunes the cells' padding and the header
// height (styles/theme.css); large also grows the text. e2e/fixtures-visual.spec.ts
// measures that the rows really do differ. Regular rows (a device's pick in
// the shell's look menu, data-rows on <html>) sit between the default and
// comfortable; a data-density inside them still wins.
export const Densities: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      {(['compact', 'default', 'comfortable', 'large'] as const).map((density) => (
        <section key={density} data-density={density === 'default' ? undefined : density}>
          <p className="type-label mb-2 text-muted-foreground">{density}</p>
          <SampleTable caption={`Widgets (${density})`} />
        </section>
      ))}
      <section data-rows="regular">
        <p className="type-label mb-2 text-muted-foreground">regular rows (data-rows)</p>
        <SampleTable caption="Widgets (regular rows)" />
      </section>
      <section data-rows="regular">
        <div data-density="compact">
          <p className="type-label mb-2 text-muted-foreground">compact inside regular rows</p>
          <SampleTable caption="Widgets (compact in regular rows)" />
        </div>
      </section>
    </div>
  ),
}
