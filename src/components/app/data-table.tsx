// Generic server-side data table: sorting, pagination and a toolbar slot for
// filters, all driven externally (the caller owns the QuerySpec and re-fetches
// via TanStack Query — this component never fetches). See
// docs/BUILD-PLAN.md Phase 4 "Scope Ceiling": this is one of exactly three
// app/ composites.
//
// Built on @tanstack/react-table's useLegacyTable, not the v9 useTable +
// tableFeatures() API. useLegacyTable is TanStack's own officially shipped,
// fully-typed v8-compatibility layer (not a hand-rolled shim) — the v9
// feature-slot architecture exists to make row models like sorting and
// pagination tree-shakeable and independently swappable, which buys nothing
// here: every row model is manual (the server sorts and pages), so this
// table never uses TanStack's own sorted/paginated row models at all.
import { flexRender } from '@tanstack/react-table'
import { getCoreRowModel, useLegacyTable, type LegacyColumnDef } from '@tanstack/react-table/legacy'
import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import type { AppError } from '@/api/contracts'
import { ErrorState } from '@/components/app/error-state'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type SortingState = { id: string; desc: boolean }[]

export type DataTableProps<TData extends Record<string, unknown>> = {
  columns: LegacyColumnDef<TData, unknown>[]
  data: TData[]
  total: number
  /** 1-based, matching QuerySpec.page. */
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  sorting: SortingState
  onSortingChange: (sorting: SortingState) => void
  isLoading: boolean
  error?: AppError | null
  onRetry?: () => void
  emptyTitle: string
  emptyDescription?: string
  emptyAction?: React.ReactNode
  toolbar?: React.ReactNode
  getRowId?: (row: TData) => string
}

function TableSkeleton({ columnCount }: { columnCount: number }) {
  return (
    <div className="flex flex-col gap-2 p-2" data-state="loading">
      {Array.from({ length: 5 }, (_, row) => (
        <div key={row} className="flex gap-4">
          {Array.from({ length: columnCount }, (_, col) => (
            <Skeleton key={col} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function DataTable<TData extends Record<string, unknown>>({
  columns,
  data,
  total,
  page,
  pageSize,
  onPageChange,
  sorting,
  onSortingChange,
  isLoading,
  error,
  onRetry,
  emptyTitle,
  emptyDescription,
  emptyAction,
  toolbar,
  getRowId,
}: DataTableProps<TData>) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const table = useLegacyTable({
    data,
    columns,
    getRowId: getRowId as ((row: TData, index: number) => string) | undefined,
    state: {
      sorting,
      pagination: { pageIndex: page - 1, pageSize },
    },
    manualSorting: true,
    manualPagination: true,
    pageCount,
    onSortingChange: (updater) =>
      onSortingChange(typeof updater === 'function' ? updater(sorting) : updater),
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater({ pageIndex: page - 1, pageSize }) : updater
      onPageChange(next.pageIndex + 1)
    },
    getCoreRowModel: getCoreRowModel(),
  })

  const isEmpty = !isLoading && !error && data.length === 0

  return (
    <div className="flex flex-col gap-4">
      {toolbar}

      {error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : isLoading ? (
        <TableSkeleton columnCount={columns.length} />
      ) : isEmpty ? (
        <Empty data-state="empty">
          <EmptyHeader>
            <EmptyTitle>{emptyTitle}</EmptyTitle>
            {emptyDescription && <EmptyDescription>{emptyDescription}</EmptyDescription>}
          </EmptyHeader>
          {emptyAction}
        </Empty>
      ) : (
        <>
          <Table data-state="success">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort()
                    const sortDirection = header.column.getIsSorted()
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : canSort ? (
                          <button
                            type="button"
                            className="flex items-center gap-1 text-foreground"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {sortDirection === 'asc' ? (
                              <ArrowUpIcon className="size-3.5 text-muted-foreground" />
                            ) : sortDirection === 'desc' ? (
                              <ArrowDownIcon className="size-3.5 text-muted-foreground" />
                            ) : (
                              <ArrowUpDownIcon className="size-3.5 text-muted-foreground/50" />
                            )}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {total === 0 ? 0 : (page - 1) * pageSize + 1}
              {'–'}
              {Math.min(page * pageSize, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Previous page"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                <ChevronLeftIcon />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {pageCount}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Next page"
                disabled={page >= pageCount}
                onClick={() => onPageChange(page + 1)}
              >
                <ChevronRightIcon />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
