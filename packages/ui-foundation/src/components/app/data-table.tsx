// Generic server-side data table: sorting, pagination and a toolbar slot for
// filters, all driven externally (the caller owns the QuerySpec and re-fetches
// via TanStack Query — this component never fetches).
//
// Built on @tanstack/react-table's useLegacyTable, not the v9 useTable +
// tableFeatures() API. useLegacyTable is TanStack's own officially shipped,
// fully-typed v8-compatibility layer (not a hand-rolled shim) — the v9
// feature-slot architecture exists to make row models like sorting and
// pagination tree-shakeable and independently swappable, which buys nothing
// here: every row model is manual (the server sorts and pages), so this
// table never uses TanStack's own sorted/paginated row models at all.
import { useEffect, useRef, useState } from 'react'
import { flexRender } from '@tanstack/react-table'
import type { CellData, RowData, TableFeatures } from '@tanstack/react-table'
import { cn } from 'cn'
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

export type SortingState = { id: string; desc: boolean }[]

// ColumnMeta is an empty interface upstream; this augmentation is TanStack's
// own documented way to give it a shape. Scoped to '@tanstack/table-core',
// where ColumnMeta actually lives ('@tanstack/react-table' only re-exports
// it), so the merge applies whichever of the two a column def imports from.
// A column opts in with `meta: { align: 'center' }` — right for a cell whose
// content is a single glyph, which otherwise reads off-centre under a
// wider header.
declare module '@tanstack/table-core' {
  /* eslint-disable @typescript-eslint/no-unused-vars -- interface merging
     requires matching the original's exact type parameter list; none of the
     three need to appear in this interface's own body. */
  interface ColumnMeta<
    TFeatures extends TableFeatures,
    TData extends RowData,
    TValue extends CellData = CellData,
  > {
    align?: 'center'
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */
}

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
  /**
   * Pins the first column so it stays put while the rest scrolls
   * horizontally, and adds a second scrollbar stuck to the viewport's
   * bottom edge. Opt in per table — a narrow table needs neither.
   */
  pinFirstColumn?: boolean
  /**
   * Pins the last column to the right edge, the mirror of
   * `pinFirstColumn`, for a table whose row actions sit there: on a wide
   * table they otherwise scroll off-screen, so the control used most is
   * the one that can't be seen. No second scrollbar of its own. Opt in per
   * table.
   */
  pinLastColumn?: boolean
  /**
   * Set false when the caller supplies a default sort it falls back to
   * whenever `sorting` is empty. TanStack's cycle is asc → desc →
   * unsorted, and that third click hands back `[]`, which such a caller
   * immediately turns back into the same default — so the header looks
   * stuck and can never advance past it. Leaving this undefined keeps
   * TanStack's own behaviour, so a table with no default sort is
   * unaffected. See conventions/docs/entity-plan-template.md "Default sort".
   */
  enableSortingRemoval?: boolean
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

// The pinned cell gets a flat `bg-background`, not `bg-inherit`: the zebra
// stripe (table.tsx) is a *translucent* color, so inheriting it would let
// the columns scrolling behind show through at 40% opacity — exactly the
// bleed-through a solid background avoids. That also means the pinned
// column shows no stripe, which is why it is the thing that carries the
// hover highlight. --accent is only ~3% off the page background, so a
// solid left edge marker carries the signal; an inset shadow rather than a
// border, so nothing reflows.
const PINNED_COLUMN_CLASS =
  'sticky left-0 z-10 border-r bg-background group-hover/row:bg-accent ' +
  'group-hover/row:shadow-[inset_3px_0_0_0_var(--primary)]'

// The right-edge mirror, opaque for the same reason. Its edge marker points
// inward from the right, so the two pinned columns bracket the row.
const PINNED_LAST_COLUMN_CLASS =
  'sticky right-0 z-10 border-l bg-background group-hover/row:bg-accent ' +
  'group-hover/row:shadow-[inset_-3px_0_0_0_var(--primary)]'

// Hover highlights the pinned cell, not the whole row. A row-level hover
// cannot be made consistent against the zebra stripe: `tr:nth-child(even)`
// is specificity (0,2,1) and `tr:hover` is (0,2,0), so the stripe wins and
// even rows stay unlit — odd rows highlight, even rows don't.
// `hover:bg-transparent` drops table.tsx's own `hover:bg-muted/50` via
// tailwind-merge so no row hover is attempted at all. The pinned cell is
// the better target anyway: it names the row, it sits on an opaque
// background so it reads identically on striped and unstriped rows, and it
// stays on screen when the table is scrolled right.
const ROW_GROUP_CLASS = 'group/row hover:bg-transparent'

// A second horizontal scrollbar, stuck to the viewport's bottom edge. The
// real one sits directly under the last row, which on a full page is
// off-screen until you have already scrolled past every row. Only rendered
// once the content actually overflows.
function useBottomScrollbar(
  containerRef: React.RefObject<HTMLDivElement | null>,
  isSuccessView: boolean,
) {
  const barRef = useRef<HTMLDivElement>(null)
  const [scrollWidth, setScrollWidth] = useState(0)
  const [clientWidth, setClientWidth] = useState(0)
  const isOverflowing = scrollWidth > clientWidth

  useEffect(() => {
    const container = containerRef.current
    if (!isSuccessView || !container) return
    const contentTable = container.querySelector('table')
    if (!contentTable) return

    const measure = () => {
      setScrollWidth(container.scrollWidth)
      setClientWidth(container.clientWidth)
    }
    measure()

    // The inner <table> grows with column and content width; the container
    // changes with the viewport and the sidebar. Either can change whether,
    // and how far, there is to scroll.
    const resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(container)
    resizeObserver.observe(contentTable)
    return () => resizeObserver.disconnect()
  }, [containerRef, isSuccessView])

  // Separate from the measuring effect: the bar only enters the DOM once
  // `isOverflowing` is true, which that effect is what sets. Wiring the
  // listeners there would read barRef.current before the bar had ever
  // rendered and silently attach to nothing.
  useEffect(() => {
    const container = containerRef.current
    const bar = barRef.current
    if (!isSuccessView || !isOverflowing || !container || !bar) return

    let isSyncing = false
    const syncBarFromContainer = () => {
      if (isSyncing) return
      isSyncing = true
      bar.scrollLeft = container.scrollLeft
      isSyncing = false
    }
    const syncContainerFromBar = () => {
      if (isSyncing) return
      isSyncing = true
      container.scrollLeft = bar.scrollLeft
      isSyncing = false
    }
    container.addEventListener('scroll', syncBarFromContainer)
    bar.addEventListener('scroll', syncContainerFromBar)
    return () => {
      container.removeEventListener('scroll', syncBarFromContainer)
      bar.removeEventListener('scroll', syncContainerFromBar)
    }
  }, [containerRef, isSuccessView, isOverflowing])

  return { barRef, isOverflowing, scrollWidth }
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
  pinFirstColumn,
  pinLastColumn,
  enableSortingRemoval,
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
    ...(enableSortingRemoval === undefined ? {} : { enableSortingRemoval }),
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

  // Past the last page — e.g. after deleting the only row on the last page,
  // or a stale ?page= link. The server still reports rows (total > 0), so
  // this is not "empty": go to the real last page instead of showing
  // "No widgets yet" with data one click away.
  const isPastLastPage = !isLoading && !error && data.length === 0 && total > 0 && page > pageCount
  useEffect(() => {
    if (isPastLastPage) onPageChange(pageCount)
  }, [isPastLastPage, pageCount, onPageChange])

  const isEmpty = !isLoading && !error && data.length === 0 && !isPastLastPage
  const isSuccessView = !error && !isLoading && !isPastLastPage && !isEmpty

  const containerRef = useRef<HTMLDivElement>(null)
  const { barRef, isOverflowing, scrollWidth } = useBottomScrollbar(
    containerRef,
    Boolean(pinFirstColumn) && isSuccessView,
  )

  return (
    <div className="flex flex-col gap-4">
      {toolbar}

      {error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : isLoading || isPastLastPage ? (
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
          <Table
            data-state="success"
            containerRef={containerRef}
            // With the sticky bar below as the visible scrollbar, hide the
            // container's own. It stays overflow-x-auto and fully
            // scrollable (wheel, trackpad, drag, and the sync effect); it
            // just no longer draws a bar directly under the last row.
            containerClassName={cn(
              pinFirstColumn &&
                '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            )}
          >
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header, index) => {
                    const canSort = header.column.getCanSort()
                    const sortDirection = header.column.getIsSorted()
                    return (
                      <TableHead
                        key={header.id}
                        className={cn(
                          pinFirstColumn && index === 0 && PINNED_COLUMN_CLASS,
                          pinLastColumn &&
                            index === headerGroup.headers.length - 1 &&
                            PINNED_LAST_COLUMN_CLASS,
                          header.column.columnDef.meta?.align === 'center' && 'text-center',
                        )}
                        aria-sort={
                          !canSort
                            ? undefined
                            : sortDirection === 'asc'
                              ? 'ascending'
                              : sortDirection === 'desc'
                                ? 'descending'
                                : 'none'
                        }
                      >
                        {header.isPlaceholder ? null : canSort ? (
                          <button
                            type="button"
                            className={cn(
                              'flex items-center gap-1 text-foreground',
                              header.column.columnDef.meta?.align === 'center' && 'w-full justify-center',
                            )}
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
                <TableRow key={row.id} className={cn((pinFirstColumn || pinLastColumn) && ROW_GROUP_CLASS)}>
                  {row.getVisibleCells().map((cell, index) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        pinFirstColumn && index === 0 && PINNED_COLUMN_CLASS,
                        pinLastColumn &&
                          index === row.getVisibleCells().length - 1 &&
                          PINNED_LAST_COLUMN_CLASS,
                        cell.column.columnDef.meta?.align === 'center' && 'text-center',
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {pinFirstColumn && isOverflowing && (
            <div
              ref={barRef}
              aria-hidden="true"
              tabIndex={-1}
              data-slot="bottom-scrollbar"
              className="sticky bottom-0 z-20 h-4 overflow-x-auto border-t border-border bg-background"
            >
              <div style={{ width: scrollWidth, height: 1 }} />
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="type-body text-muted-foreground">
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
              <span className="type-body text-muted-foreground">
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
