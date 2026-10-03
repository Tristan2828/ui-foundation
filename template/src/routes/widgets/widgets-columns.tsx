// Column definitions for the widgets table. Table, view and form are the
// copy-this-file reference for the entity playbook
// (docs/foundation/add-an-entity.md).
import type { LegacyColumnDef } from '@tanstack/react-table/legacy'
import { Link } from 'react-router'
import { Badge } from '@tristan2828/ui-foundation/ui/badge'
import type { components } from '@/api/schema'
import { CategoryName } from './category-names'
import { InStockToggle } from './in-stock-toggle'
import {
  CHECKLIST_STATE_BADGE_VARIANT,
  STATUS_BADGE_VARIANT,
  checklistDoneCount,
  dateFormatter,
  priceFormatter,
} from './widget-format'
import { CHECKLIST_STATE_LABELS, WIDGET_TAG_LABELS } from './widget-schema'

type Widget = components['schemas']['Widget']
type WidgetStatus = components['schemas']['WidgetStatus']
type WidgetChecklistState = components['schemas']['WidgetChecklistState']

// The record's title, linking to its view (cell pattern 16). The view is
// where a widget is read, edited and deleted, so the table has no row
// actions. Bold enough to read as the row's name; the underline appears on
// hover and keyboard focus.
const TITLE_LINK_CLASS =
  'rounded-sm font-medium text-foreground underline-offset-4 outline-none hover:underline ' +
  'focus-visible:underline focus-visible:ring-3 focus-visible:ring-ring/50'

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
      cell: ({ row }) => (
        <Link to={`/widgets/${row.original.id}`} className={TITLE_LINK_CLASS}>
          {row.original.name}
        </Link>
      ),
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
        return <span className="tabular-nums">{checklistDoneCount(items)}</span>
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
      // a Switch that saves on its own. See in-stock-toggle.tsx. The last
      // column, pinned to the right edge (pinLastColumn): it's the row's one
      // action, so it stays reachable on a wide table.
      id: 'inStock',
      accessorKey: 'inStock',
      header: 'In Stock',
      enableSorting: false,
      cell: ({ row }) => <InStockToggle widget={row.original} />,
    },
  ]
}
