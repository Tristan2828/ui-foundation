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
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpDownIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ListTreeIcon,
  TableIcon,
  XIcon,
} from 'lucide-react'
import type { AppError } from '@/api/contracts'
import { ErrorState } from '@/components/app/error-state'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { ArtworkAspect } from './artwork'
import { EditInPlaceContext } from './edit-in-place'
import { EditInPlaceStore } from './edit-in-place-store'
import { LeaveGuard } from './editable-value'
import type { IconComponent } from './icon-component'
import { groupByValues, groupRuns, type GroupRun, type RowGroup } from './table-groups'
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
   * What a heading says after its label ("4 · 1 h 12 m", "3 ready · top
   * 42"), from the group's rows on this page, for `groupBy`'s headings and
   * a grouping's alike. `group` says which group it is.
   */
  groupSummary?: (rows: TData[], group: RowGroup) => ReactNode
  /**
   * The fields the rows can be grouped by, picked in a Group menu at the
   * end of the toolbar: None (the default, the table as it is without
   * this), then each of these. Choice fields: each group is one of the
   * field's options, in the options' order. While grouped, the field's
   * column is hidden (its value is the heading), each heading folds its
   * rows away and says how many there are, with `groupSummary` after it,
   * and a Fold all button joins the menu. A grouping, while on, takes the
   * place of `groupBy`. It groups this page's rows: paging still pages
   * rows.
   */
  groupings?: readonly DataTableGrouping<TData>[]
  /**
   * The grouping on: a grouping's id, or '' for None, from
   * useTableUrlState's `grouping` (the URL's `?group=`, then the one
   * remembered for this table). An id the table doesn't have is None.
   * Left out, the menu keeps its own state, starting on None.
   */
  grouping?: string
  onGroupingChange?: (grouping: string) => void
  /**
   * A record read beside the list without leaving it. Clicking a row (its
   * title link too; a modified click still opens the link) or Enter on it
   * selects it and opens this panel: beside the table on a wide screen
   * (64rem and up), a bottom sheet below that. ↑ and ↓ move the selection
   * while the list has focus; Escape or Close closes it. Everything in
   * the panel is the app's, an "Open page" link included. The table
   * layout's alone: a card layout's cards are as they are.
   */
  detailPanel?: (row: TData) => ReactNode
  /**
   * What a click on a row (or Enter on it) does instead of picking it for
   * the `detailPanel`: open its page, say. A link or control inside the row
   * keeps its own click, and the panel is then opened from the app's own
   * control through `detailRow`. Left out, a row click picks the row.
   */
  onRowClick?: (row: TData) => void
  /**
   * The row the `detailPanel` shows, controlled: its row id (`getRowId`), or
   * null for none. With `onDetailRowChange` it lets a control of the app's
   * own (a button in a row) open the panel. Left out, the table keeps the
   * pick itself.
   */
  detailRow?: string | null
  onDetailRowChange?: (rowId: string | null) => void
  /** The panel's heading and landmark name: "Details" unless set. */
  detailLabel?: string
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
  /**
   * Card layouts besides the table (a thumbnail grid, covers, one line
   * each), and a switch between them at the end of the toolbar, the table
   * first. Each draws a row with its own `renderCard`; paging, `groupBy`
   * headings and the loading, empty and error states hold in every one.
   * The columns still define the table, and sorting is the toolbar's in a
   * card layout. `totals` and `highlightRow` are the table's alone.
   */
  layouts?: readonly DataTableCardLayout<TData>[]
  /**
   * The layout showing: `'table'` or a card layout's id, from
   * useTableLayout (the URL's `?layout=`, then the one remembered for this
   * table, then its default). An id the table doesn't have shows the table.
   * Left out, the switch keeps its own state, starting on the table.
   */
  layout?: string
  onLayoutChange?: (layout: string) => void
  /** The table's own entry in the switch: "Table" with a table icon unless set ("Rows", for a list-like table). */
  tableLayout?: { label?: string; icon?: IconComponent }
}

/** A field DataTable's rows can be grouped by (`groupings`). */
export type DataTableGrouping<TData> = {
  /**
   * The field's column id, hidden while grouped, and the grouping's id in
   * the URL (`?group=status`) and in a saved view's `group`.
   */
  id: string
  /** The menu's word for it ("Status"), and the menu button's while it's on ("Group: Status"). */
  label: string
  /** The field's options, in order: the groups, their order and their headings. */
  options: readonly { value: string; label: string; icon?: ReactNode }[]
  /**
   * The row's value: one option's value, or a list of them for a
   * multi-value field, whose row then shows under each. A value the
   * options don't name gets a group of its own after theirs, headed by
   * the value itself.
   */
  value: (row: TData) => string | readonly string[] | null | undefined
  /** The heading over rows with no value, last: "Not set" unless set ("No category"). */
  emptyLabel?: string
}

/** One of DataTable's card layouts (`layouts`). */
export type DataTableCardLayout<TData> = {
  /** In the URL (`?layout=covers`) and remembered, so keep it short and stable. */
  id: string
  /** The switch's word for it ("Covers"); its accessible name on a phone, where only the icon shows. */
  label: string
  icon: IconComponent
  /** A row as a card. Everything it holds is the app's: the picture (Artwork), the title link, the actions. */
  renderCard: (row: TData) => ReactNode
  /**
   * `grid` (the default): cards side by side, as many across as fit, the
   * package's sizing from the table's width; `list`: one card per line,
   * divided like rows, for a dense one-line-each layout.
   */
  arrange?: 'grid' | 'list'
  /**
   * A grid card's width: `sm` covers (about 8.5rem, three across on a
   * phone), `md` (the default) thumbnails (11rem, two on a phone), `lg`
   * big thumbnails (14rem, one on a phone).
   */
  size?: 'sm' | 'md' | 'lg'
  /** The picture's shape, for the loading skeleton's cards: 16:9 unless set. */
  aspect?: ArtworkAspect
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

// A card grid's columns: as many of the size as the table's width holds,
// and a fixed count on a phone-width table (`@container/data-table-cards`,
// under 28rem), where minimum widths would leave one lonely column.
const CARD_GRID_CLASS = {
  sm: 'grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] @max-md/data-table-cards:grid-cols-3',
  md: 'grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] @max-md/data-table-cards:grid-cols-2',
  lg: 'grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] @max-md/data-table-cards:grid-cols-1',
} as const

const CARD_GRID_GAP_CLASS = 'gap-x-4 gap-y-6 @max-md/data-table-cards:gap-x-2.5 @max-md/data-table-cards:gap-y-4'

// A `list` layout: rows in a bordered box, divided as the table's are.
const CARD_LIST_CLASS = 'divide-y divide-border overflow-hidden rounded-lg border border-border'

const SKELETON_ASPECT_CLASS: Record<ArtworkAspect, string> = {
  '2:3': 'aspect-[2/3]',
  '1:1': 'aspect-square',
  '16:9': 'aspect-video',
}

function CardsSkeleton<TData>({ layout }: { layout: DataTableCardLayout<TData> }) {
  if (layout.arrange === 'list') {
    return (
      <div className={cn(CARD_LIST_CLASS, 'flex flex-col')} data-state="loading">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 px-3 py-2">
            <Skeleton className="size-6 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="@container/data-table-cards" data-state="loading">
      <div className={cn('grid', CARD_GRID_CLASS[layout.size ?? 'md'], CARD_GRID_GAP_CLASS)}>
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className={cn('w-full rounded-md', SKELETON_ASPECT_CLASS[layout.aspect ?? '16:9'])} />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}

// The layout switch: a toggle group (one tab stop, the arrow keys along
// it), the pressed one in the muted fill with the foreground's colour and
// medium weight, the others in muted text, so the difference isn't the
// fill alone. On a phone only the icons show; the label stays their name.
const LAYOUT_ITEM_CLASS =
  'gap-1.5 text-muted-foreground aria-pressed:bg-muted aria-pressed:font-medium aria-pressed:text-foreground'

function LayoutSwitch({
  options,
  value,
  onValueChange,
}: {
  options: readonly { id: string; label: string; icon: IconComponent }[]
  value: string
  onValueChange: (layout: string) => void
}) {
  return (
    <ToggleGroup
      aria-label="Layout"
      variant="outline"
      size="sm"
      spacing={0}
      data-slot="data-table-layout-switch"
      value={[value]}
      onValueChange={(next) => {
        // [] is the pressed one pressed again: it stays on.
        const chosen = next[0]
        if (chosen !== undefined && chosen !== value) onValueChange(chosen)
      }}
    >
      {options.map(({ id, label, icon: Icon }) => (
        <ToggleGroupItem key={id} value={id} className={LAYOUT_ITEM_CLASS} title={label}>
          <Icon aria-hidden="true" className="size-4" />
          <span className="max-sm:sr-only">{label}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

// The Group menu (`groupings`): a radio list, None first, that closes on
// a pick. Base UI's radio group needs a value for None, so it's this
// stand-in, never '' (the grouping's own word for None).
const NO_GROUPING = '__none__'

function GroupMenu<TData>({
  groupings,
  value,
  onValueChange,
}: {
  groupings: readonly DataTableGrouping<TData>[]
  value: string
  onValueChange: (grouping: string) => void
}) {
  const current = groupings.find((grouping) => grouping.id === value)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" data-slot="data-table-group-menu" />}>
        <ListTreeIcon aria-hidden="true" />
        {current ? `Group: ${current.label}` : 'Group'}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Group by</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={current?.id ?? NO_GROUPING}
            onValueChange={(next) => onValueChange(next === NO_GROUPING ? '' : String(next))}
          >
            <DropdownMenuRadioItem value={NO_GROUPING} closeOnClick>
              None
            </DropdownMenuRadioItem>
            {groupings.map((grouping) => (
              <DropdownMenuRadioItem key={grouping.id} value={grouping.id} closeOnClick>
                {grouping.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Whether the detail panel (`detailPanel`) fits beside the table, or opens
// as a bottom sheet. Wide on the server and wherever matchMedia is missing
// (a test's DOM), so markup never depends on it.
const WIDE_QUERY = '(min-width: 64rem)'
const canMatchMedia = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
function subscribeWide(listener: () => void) {
  if (!canMatchMedia()) return () => {}
  const query = window.matchMedia(WIDE_QUERY)
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}
const useIsWide = () =>
  useSyncExternalStore(
    subscribeWide,
    () => !canMatchMedia() || window.matchMedia(WIDE_QUERY).matches,
    () => true,
  )

// A click on one of these inside a row is the control's own, not a pick of
// the row. A link is the exception: a plain click picks the row instead of
// following it (a modified one still opens it, in a new tab).
const ROW_CONTROL_SELECTOR =
  'a[href],button,input,select,textarea,label,summary,[contenteditable="true"],' +
  '[role="button"],[role="checkbox"],[role="switch"],[role="combobox"],[role="link"],[role="slider"]'

// Keys typed into one of these are its own: ↑/↓ and Escape stay with it.
const TYPING_SELECTOR =
  'input,select,textarea,[contenteditable="true"],[role="combobox"],[role="listbox"],[role="menu"],' +
  '[role="slider"],[role="spinbutton"]'

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

// A grouping's heading (`groupings`) is a button that folds its rows: the
// label, then the count, a chevron that turns when folded.
const GROUP_TOGGLE_CLASS =
  '-mx-1 inline-flex items-baseline gap-2 rounded-sm px-1 outline-none hover:underline ' +
  'focus-visible:ring-3 focus-visible:ring-ring/50'

// `detailPanel`: a row that can be picked shows a pointer and its focus
// ring inside it (a row has no outline of its own room); the picked one
// takes the muted fill on every cell, over the zebra stripe and the pinned
// cells' opaque backgrounds as highlightRow's wash does, with a bar in
// --primary at its start, so it reads without colour too. Muted text on that
// fill measures 4.34:1 in light, so inside the row it takes the same darker
// grey as a highlighted row's (theme.css).
const SELECTABLE_ROW_CLASS =
  'cursor-pointer outline-none focus-visible:[&>td]:shadow-[inset_0_2px_0_0_var(--ring),inset_0_-2px_0_0_var(--ring)]'
const SELECTED_ROW_CLASS =
  '[--muted-foreground:var(--table-highlight-muted-foreground)] [&>td]:bg-muted [&>td:first-child]:shadow-[inset_3px_0_0_0_var(--primary)] ' +
  'focus-visible:[&>td:first-child]:shadow-[inset_3px_0_0_0_var(--primary),inset_0_2px_0_0_var(--ring),inset_0_-2px_0_0_var(--ring)]'

// The table and the panel side by side once one is picked on a wide
// screen. The grid is there from the start, so opening the panel never
// remounts the table (and the focused row with it).
const WITH_DETAIL_OPEN_CLASS = 'grid-cols-[minmax(0,1fr)_minmax(18rem,26rem)]'
const DETAIL_ASIDE_CLASS =
  'sticky top-4 flex max-h-[calc(100dvh-2rem)] min-w-0 flex-col gap-3 overflow-y-auto rounded-lg border ' +
  'border-border bg-card p-4 text-card-foreground'

// One row's place in the list, for the detail panel: a row shown under two
// groups (a multi-value grouping) is two places, each picked on its own.
type RowPlace = { key: string; rowId: string }
const EMPTY_KEYS: ReadonlySet<string> = new Set()

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
  layouts,
  layout: layoutProp,
  onLayoutChange,
  tableLayout,
  groupings,
  grouping: groupingProp,
  onGroupingChange,
  detailPanel,
  onRowClick: onRowClickProp,
  detailRow,
  onDetailRowChange,
  detailLabel = 'Details',
}: DataTableProps<TData>) {
  // The switch's own state, for a table that doesn't pass `layout`.
  const [ownLayout, setOwnLayout] = useState('table')
  const requestedLayout = layoutProp ?? ownLayout
  const cardLayout = layouts?.find((candidate) => candidate.id === requestedLayout)
  const currentLayout = cardLayout?.id ?? 'table'
  const setLayout = (next: string) => {
    if (layoutProp === undefined) setOwnLayout(next)
    onLayoutChange?.(next)
  }

  // The grouping on (`groupings`), the menu's own state for a table that
  // doesn't pass `grouping`.
  const [ownGrouping, setOwnGrouping] = useState('')
  const activeGrouping = groupings?.find((candidate) => candidate.id === (groupingProp ?? ownGrouping))
  // Each group's icon (an option's `icon`), by the group's key.
  const groupIcons = activeGrouping
    ? new Map(activeGrouping.options.flatMap((option) => (option.icon ? [[option.value, option.icon] as const] : [])))
    : undefined
  const setGrouping = (next: string) => {
    if (groupingProp === undefined) setOwnGrouping(next)
    onGroupingChange?.(next)
  }
  // The folded headings, for the grouping they were folded in: picking
  // another starts with every group open.
  const [folds, setFolds] = useState<{ grouping: string; keys: ReadonlySet<string> }>({ grouping: '', keys: EMPTY_KEYS })
  const folded = activeGrouping && folds.grouping === activeGrouping.id ? folds.keys : EMPTY_KEYS

  // The picked row (`detailPanel`) and the place it was picked in.
  const [ownSelection, setOwnSelection] = useState<RowPlace | null>(null)
  // Controlled (`detailRow`): the app's row id, at the place picked in when
  // that's the same row, else the row's first place.
  const selection: RowPlace | null =
    detailRow === undefined
      ? ownSelection
      : detailRow === null
        ? null
        : ownSelection?.rowId === detailRow
          ? ownSelection
          : { key: detailRow, rowId: detailRow }
  const setSelection = (next: RowPlace | null) => {
    setOwnSelection(next)
    onDetailRowChange?.(next?.rowId ?? null)
  }
  const isWide = useIsWide()

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
  // While grouped, the grouped column is hidden: its value is the heading.
  const columnVisibility = {
    ...(visibleColumns
      ? Object.fromEntries(leafColumnIds(columns).map((id) => [id, visibleColumns.includes(id)]))
      : {}),
    ...(activeGrouping ? { [activeGrouping.id]: false } : {}),
  }

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
    Boolean(pinFirstColumn) && isSuccessView && !cardLayout,
  )

  const rows = table.getRowModel().rows
  type Row = (typeof rows)[number]
  const visibleLeafColumns = table.getVisibleLeafColumns()
  const visibleColumnCount = visibleLeafColumns.length

  // The groups, if any: a grouping's (folding, with counts), else groupBy's.
  const runs: (GroupRun<Row> & { foldable: boolean })[] | null = activeGrouping
    ? groupByValues(
        rows,
        (row) => activeGrouping.value(row.original),
        activeGrouping.options,
        activeGrouping.emptyLabel ?? 'Not set',
      ).map((run) => ({ ...run, foldable: true }))
    : groupBy
      ? groupRuns(rows, (row) => groupBy(row.original)).map((run) => ({ ...run, foldable: false }))
      : null
  const allFolded = runs !== null && runs.length > 0 && runs.every((run) => folded.has(run.key))
  const toggleFold = (key: string) => {
    if (!activeGrouping) return
    const keys = new Set(folded)
    if (!keys.delete(key)) keys.add(key)
    setFolds({ grouping: activeGrouping.id, keys })
  }
  const foldAll = () => {
    if (!activeGrouping || !runs) return
    setFolds({ grouping: activeGrouping.id, keys: allFolded ? EMPTY_KEYS : new Set(runs.map((run) => run.key)) })
  }

  // Every row's place in the list as shown (folded groups left out), in
  // order, for ↑/↓. Under a grouping a place is the group and the row,
  // since a multi-value field shows a row in more than one.
  const placeKey = (runKey: string, rowId: string) =>
    activeGrouping ? `${encodeURIComponent(runKey)}:${rowId}` : rowId
  const places: RowPlace[] = runs
    ? runs.flatMap((run) =>
        folded.has(run.key) ? [] : run.rows.map((row) => ({ key: placeKey(run.key, row.id), rowId: row.id })),
      )
    : rows.map((row) => ({ key: row.id, rowId: row.id }))
  const selectedRow = detailPanel && selection ? rows.find((row) => row.id === selection.rowId) : undefined
  // The place marked picked: where it was picked, or (regrouped since) the
  // row's first place. None while its group is folded.
  const selectedKey = selectedRow
    ? places.some((place) => place.key === selection?.key)
      ? selection?.key
      : places.find((place) => place.rowId === selectedRow.id)?.key
    : undefined
  // The list's one tab stop: the picked row, else the first.
  const tabStopKey = selectedKey ?? places[0]?.key
  const focusRow = (key: string | undefined) => {
    if (key === undefined) return
    containerRef.current?.querySelector<HTMLElement>(`tr[data-row-key="${CSS.escape(key)}"]`)?.focus()
  }
  const closeDetail = () => {
    setSelection(null)
    focusRow(selectedKey)
  }
  const onRowClick = (event: React.MouseEvent<HTMLTableRowElement>, place: RowPlace) => {
    const target = event.target as Element
    // A click from a portal (a picker's popup opened from a cell) reaches
    // the row through React, not the DOM: it's that control's.
    if (!event.currentTarget.contains(target)) return
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const control = target.closest(ROW_CONTROL_SELECTOR)
    if (control && event.currentTarget.contains(control)) {
      if (!control.matches('a[href]') || onRowClickProp) return
      // In the capture phase, so react-router's Link sees it prevented and
      // doesn't navigate.
      event.preventDefault()
    }
    if (onRowClickProp) {
      const row = rows.find((candidate) => candidate.id === place.rowId)
      if (row) onRowClickProp(row.original)
      return
    }
    setSelection(place)
  }
  const onListKeyDown = (event: React.KeyboardEvent<HTMLTableElement>) => {
    const target = event.target as HTMLElement
    if (event.defaultPrevented || !event.currentTarget.contains(target) || target.closest(TYPING_SELECTOR)) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (places.length === 0) return
      event.preventDefault()
      const down = event.key === 'ArrowDown'
      const index = places.findIndex((place) => place.key === selectedKey)
      const nextIndex =
        index === -1 ? (down ? 0 : places.length - 1) : Math.min(places.length - 1, Math.max(0, index + (down ? 1 : -1)))
      const next = places[nextIndex]
      if (!next) return
      setSelection(next)
      focusRow(next.key)
    } else if (event.key === 'Enter' && target.dataset.rowKey !== undefined) {
      const place = places.find((candidate) => candidate.key === target.dataset.rowKey)
      if (!place) return
      event.preventDefault()
      if (onRowClickProp) {
        const row = rows.find((candidate) => candidate.id === place.rowId)
        if (row) onRowClickProp(row.original)
        return
      }
      setSelection(place)
    } else if (event.key === 'Escape' && selectedRow) {
      event.preventDefault()
      closeDetail()
    }
  }

  // One body row, the same in a plain table and a grouped one.
  const renderRow = (row: Row, key: string = row.id) => {
    const isSelected = key === selectedKey
    return (
    <TableRow
      key={key}
      data-highlighted={highlightRow?.(row.original) || undefined}
      {...(detailPanel
        ? {
            'data-row-key': key,
            'data-selected': isSelected || undefined,
            'aria-selected': isSelected,
            tabIndex: key === tabStopKey ? 0 : -1,
            onClickCapture: (event: React.MouseEvent<HTMLTableRowElement>) => onRowClick(event, { key, rowId: row.id }),
          }
        : {})}
      className={cn(
        pinFirstColumn && ROW_GROUP_CLASS,
        highlightRow?.(row.original) && HIGHLIGHTED_ROW_CLASS,
        detailPanel && SELECTABLE_ROW_CLASS,
        isSelected && SELECTED_ROW_CLASS,
      )}
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
  }

  const content = (
    <div
      ref={root}
      className={cn('flex flex-col gap-4', width === 'content' && CONTENT_WIDTH_CLASS)}
      data-width={width}
      data-layout={layouts?.length ? currentLayout : undefined}
      style={
        width === 'content' && !isSuccessView && lastWidth !== null
          ? ({ '--data-table-last-width': `${lastWidth}px` } as CSSProperties)
          : undefined
      }
    >
      {layouts?.length || groupings?.length ? (
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">{toolbar}</div>
          {groupings?.length ? (
            <div className="flex items-center gap-2">
              {activeGrouping && (
                <Button variant="ghost" size="sm" data-slot="data-table-fold-all" disabled={!runs?.length} onClick={foldAll}>
                  {allFolded ? 'Unfold all' : 'Fold all'}
                </Button>
              )}
              <GroupMenu groupings={groupings} value={activeGrouping?.id ?? ''} onValueChange={setGrouping} />
            </div>
          ) : null}
          {layouts?.length ? (
            <LayoutSwitch
              options={[
                { id: 'table', label: tableLayout?.label ?? 'Table', icon: tableLayout?.icon ?? TableIcon },
                ...layouts,
              ]}
              value={currentLayout}
              onValueChange={setLayout}
            />
          ) : null}
        </div>
      ) : (
        toolbar
      )}

      {error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : isLoading || isPastLastPage ? (
        cardLayout ? (
          <CardsSkeleton layout={cardLayout} />
        ) : (
          <TableSkeleton columnCount={table.getVisibleLeafColumns().length} />
        )
      ) : isEmpty ? (
        <Empty data-state="empty">
          <EmptyHeader>
            <EmptyTitle>{emptyTitle}</EmptyTitle>
            {emptyDescription && <EmptyDescription>{emptyDescription}</EmptyDescription>}
          </EmptyHeader>
          {emptyAction}
        </Empty>
      ) : (
        <DetailFrame
          enabled={Boolean(detailPanel) && !cardLayout}
          aside={
            selectedRow && detailPanel && isWide ? (
              <aside
                aria-label={detailLabel}
                data-slot="data-table-detail"
                className={DETAIL_ASIDE_CLASS}
                onKeyDown={(event) => {
                  const target = event.target as HTMLElement
                  if (event.key !== 'Escape' || event.defaultPrevented || target.closest(TYPING_SELECTOR)) return
                  event.preventDefault()
                  closeDetail()
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="type-label text-muted-foreground">{detailLabel}</h2>
                  <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={closeDetail}>
                    <XIcon aria-hidden="true" />
                  </Button>
                </div>
                {detailPanel(selectedRow.original)}
              </aside>
            ) : null
          }
        >
          {cardLayout ? (
            <Cards
              layout={cardLayout}
              runs={runs}
              rows={rows}
              folded={folded}
              onToggleFold={toggleFold}
              groupSummary={groupSummary}
              groupIcons={groupIcons}
            />
          ) : (
            <Table
              data-state="success"
              containerRef={containerRef}
              onKeyDown={detailPanel ? onListKeyDown : undefined}
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
              {runs ? (
                runs.map((run, runIndex) => {
                  const isFolded = folded.has(run.key)
                  return (
                    // A body per group, headed by a row header for it
                    // (scope="rowgroup"), so a screen reader names a cell's
                    // group the way it names its column.
                    <TableBody
                      key={`${runIndex}:${run.key}`}
                      data-slot="table-group"
                      data-folded={isFolded || undefined}
                    >
                      {/* The row's own has-aria-expanded tint (table.tsx) would
                          fill every open heading: it's never a row to pick. */}
                      <TableRow
                        data-slot="table-group-heading"
                        className="hover:bg-transparent has-aria-expanded:bg-transparent"
                      >
                        <TableHead scope="rowgroup" colSpan={visibleColumnCount} className={GROUP_HEADING_CLASS}>
                          {/* Sticky, so the label stays in view while a wide
                              table scrolls sideways. */}
                          <span className="sticky left-(--table-cell-px) inline-flex items-baseline gap-2">
                            <GroupLabel
                              run={run}
                              icon={groupIcons?.get(run.key)}
                              isFolded={isFolded}
                              onToggle={() => toggleFold(run.key)}
                            />
                            {groupSummary && (
                              <span className="type-caption text-muted-foreground tabular-nums">
                                {groupSummary(
                                  run.rows.map((row) => row.original),
                                  { key: run.key, label: run.label },
                                )}
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
                      {!isFolded && run.rows.map((row) => renderRow(row, placeKey(run.key, row.id)))}
                    </TableBody>
                  )
                })
              ) : (
                <TableBody>{rows.map((row) => renderRow(row))}</TableBody>
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
          )}

          {pinFirstColumn && isOverflowing && !cardLayout && (
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
        </DetailFrame>
      )}
    </div>
  )

  return (
    <EditInPlaceContext.Provider value={store}>
      {editing && <LeaveGuard store={store} />}
      {width === 'content' ? <div className="@container/data-table">{content}</div> : content}
      {detailPanel && (
        // Below the wide screen's width, the panel is a bottom sheet. Its
        // own Close and Escape close it, and focus goes back to the row.
        <Sheet
          open={Boolean(selectedRow) && !isWide && isSuccessView && !cardLayout}
          onOpenChange={(open) => {
            if (!open) setSelection(null)
          }}
        >
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto" data-slot="data-table-detail-sheet">
            <SheetHeader className="pb-0">
              <SheetTitle>{detailLabel}</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">{selectedRow && detailPanel(selectedRow.original)}</div>
          </SheetContent>
        </Sheet>
      )}
    </EditInPlaceContext.Provider>
  )
}

// The list and, once a row is picked on a wide screen, the detail panel
// beside it (`detailPanel`). Without a panel it adds nothing.
function DetailFrame({ enabled, aside, children }: { enabled: boolean; aside: ReactNode; children: ReactNode }) {
  if (!enabled) return <>{children}</>
  return (
    <div data-slot="data-table-with-detail" className={cn('grid items-start gap-4', aside && WITH_DETAIL_OPEN_CLASS)}>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
      {aside}
    </div>
  )
}

// A group's heading text: under a grouping, a button that folds the group,
// with its row count; under `groupBy`, the label alone.
function GroupLabel({
  run,
  icon,
  isFolded,
  onToggle,
}: {
  run: { label: string; rows: readonly unknown[]; foldable: boolean }
  icon?: ReactNode
  isFolded: boolean
  onToggle: () => void
}) {
  const label = (
    <>
      {icon ? (
        <span aria-hidden="true" className="inline-flex shrink-0 items-center self-center">
          {icon}
        </span>
      ) : null}
      <span className="type-label text-foreground">{run.label}</span>
    </>
  )
  if (!run.foldable) {
    return icon ? (
      <span className="inline-flex items-baseline gap-1.5">{label}</span>
    ) : (
      <span className="type-label text-foreground">{run.label}</span>
    )
  }
  return (
    <button type="button" aria-expanded={!isFolded} onClick={onToggle} className={GROUP_TOGGLE_CLASS}>
      <ChevronDownIcon
        aria-hidden="true"
        className={cn('size-4 self-center text-muted-foreground transition-transform', isFolded && '-rotate-90')}
      />
      {label}
      <span className="type-caption text-muted-foreground tabular-nums">{run.rows.length}</span>
    </button>
  )
}

// A card layout's success view: the rows as cards in a grid or a list,
// each group (`groupBy`, or a grouping) under its own heading, as the
// table's heading rows are, with the same label, summary and folding.
type CardRow<TData> = { id: string; original: TData }

function Cards<TData extends Record<string, unknown>>({
  layout,
  runs,
  rows,
  folded,
  onToggleFold,
  groupSummary,
  groupIcons,
}: {
  layout: DataTableCardLayout<TData>
  runs: (GroupRun<CardRow<TData>> & { foldable: boolean })[] | null
  rows: readonly CardRow<TData>[]
  folded: ReadonlySet<string>
  onToggleFold: (key: string) => void
  groupSummary?: (rows: TData[], group: RowGroup) => ReactNode
  groupIcons?: ReadonlyMap<string, ReactNode>
}) {
  const list = (items: readonly CardRow<TData>[]) => (
    <ul
      role="list"
      className={cn(
        layout.arrange === 'list' ? CARD_LIST_CLASS : ['grid', CARD_GRID_CLASS[layout.size ?? 'md'], CARD_GRID_GAP_CLASS],
      )}
    >
      {items.map((row) => (
        <li key={row.id} data-slot="data-table-card" className="min-w-0">
          {layout.renderCard(row.original)}
        </li>
      ))}
    </ul>
  )
  return (
    <div className="@container/data-table-cards flex flex-col gap-6" data-state="success" data-slot="data-table-cards">
      {runs
        ? runs.map((run, runIndex) => {
            const isFolded = folded.has(run.key)
            return (
              <section
                key={`${runIndex}:${run.key}`}
                data-slot="table-group"
                data-folded={isFolded || undefined}
                className="flex flex-col gap-3"
              >
                <h2 data-slot="table-group-heading" className="flex items-baseline gap-2 border-b border-border pb-1.5">
                  <GroupLabel run={run} icon={groupIcons?.get(run.key)} isFolded={isFolded} onToggle={() => onToggleFold(run.key)} />
                  {groupSummary && (
                    <span className="type-caption text-muted-foreground tabular-nums">
                      {groupSummary(
                        run.rows.map((row) => row.original),
                        { key: run.key, label: run.label },
                      )}
                    </span>
                  )}
                </h2>
                {!isFolded && list(run.rows)}
              </section>
            )
          })
        : list(rows)}
    </div>
  )
}
