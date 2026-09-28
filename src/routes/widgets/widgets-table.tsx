// Screen A (docs/BUILD-PLAN.md Phase 4). A thin consumer of the DataTable
// composite: this file owns widget-specific state (the QuerySpec, the
// column defs) and none of the table's rendering logic — see
// src/components/app/data-table.tsx.
import { PlusIcon } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import type { QuerySpec } from '@/api/contracts'
import { DataTable } from '@/components/app/data-table'
import { MultiChoice } from '@/components/app/multi-choice'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { WIDGET_STATUSES, WIDGET_TAGS } from './widget-schema'
import { buildWidgetsColumns } from './widgets-columns'
import { useCategoriesQuery } from './use-categories'
import { useWidgetsQuery } from './use-widgets'

// A visual-only caption above each toolbar filter, so the field stays
// identifiable once a value is picked and the control shows that value
// instead of its placeholder. The control's own aria-label remains its
// accessible name — this is decorative, hence aria-hidden, not a second
// label. Every entity's toolbar is copied from this file, so new filters
// should follow the same shape.
function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <span aria-hidden="true" className="text-xs font-medium text-muted-foreground">
      {children}
    </span>
  )
}

const PAGE_SIZE = 10
const STATUS_FILTER_ALL = 'all'
// The "no filter" option's label. Needed twice — as the <SelectItem>'s
// text and in the <SelectValue> children function below — so it is defined
// once here rather than typed in both places.
//
// That children function is not optional. Base UI's <SelectValue> renders
// the raw *value*, not the chosen item's label, and its `placeholder` only
// applies when the value is null — which it never is here, because "no
// filter" is the STATUS_FILTER_ALL sentinel, a real value. Without it this
// trigger reads the literal "all" in its default, unfiltered state. Every
// entity's toolbar is copied from this file (docs/add-an-entity.md), so
// keep this shape when adding a filter: a label constant, the children
// function, and a test that asserts the *unset* display.
const STATUS_FILTER_ALL_LABEL = 'All statuses'
const FILTERS = ['search', 'status'] as const
const MULTI_FILTERS = ['tags'] as const
const SEARCH_DEBOUNCE_MS = 300

export function WidgetsTableRoute() {
  // Page, sort and filters live in the URL (?page=2&sort=name:asc&...), so
  // they survive the round trip to the edit form — see the hook.
  const { page, setPage, sorting, setSorting, filters, setFilter, multiFilters, setMultiFilter } =
    useTableUrlState(FILTERS, MULTI_FILTERS)
  const search = filters.search
  const statusFilter = filters.status || STATUS_FILTER_ALL
  // Joined so useMemo sees a stable value (getAll returns a new array every
  // render); anything that isn't a real tag (a hand-edited URL) is dropped
  // rather than sent to the API.
  const tagsParam = multiFilters.tags.filter((tag) => (WIDGET_TAGS as readonly string[]).includes(tag)).join(',')
  const tagsFilter = useMemo(
    () => (tagsParam ? tagsParam.split(',') : []) as (typeof WIDGET_TAGS)[number][],
    [tagsParam],
  )
  // The input shows `search` live; the request waits for typing to pause.
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS)

  const query: QuerySpec = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      sort: sorting[0] ? { field: sorting[0].id, dir: sorting[0].desc ? 'desc' : 'asc' } : undefined,
      filters: {
        search: debouncedSearch || undefined,
        status: statusFilter === STATUS_FILTER_ALL ? undefined : statusFilter,
        tags: tagsFilter,
      },
    }),
    [page, sorting, debouncedSearch, statusFilter, tagsFilter],
  )

  const widgetsQuery = useWidgetsQuery(query)
  const categoriesQuery = useCategoriesQuery('')

  const categoriesById = useMemo(() => {
    const entries = (categoriesQuery.data ?? []).map((category) => [category.id, category.name] as const)
    return Object.fromEntries(entries)
  }, [categoriesQuery.data])

  const columns = useMemo(() => buildWidgetsColumns(categoriesById), [categoriesById])

  const hasActiveFilters = search !== '' || statusFilter !== STATUS_FILTER_ALL || tagsFilter.length > 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Widgets</h1>
        <Button nativeButton={false} render={<Link to="/widgets/new" />}>
          <PlusIcon />
          New Widget
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={widgetsQuery.data?.items ?? []}
        total={widgetsQuery.data?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        sorting={sorting}
        onSortingChange={setSorting}
        isLoading={widgetsQuery.isLoading}
        error={widgetsQuery.error}
        onRetry={() => widgetsQuery.refetch()}
        emptyTitle={hasActiveFilters ? 'No widgets match your filters' : 'No widgets yet'}
        emptyDescription={
          hasActiveFilters ? 'Try a different search, status or tag.' : 'Create one to get started.'
        }
        emptyAction={
          !hasActiveFilters && (
            <Button size="sm" nativeButton={false} render={<Link to="/widgets/new" />}>
              Create widget
            </Button>
          )
        }
        toolbar={
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <FilterLabel>Search</FilterLabel>
              <Input
                value={search}
                onChange={(event) => setFilter('search', event.target.value)}
                placeholder="Search by name"
                aria-label="Search widgets"
                className="max-w-64"
              />
            </div>
            <div className="flex flex-col gap-1">
            <FilterLabel>Status</FilterLabel>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setFilter('status', value === STATUS_FILTER_ALL ? '' : (value as string))
              }
            >
              <SelectTrigger aria-label="Filter by status" className="w-36">
                <SelectValue>
                  {(value) => (value === STATUS_FILTER_ALL ? STATUS_FILTER_ALL_LABEL : value)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STATUS_FILTER_ALL}>{STATUS_FILTER_ALL_LABEL}</SelectItem>
                {WIDGET_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>
            <div className="flex flex-col gap-1">
              <FilterLabel>Tags</FilterLabel>
              <MultiChoice
                options={WIDGET_TAGS}
                value={tagsFilter}
                onValueChange={(tags) => setMultiFilter('tags', tags)}
                placeholder="Any tag"
                aria-label="Filter by tags"
                className="w-56"
              />
            </div>
          </div>
        }
        getRowId={(widget) => String(widget.id)}
        pinFirstColumn
      />
    </div>
  )
}
