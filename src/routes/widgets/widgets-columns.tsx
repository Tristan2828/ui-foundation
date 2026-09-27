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

// Enum → tone-mapped badge: group the values by what they *mean* (good /
// neutral / bad) first, then pick one style for the whole column. The
// grouping is the real decision; the style is mostly consistency with the
// table's other columns. See docs/design-language.md.
//
// Only `active` earns a tone. `archived` is an end state, not a failure,
// so it stays neutral — a red badge would tell the reader something is
// wrong when nothing is.
//
// (An earlier comment here said the `destructive` badge fails AA contrast.
// That was true of the tinted variant shadcn originally shipped; Phase 5
// replaced it with a solid fill, and white on `--destructive` measures
// 4.76:1, which passes. The claim outlived the bug.)
const STATUS_BADGE_VARIANT: Record<WidgetStatus, 'outline' | 'outline-success' | 'secondary'> = {
  draft: 'outline',
  active: 'outline-success',
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
      // Multi choice: one outline badge per selected option; an em dash
      // when none (same empty display as Assignee), never an empty cell.
      id: 'tags',
      accessorKey: 'tags',
      header: 'Tags',
      enableSorting: false,
      cell: ({ getValue }) => {
        const tags = getValue() as Widget['tags']
        if (tags.length === 0) return <span className="text-muted-foreground">—</span>
        return (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        )
      },
    },
    {
      id: 'actions',
      // Visually empty, but a <th> with no text is an axe violation.
      header: () => <span className="sr-only">Actions</span>,
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
