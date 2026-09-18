// Screen A (docs/BUILD-PLAN.md Phase 4). A thin consumer of the DataTable
// composite: this file owns widget-specific state (the QuerySpec, the
// column defs) and none of the table's rendering logic — see
// src/components/app/data-table.tsx.
import { PlusIcon } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import type { QuerySpec } from '@/api/contracts'
import { DataTable } from '@/components/app/data-table'
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
import { WIDGET_STATUSES } from './widget-schema'
import { buildWidgetsColumns } from './widgets-columns'
import { useCategoriesQuery } from './use-categories'
import { useWidgetsQuery } from './use-widgets'

const PAGE_SIZE = 10
const STATUS_FILTER_ALL = 'all'
const FILTERS = ['search', 'status'] as const
const SEARCH_DEBOUNCE_MS = 300

export function WidgetsTableRoute() {
  // Page, sort and filters live in the URL (?page=2&sort=name:asc&...), so
  // they survive the round trip to the edit form — see the hook.
  const { page, setPage, sorting, setSorting, filters, setFilter } = useTableUrlState(FILTERS)
  const search = filters.search
  const statusFilter = filters.status || STATUS_FILTER_ALL
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
      },
    }),
    [page, sorting, debouncedSearch, statusFilter],
  )

  const widgetsQuery = useWidgetsQuery(query)
  const categoriesQuery = useCategoriesQuery('')

  const categoriesById = useMemo(() => {
    const entries = (categoriesQuery.data ?? []).map((category) => [category.id, category.name] as const)
    return Object.fromEntries(entries)
  }, [categoriesQuery.data])

  const columns = useMemo(() => buildWidgetsColumns(categoriesById), [categoriesById])

  const hasActiveFilters = search !== '' || statusFilter !== STATUS_FILTER_ALL

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
          hasActiveFilters ? 'Try a different search or status.' : 'Create one to get started.'
        }
        emptyAction={
          !hasActiveFilters && (
            <Button size="sm" nativeButton={false} render={<Link to="/widgets/new" />}>
              Create widget
            </Button>
          )
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(event) => setFilter('search', event.target.value)}
              placeholder="Search by name"
              aria-label="Search widgets"
              className="max-w-64"
            />
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setFilter('status', value === STATUS_FILTER_ALL ? '' : (value as string))
              }
            >
              <SelectTrigger aria-label="Filter by status" className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STATUS_FILTER_ALL}>All statuses</SelectItem>
                {WIDGET_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        getRowId={(widget) => String(widget.id)}
      />
    </div>
  )
}
