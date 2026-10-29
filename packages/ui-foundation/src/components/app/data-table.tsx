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
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
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
import { EditInPlaceContext } from './edit-in-place'
import { EditInPlaceStore } from './edit-in-place-store'
import { LeaveGuard } from './editable-value'
import { groupRuns, type RowGroup } from './table-groups'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
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
// wider header — or `'right'`, for money and counts, so their digits (and
// the totals row's sums) line up on the right.
declare module '@tanstack/table-core' {
  /* eslint-disable @typescript-eslint/no-unused-vars -- interface merging
     requires matching the original's exact type parameter list; none of the
     three need to appear in this interface's own body. */
  interface ColumnMeta<
    TFeatures extends TableFeatures,
    TData extends RowData,
    TValue extends CellData = CellData,
  > {
    align?: 'center' | 'right'
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
  /**
   * The ids of the columns to show; the rest are hidden. They keep their
   * order in `columns`. Leave undefined to show every column. A table
   * with saved views passes the active view's `columns`
   * (useTableUrlState's `activeView`), or its own default list when no
   * view is active, which can leave out a column only one view shows.
   */
  visibleColumns?: readonly string[]
  /**
   * `full` (the default): the table, its toolbar and its pagination take
   * the whole width. `content`, for a table of a few short columns: on a
   * wide screen (a table area of 80rem or more) they take the width the
   * columns need, never under 36rem, with the row actions right after the
   * last column. Below that, as `full`. While loading, empty or failed
   * after a load, it keeps the width it last had, so paging and filtering
   * don't move it (only the first load can).
   */
  width?: DataTableWidth
  /**
   * Rows under headings: each row's group (`byDay(field)` for a feed or a
   * log). Rows keep the server's order, and a heading row spanning every
   * column starts each run of one key. Paging pages rows, not groups, so a
   * group split across pages repeats its heading on the next.
   */
  groupBy?: (row: TData) => RowGroup
  /**
   * What a heading says after its label ("4 · 1 h 12 m"), from the group's
   * rows on this page.
   */
  groupSummary?: (rows: TData[]) => ReactNode
  /**
   * False hides the column header row, for a list-like table whose columns
   * explain themselves (a thumbnail, a title block, actions). Screen readers
   * still get the column names; sorting moves to the toolbar.
   */
  header?: boolean
  /**
   * The one row to look at (next up, the current one): tinted with info's
   * wash, a bar in `info-text` at its start, and muted text inside it
   * darkened so it still clears 4.5:1. Return true for at most a row or two.
   * Colour isn't the only signal: say why in the row too (a badge, a word).
   */
  highlightRow?: (row: TData) => boolean
  /**
   * A totals row under the columns it adds up, the way a spreadsheet's
   * is: `label` in the first visible column ("Total · 18 items"), then
   * each of `cells` under the column with that id, in its alignment. The
   * values come from the server, for every row the filters match, never
   * summed from the page on the client. Shown only with rows: never while
   * loading, on error or empty. Leave undefined (or null, before the data
   * has come) for no row.
   */
  totals?: DataTableTotals | null
}

export type DataTableWidth = 'full' | 'content'

export type DataTableTotals = {
  /** Goes in the first visible column, as the row's header. */
  label: ReactNode
  /**
   * One value per column id, already formatted. A column left out, or
   * hidden by `visibleColumns`, gets an empty cell or none. The first
   * visible column holds the label, so a value for it isn't shown.
   */
  cells?: Partial<Record<string, ReactNode>>
}

// A column def's id as TanStack resolves it (constructColumn): `id`, then
// `accessorKey` with dots as underscores, then a string header. Group
// columns are looked through to their leaves, which visibility is keyed by.
function leafColumnIds<TData extends Record<string, unknown>>(columns: readonly LegacyColumnDef<TData, unknown>[]): string[] {
  return columns.flatMap((column) => {
    if ('columns' in column && column.columns) return leafColumnIds(column.columns)
    const accessorKey = 'accessorKey' in column ? column.accessorKey : undefined
    const id =
      column.id ??
      (accessorKey === undefined ? undefined : String(accessorKey).replaceAll('.', '_')) ??
      (typeof column.header === 'string' ? column.header : undefined)
    return id === undefined ? [] : [id]
  })
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

// The pinned cell gets an opaque background, not `bg-inherit`: the zebra
// stripe (table.tsx) is a *translucent* color, so inheriting it would let
// the columns scrolling behind show through at 40% opacity — exactly the
// bleed-through a solid background avoids. On an even row it's the stripe
// pre-mixed onto the page (--table-stripe), so the stripe runs the whole
// row's width (issue #92); `:where()` keeps that rule's specificity at the
// background's, so the first column's hover below still wins on every row.
const PINNED_CELL_CLASS =
  'z-10 bg-background [:where(tbody>tr:nth-child(even))>&]:bg-(--table-stripe)'

// The pinned first cell carries the hover highlight. --accent is only ~3%
// off the page background, so a solid left edge marker carries the signal;
// an inset shadow rather than a border, so nothing reflows.
const PINNED_COLUMN_CLASS =
  `sticky left-0 border-r ${PINNED_CELL_CLASS} group-hover/row:bg-accent ` +
  'group-hover/row:shadow-[inset_3px_0_0_0_var(--primary)]'

// The right-edge mirror, opaque for the same reason, but with no hover
// highlight (issue #103): it holds the row's actions, which name nothing,
// so lighting it too read as a second selected thing. Only the first
// column marks the hovered row.
const PINNED_LAST_COLUMN_CLASS = `sticky right-0 border-l ${PINNED_CELL_CLASS}`

// The totals row's label, pinned with the first column (`totals`): the
// same opaque cell, with no hover, since the row isn't one to pick.
const PINNED_TOTALS_LABEL_CLASS = `sticky left-0 border-r ${PINNED_CELL_CLASS}`

// A pinned first column's content, capped below md at 45% of the table's
// scroll area (`cqw`: the container is an inline-size query container)
// and wrapping, so a long title can't widen the column past the screen
// and leave every other column scrolling underneath it (issue #91).
// Wider screens are unchanged: the column sizes to its content.
const PINNED_FIRST_CONTENT_CLASS = 'max-md:max-w-[45cqw] max-md:whitespace-normal max-md:break-words'

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

// `highlightRow`: the wash on every cell, so it covers the zebra stripe
// (on the row) and the pinned cells' opaque backgrounds (on the cell, and
// one class weaker than this), while a pinned cell's hover still wins. A
// bar on the first cell, as hover's is, so it reads without colour too.
// Inside, muted text takes the darker grey the wash needs (theme.css).
const HIGHLIGHTED_ROW_CLASS =
  '[--muted-foreground:var(--table-highlight-muted-foreground)] [&>td]:bg-(--table-highlight) ' +
  '[&>td:first-child]:shadow-[inset_3px_0_0_0_var(--info-text)]'

// `totals`: a footer row the way a spreadsheet's totals are, set apart
// from the rows by a border twice a row divider's width and medium type,
// on the page's background (table.tsx's footer tint is translucent, so a
// pinned cell over it couldn't match without bleed-through). Its cells
// read the body's density tokens, so it's a row's height, not the
// header's; tabular figures line its numbers up with the column's.
const TOTALS_FOOTER_CLASS = 'border-t-2 border-border bg-background tabular-nums'

// Its label is a row header (<th scope="row">), padded as a body cell is.
const TOTALS_LABEL_CLASS = 'h-auto py-(--table-cell-py)'

// `header={false}`: the header row stays in the table, so every cell keeps
// its column header for a screen reader, but takes no room: each header
// is its name in an sr-only span, in a cell with no height or padding.
const HIDDEN_HEAD_CLASS = 'h-0 p-0'

// A group's heading row (`groupBy`): a little air above, so the groups
// read apart, and the page's background, never the zebra stripe.
// A column's `meta.align` as the class its header, cells and totals take.
const ALIGN_CLASS = { center: 'text-center', right: 'text-right' } as const
const alignClass = (align: 'center' | 'right' | undefined) => align && ALIGN_CLASS[align]

const GROUP_HEADING_CLASS = 'h-auto bg-background pt-4 pb-1.5 align-bottom'

// `width="content"`: from a table area 80rem wide, as wide as the columns
// need (`w-fit` over the table's own `w-full`), at least 36rem, or the
// width it last had loaded while it shows another state
// (--data-table-last-width), at most the area. Narrower, no change.
const CONTENT_WIDTH_CLASS =
  '@7xl/data-table:w-fit @7xl/data-table:max-w-full ' +
  '@7xl/data-table:min-w-[max(--spacing(144),var(--data-table-last-width,0px))]'

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
  visibleColumns,
  width = 'full',
  groupBy,
  groupSummary,
  header: showHeader = true,
  highlightRow,
  totals,
}: DataTableProps<TData>) {
  // Editing in place in the rows (cell pattern 18, "In a table's rows"):
  // a cell that renders an <EditableValue> edits where it's shown, one at
  // a time, with the leave-page prompt while one is open, the same rules
  // as a record's view.
  const [store] = useState(() => new EditInPlaceStore())
  const editing = useSyncExternalStore(
    store.subscribe,
    () => store.editing,
    () => store.editing,
  )

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  // TanStack treats a column missing from this map as visible, so every
  // column gets an entry once a list is given.
  const columnVisibility = visibleColumns
    ? Object.fromEntries(leafColumnIds(columns).map((id) => [id, visibleColumns.includes(id)]))
    : {}

  const table = useLegacyTable({
    data,
    columns,
    getRowId: getRowId as ((row: TData, index: number) => string) | undefined,
    state: {
      sorting,
      pagination: { pageIndex: page - 1, pageSize },
      columnVisibility,
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

  // `width="content"`: the width the table last had loaded, kept while it
  // shows another state.
  const root = useRef<HTMLDivElement>(null)
  const [lastWidth, setLastWidth] = useState<number | null>(null)
  useLayoutEffect(() => {
    const element = root.current
    if (width !== 'content' || !isSuccessView || !element) return
    const observer = new ResizeObserver(() => setLastWidth(Math.round(element.getBoundingClientRect().width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [width, isSuccessView])

  const containerRef = useRef<HTMLDivElement>(null)
  const { barRef, isOverflowing, scrollWidth } = useBottomScrollbar(
    containerRef,
    Boolean(pinFirstColumn) && isSuccessView,
  )

  const rows = table.getRowModel().rows
  const visibleLeafColumns = table.getVisibleLeafColumns()
  const visibleColumnCount = visibleLeafColumns.length
  // One body row, the same in a plain table and a grouped one.
  const renderRow = (row: (typeof rows)[number]) => (
    <TableRow
      key={row.id}
      data-highlighted={highlightRow?.(row.original) || undefined}
      className={cn(pinFirstColumn && ROW_GROUP_CLASS, highlightRow?.(row.original) && HIGHLIGHTED_ROW_CLASS)}
    >
      {row.getVisibleCells().map((cell, index) => (
        <TableCell
          key={cell.id}
          className={cn(
            pinFirstColumn && index === 0 && PINNED_COLUMN_CLASS,
            pinLastColumn && index === row.getVisibleCells().length - 1 && PINNED_LAST_COLUMN_CLASS,
            alignClass(cell.column.columnDef.meta?.align),
          )}
        >
          {pinFirstColumn && index === 0 ? (
            <div className={PINNED_FIRST_CONTENT_CLASS}>
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </div>
          ) : (
            flexRender(cell.column.columnDef.cell, cell.getContext())
          )}
        </TableCell>
      ))}
    </TableRow>
  )

  const content = (
    <div
      ref={root}
      className={cn('flex flex-col gap-4', width === 'content' && CONTENT_WIDTH_CLASS)}
      data-width={width}
      style={
        width === 'content' && !isSuccessView && lastWidth !== null
          ? ({ '--data-table-last-width': `${lastWidth}px` } as CSSProperties)
          : undefined
      }
    >
      {toolbar}

      {error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : isLoading || isPastLastPage ? (
        <TableSkeleton columnCount={table.getVisibleLeafColumns().length} />
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
                '@container [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
              // A size container has no width of its own to give, so
              // `width="content"` couldn't fit the table. Its query only
              // serves a phone-width rule, and an 80rem table area never
              // is one.
              width === 'content' && '@7xl/data-table:[container-type:normal]',
            )}
          >
            <TableHeader className={cn(!showHeader && '[&_tr]:border-0')}>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header, index) => {
                    const canSort = header.column.getCanSort()
                    const sortDirection = header.column.getIsSorted()
                    // Hidden, a header is its name only: a sort button no
                    // one can see would still take focus.
                    const content = header.isPlaceholder ? null : canSort && showHeader ? (
                      <button
                        type="button"
                        className={cn(
                          'flex items-center gap-1 text-foreground',
                          header.column.columnDef.meta?.align === 'center' && 'w-full justify-center',
                          // The arrow on the label's left, so the label's
                          // right edge lines up with the numbers under it.
                          header.column.columnDef.meta?.align === 'right' && 'ml-auto flex-row-reverse',
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
                    )
                    return (
                      <TableHead
                        key={header.id}
                        className={cn(
                          !showHeader && HIDDEN_HEAD_CLASS,
                          pinFirstColumn && index === 0 && PINNED_COLUMN_CLASS,
                          pinLastColumn &&
                            index === headerGroup.headers.length - 1 &&
                            PINNED_LAST_COLUMN_CLASS,
                          alignClass(header.column.columnDef.meta?.align),
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
                        {!showHeader ? (
                          <span className="sr-only">{content}</span>
                        ) : pinFirstColumn && index === 0 ? (
                          <div className={PINNED_FIRST_CONTENT_CLASS}>{content}</div>
                        ) : (
                          content
                        )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            {groupBy ? (
              groupRuns(rows, (row) => groupBy(row.original)).map((run, runIndex) => (
                // A body per group, headed by a row header for it
                // (scope="rowgroup"), so a screen reader names a cell's
                // group the way it names its column.
                <TableBody key={`${runIndex}:${run.key}`} data-slot="table-group">
                  <TableRow data-slot="table-group-heading" className="hover:bg-transparent">
                    <TableHead scope="rowgroup" colSpan={visibleColumnCount} className={GROUP_HEADING_CLASS}>
                      {/* Sticky, so the label stays in view while a wide
                          table scrolls sideways. */}
                      <span className="sticky left-(--table-cell-px) inline-flex items-baseline gap-2">
                        <span className="type-label text-foreground">{run.label}</span>
                        {groupSummary && (
                          <span className="type-caption text-muted-foreground tabular-nums">
                            {groupSummary(run.rows.map((row) => row.original))}
                          </span>
                        )}
                      </span>
                    </TableHead>
                  </TableRow>
                  {/* Never shown, but counted by the zebra stripe's
                      nth-child (table.tsx, PINNED_CELL_CLASS): without it
                      the heading is row 1, so every group's first row
                      would be striped, and a group of one always. */}
                  <tr hidden aria-hidden="true" data-slot="table-group-stripe-offset" />
                  {run.rows.map(renderRow)}
                </TableBody>
              ))
            ) : (
              <TableBody>{rows.map(renderRow)}</TableBody>
            )}
            {totals && (
              // After every group's body, so it totals the table, not the
              // last group. A cell per visible column, so each value sits
              // under its own and the pinned edges stay opaque.
              <TableFooter className={TOTALS_FOOTER_CLASS}>
                <TableRow data-slot="table-totals" className="hover:bg-transparent">
                  {visibleLeafColumns.map((column, index) => {
                    const className = cn(
                      pinFirstColumn && index === 0 && PINNED_TOTALS_LABEL_CLASS,
                      pinLastColumn && index === visibleColumnCount - 1 && PINNED_LAST_COLUMN_CLASS,
                      alignClass(column.columnDef.meta?.align),
                    )
                    return index === 0 ? (
                      <TableHead key={column.id} scope="row" className={cn(TOTALS_LABEL_CLASS, className)}>
                        {pinFirstColumn ? (
                          <div className={PINNED_FIRST_CONTENT_CLASS}>{totals.label}</div>
                        ) : (
                          totals.label
                        )}
                      </TableHead>
                    ) : (
                      <TableCell key={column.id} className={className}>
                        {totals.cells?.[column.id]}
                      </TableCell>
                    )
                  })}
                </TableRow>
              </TableFooter>
            )}
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

  return (
    <EditInPlaceContext.Provider value={store}>
      {editing && <LeaveGuard store={store} />}
      {width === 'content' ? <div className="@container/data-table">{content}</div> : content}
    </EditInPlaceContext.Provider>
  )
}
