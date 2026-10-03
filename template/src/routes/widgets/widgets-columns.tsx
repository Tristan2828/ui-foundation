// Column definitions for the widgets table. Table and form are the
// copy-this-file reference for the entity playbook
// (docs/foundation/add-an-entity.md).
import type { LegacyColumnDef } from '@tanstack/react-table/legacy'
import { PencilIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@tristan2828/ui-foundation/ui/badge'
import { Button } from '@tristan2828/ui-foundation/ui/button'
import type { components } from '@/api/schema'
import { CategoryName } from './category-names'
import { DeleteWidgetAction } from './delete-widget-action'
import { InStockToggle } from './in-stock-toggle'
import { CHECKLIST_STATE_LABELS, WIDGET_TAG_LABELS } from './widget-schema'

type Widget = components['schemas']['Widget']
type WidgetStatus = components['schemas']['WidgetStatus']
type WidgetChecklistState = components['schemas']['WidgetChecklistState']

// Enum → tone-mapped badge: group the values by what they *mean* (good /
// neutral / bad) first, then pick one style for the whole column. The
// grouping is the real decision; the style is mostly consistency with the
// table's other columns. See docs/foundation/design-language.md.
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

// Computed field (the server works it out): an enum → tone-mapped badge
// like Status. Only `complete` earns a tone; an empty or unfinished list
// isn't a problem.
const CHECKLIST_STATE_BADGE_VARIANT: Record<WidgetChecklistState, 'outline' | 'outline-success' | 'secondary'> = {
  none: 'secondary',
  open: 'outline',
  complete: 'outline-success',
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

// Takes nothing that changes after the first render: rebuilt columns
// remount every cell (see category-names.tsx). Data that arrives later
// (names) reaches the cells through context instead.
export function buildWidgetsColumns(): LegacyColumnDef<Widget, unknown>[] {
  return [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Name',
      enableSorting: true,
    },
    {
      id: 'category',
      accessorKey: 'categoryId',
      cell: ({ getValue }) => <CategoryName id={getValue() as number} />,
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
                {WIDGET_TAG_LABELS[tag]}
              </Badge>
            ))}
          </div>
        )
      },
    },
    {
      // Multi reference: one outline badge per linked record, by name (the
      // table looks up every id on the page at once; see widgets-table.tsx).
      // An em dash when none, like Tags. A name still loading shows "…",
      // never a bare id.
      id: 'extraCategories',
      accessorKey: 'extraCategoryIds',
      header: 'Extra Categories',
      enableSorting: false,
      cell: ({ getValue }) => {
        const ids = getValue() as Widget['extraCategoryIds']
        if (ids.length === 0) return <span className="text-muted-foreground">—</span>
        return (
          <div className="flex flex-wrap gap-1">
            {ids.map((id) => (
              <Badge key={id} variant="outline">
                <CategoryName id={id} />
              </Badge>
            ))}
          </div>
        )
      },
    },
    {
      // Sub-records: a done-count, not the items themselves (they're edited
      // on the form). An em dash when the list is empty.
      id: 'checklist',
      accessorKey: 'checklist',
      header: 'Checklist',
      enableSorting: false,
      cell: ({ getValue }) => {
        const items = getValue() as Widget['checklist']
        if (items.length === 0) return <span className="text-muted-foreground">—</span>
        const done = items.filter((item) => item.done).length
        return (
          <span className="tabular-nums">
            {done}/{items.length} done
          </span>
        )
      },
    },
    {
      // Computed, read-only: sortable because the server sorts on it.
      id: 'checklistState',
      accessorKey: 'checklistState',
      header: 'Progress',
      enableSorting: true,
      cell: ({ getValue }) => {
        const state = getValue() as WidgetChecklistState
        return <Badge variant={CHECKLIST_STATE_BADGE_VARIANT[state]}>{CHECKLIST_STATE_LABELS[state]}</Badge>
      },
    },
    {
      // Yes/no, flipped straight from the row (cell-patterns.md pattern 15):
      // a Switch that saves on its own. See in-stock-toggle.tsx.
      id: 'inStock',
      accessorKey: 'inStock',
      header: 'In Stock',
      enableSorting: false,
      cell: ({ row }) => <InStockToggle widget={row.original} />,
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
