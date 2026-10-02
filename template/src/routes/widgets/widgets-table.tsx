// The widgets table. A thin consumer of the foundation's DataTable
// composite: this file owns widget-specific state (the QuerySpec, the
// column defs) and none of the table's rendering logic.
import { PlusIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  type QuerySpec,
  DataTable,
  MultiChoice,
  MultiReference,
  useDebouncedValue,
  useTableUrlState,
} from '@tristan2828/ui-foundation'
import { Button } from '@tristan2828/ui-foundation/ui/button'
import { Input } from '@tristan2828/ui-foundation/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@tristan2828/ui-foundation/ui/select'
import { WIDGET_STATUSES, WIDGET_TAGS } from './widget-schema'
import { buildWidgetsColumns } from './widgets-columns'
import { categoryNames, useCategoriesByIdsQuery, useCategoriesQuery } from './use-categories'
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
// entity's toolbar is copied from this file (docs/foundation/add-an-entity.md), so
// keep this shape when adding a filter: a label constant, the children
// function, and a test that asserts the *unset* display.
const STATUS_FILTER_ALL_LABEL = 'All statuses'
// A yes/no filter is a three-way choice: either (no filter), yes or no.
// The URL holds 'true'/'false' ('' for either), the same strings the API
// takes; the labels say what each one means for this field.
const IN_STOCK_FILTER_ALL = 'all'
const IN_STOCK_FILTER_LABELS: Record<string, string> = {
  [IN_STOCK_FILTER_ALL]: 'Any stock',
  true: 'In stock',
  false: 'Out of stock',
}
const FILTERS = ['search', 'status', 'inStock'] as const
const MULTI_FILTERS = ['tags', 'extraCategoryIds'] as const
const SEARCH_DEBOUNCE_MS = 300

export function WidgetsTableRoute() {
  // Page, sort and filters live in the URL (?page=2&sort=name:asc&...), so
  // they survive the round trip to the edit form — see the hook.
  const { page, setPage, sorting, setSorting, filters, setFilter, multiFilters, setMultiFilter } =
    useTableUrlState(FILTERS, MULTI_FILTERS)
  const search = filters.search
  const statusFilter = filters.status || STATUS_FILTER_ALL
  // Anything but 'true'/'false' (a hand-edited URL) means no filter.
  const inStockFilter =
    filters.inStock === 'true' || filters.inStock === 'false' ? filters.inStock : IN_STOCK_FILTER_ALL
  // Joined so useMemo sees a stable value (getAll returns a new array every
  // render); anything that isn't a real tag (a hand-edited URL) is dropped
  // rather than sent to the API.
  const tagsParam = multiFilters.tags.filter((tag) => (WIDGET_TAGS as readonly string[]).includes(tag)).join(',')
  const tagsFilter = useMemo(
    () => (tagsParam ? tagsParam.split(',') : []) as (typeof WIDGET_TAGS)[number][],
    [tagsParam],
  )
  // Multi-reference filter: ids live in the URL as strings; anything that
  // isn't a positive integer (a hand-edited URL) is dropped.
  const extraCategoryParam = multiFilters.extraCategoryIds.filter((id) => /^[1-9]\d*$/.test(id)).join(',')
  const extraCategoryFilter = useMemo(
    () => (extraCategoryParam ? extraCategoryParam.split(',').map(Number) : []),
    [extraCategoryParam],
  )
  const [extraCategorySearch, setExtraCategorySearch] = useState('')
  const extraCategoryOptionsQuery = useCategoriesQuery(extraCategorySearch)
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
        extraCategoryIds: extraCategoryFilter,
        inStock: inStockFilter === IN_STOCK_FILTER_ALL ? undefined : inStockFilter === 'true',
      },
    }),
    [page, sorting, debouncedSearch, statusFilter, tagsFilter, inStockFilter, extraCategoryFilter],
  )

  const widgetsQuery = useWidgetsQuery(query)
  // Every category id on this page (each row's category and extra ones)
  // plus the filter's picks, named in one lookup by id: a name never
  // depends on what a search happened to return.
  const items = widgetsQuery.data?.items
  const referencedCategoryIds = useMemo(
    () => [
      ...(items ?? []).flatMap((widget) => [widget.categoryId, ...widget.extraCategoryIds]),
      ...extraCategoryFilter,
    ],
    [items, extraCategoryFilter],
  )
  const referencedCategoriesQuery = useCategoriesByIdsQuery(referencedCategoryIds)
  const names = useMemo(
    () => categoryNames(extraCategoryOptionsQuery.data, referencedCategoriesQuery.data),
    [extraCategoryOptionsQuery.data, referencedCategoriesQuery.data],
  )

  const columns = useMemo(() => buildWidgetsColumns(names), [names])

  const hasActiveFilters =
    search !== '' ||
    statusFilter !== STATUS_FILTER_ALL ||
    tagsFilter.length > 0 ||
    extraCategoryFilter.length > 0 ||
    inStockFilter !== IN_STOCK_FILTER_ALL

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="type-page-title text-foreground">Widgets</h1>
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
          hasActiveFilters ? 'Try a different search, status, tag, category or stock filter.' : 'Create one to get started.'
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
            <div className="flex flex-col gap-1">
              <FilterLabel>Extra Categories</FilterLabel>
              <MultiReference
                options={(extraCategoryOptionsQuery.data ?? []).map((category) => ({
                  id: category.id,
                  label: category.name,
                }))}
                value={extraCategoryFilter}
                onValueChange={(ids) => setMultiFilter('extraCategoryIds', ids.map(String))}
                getLabel={(id) => names.get(id)}
                onSearchChange={setExtraCategorySearch}
                placeholder="Any category"
                emptyText="No categories found."
                aria-label="Filter by extra categories"
                className="w-56"
              />
            </div>
            <div className="flex flex-col gap-1">
              <FilterLabel>In Stock</FilterLabel>
              <Select
                value={inStockFilter}
                onValueChange={(value) =>
                  setFilter('inStock', value === IN_STOCK_FILTER_ALL ? '' : (value as string))
                }
              >
                <SelectTrigger aria-label="Filter by stock" className="w-36">
                  {/* Same reason as Status: without the children function the
                      trigger shows the raw value ('all', 'true'). */}
                  <SelectValue>{(value) => IN_STOCK_FILTER_LABELS[value as string] ?? value}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {[IN_STOCK_FILTER_ALL, 'true', 'false'].map((value) => (
                    <SelectItem key={value} value={value}>
                      {IN_STOCK_FILTER_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        }
        getRowId={(widget) => String(widget.id)}
        pinFirstColumn
        pinLastColumn
      />
    </div>
  )
}
