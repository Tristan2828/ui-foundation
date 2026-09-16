// Column definitions for the widgets table. Table + form are Phase 6's
// copy-this-file reference for the entity playbook — see
// docs/BUILD-PLAN.md "Reference Implementations".
import type { LegacyColumnDef } from '@tanstack/react-table/legacy'
import { PencilIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { components } from '@/api/schema'
import { DeleteWidgetAction } from './delete-widget-action'

type Widget = components['schemas']['Widget']
type WidgetStatus = components['schemas']['WidgetStatus']

const STATUS_BADGE_VARIANT: Record<WidgetStatus, 'default' | 'secondary' | 'outline'> = {
  // Not `destructive` for "archived": the shadcn-shipped destructive badge
  // is a tinted (not solid) variant that fails WCAG AA contrast — the same
  // bug Phase 3 fixed on the Button component but left open on Badge (a
  // Phase 5 palette concern). Using it here would reintroduce that failure.
  draft: 'outline',
  active: 'default',
  archived: 'secondary',
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

const priceFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
})

export function buildWidgetsColumns(
  categoriesById: Record<number, string>,
): LegacyColumnDef<Widget, unknown>[] {
  return [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Name',
      enableSorting: true,
    },
    {
      id: 'category',
      accessorFn: (widget) => categoriesById[widget.categoryId] ?? `#${widget.categoryId}`,
      header: 'Category',
      enableSorting: false,
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      enableSorting: true,
      cell: ({ getValue }) => {
        const status = getValue() as WidgetStatus
        return <Badge variant={STATUS_BADGE_VARIANT[status]}>{status}</Badge>
      },
    },
    {
      id: 'availableFrom',
      accessorKey: 'availableFrom',
      header: 'Available From',
      enableSorting: true,
      cell: ({ getValue }) => dateFormatter.format(new Date(getValue() as string)),
    },
    {
      id: 'assigneeEmail',
      accessorKey: 'assigneeEmail',
      header: 'Assignee',
      enableSorting: false,
      cell: ({ getValue }) => {
        const email = getValue() as string | null
        return email ?? <span className="text-muted-foreground">{'—'}</span>
      },
    },
    {
      id: 'price',
      accessorKey: 'price',
      header: 'Price',
      enableSorting: true,
      cell: ({ getValue }) => priceFormatter.format(Number(getValue())),
    },
    {
      id: 'description',
      accessorKey: 'description',
      header: 'Description',
      enableSorting: false,
      cell: ({ getValue }) => (
        <span className="block max-w-64 truncate" title={getValue() as string}>
          {getValue() as string}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            aria-label={`Edit ${row.original.name}`}
            render={<Link to={`/widgets/${row.original.id}/edit`} />}
          >
            <PencilIcon />
          </Button>
          <DeleteWidgetAction widget={row.original} />
        </div>
      ),
    },
  ]
}
