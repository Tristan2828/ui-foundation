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
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react'
import {
  UNSAFE_LocationContext as LocationContext,
  UNSAFE_NavigationContext as NavigationContext,
  type Location,
  type Navigator,
} from 'react-router'
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
  Settings2Icon,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { ArtworkAspect } from './artwork'
import { EditInPlaceContext } from './edit-in-place'
import { EditInPlaceStore } from './edit-in-place-store'
import { LeaveGuard } from './editable-value'
import { recordDialogState } from './record-dialog-context'
import { IconAction } from './icon-action'
import type { IconComponent } from './icon-component'
import { groupByValues, groupRuns, type GroupRun, type RowGroup } from './table-groups'
import {
  ColumnsMenu,
  ColumnsMenuItems,
  PHONE_LIST_CLASS,
  PhoneRow,
  PhoneRowsSkeleton,
  RowActions,
  ViewAllLink,
  ViewPills,
  type DataTableColumnsMenu,
  type DataTablePhoneRow,
  type DataTableRowAction,
  type DataTableView,
  type DataTableViewAll,
} from './data-table-tools'
import { ROW_ACTIONS_COLUMN_ID, visibleFromPick } from './table-columns'
import { useColumnsPick } from '@/hooks/use-columns-pick'
import { useIsPhone } from '@/hooks/use-is-phone'
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
    /**
     * Long text on one line (DataTable): cut at `maxWidth` with an ellipsis,
     * the whole text in a tooltip on hover and on focus (a cut cell takes a
     * tab stop, so the keyboard reaches it too). Screen readers read it whole.
     */
    clip?: boolean
    /**
     * The widest the column's content gets, as a CSS length: `'24rem'`
     * unless set, with `clip` (and never over 60% of the table's area, for
     * a phone). Without `clip`, the content wraps at it. The title column
     * (the first) is cut at 24rem when neither is set.
     */
    maxWidth?: string
    /**
     * The title column (the table's first, the row's name): wrap at
     * `maxWidth` (`'24rem'` unless set) instead of the default, one line cut
     * at 24rem with an ellipsis. For a title worth reading whole in the row.
     * A title column with `maxWidth: 'none'` has no cap at all (the look
     * before 4.103); one with its own `clip` or `maxWidth` is cut or wrapped
     * at it, as any column is.
     */
    wrap?: boolean
    /**
     * The column's name in DataTable's Columns menu (`columnsMenu`), for a
     * column whose `header` isn't a string.
     */
    label?: string
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */
}

export type DataTableProps<TData extends Record<string, unknown>, TView extends DataTableView = DataTableView> = {
  columns: LegacyColumnDef<TData, unknown>[]
  data: TData[]
  total: number
  /** 1-based, matching QuerySpec.page. */
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  /**
   * The rows-per-page choices (`[25, 50, 100]`), drawn as a menu in the
   * pagination bar with `onPageSizeChange`: useTableUrlState's `pageSizes`,
   * `pageSize` and `setPageSize`, which keep the pick in the URL and on this
   * device (`pageSizeStorageKey`). Left out, the bar has no menu.
   */
  pageSizes?: readonly number[]
  onPageSizeChange?: (pageSize: number) => void
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
   * `content` (the default, 4.83): the table and its pagination are as wide
   * as the columns need, at least 36rem (or the whole width, when that's
   * less), with empty space at the right, so a name stays close to its
   * values at any screen size; wider than the area, the table scrolls
   * sideways in it. The toolbar keeps the whole width, so its controls
   * don't move between lists. While loading, empty or failed after a
   * load, it keeps the width it last had, so paging and filtering don't
   * move it (only the first load can). `full`: the table takes the whole
   * width too (the default before 4.83). A card layout takes the whole
   * width either way.
   */
  width?: DataTableWidth
  /**
   * Zebra stripes on the body rows (every other row tinted), as before
   * 4.83. Off by default: rows are told apart by the line under each.
   */
  striped?: boolean
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
   * While rows are grouped (`groupBy` or a grouping), pins each heading
   * below the column header while its group scrolls past, and pins the
   * column header above it. When the columns fit, they stick to whatever
   * scrolls the page. When they don't, the table scrolls both ways inside
   * a box no taller than the screen, and they stick to that. The table
   * layout's alone: a card layout's headings scroll with their cards.
   * Ungrouped, it changes nothing.
   */
  stickyGroupHeadings?: boolean
  /**
   * With `stickyGroupHeadings`: how far from the top of the screen the
   * pinned header and headings sit, for a page with a bar of its own pinned
   * to the top. Any CSS length (`'3.5rem'`, `'var(--page-bar-height)'`),
   * resolved at the table, so a variable the page sets per breakpoint gives
   * a phone and a desktop their own offset. When the columns are wider than
   * their box, the box is that much shorter than the screen instead, so it
   * fits below the bar. Without it, they sit at the very top (`0px`).
   */
  stickyTop?: string
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
   * How a row opens its record: one of the foundation's ways, the same for
   * every list (add-an-entity.md "How a list opens a record"). A dialog over
   * the list (`dialog`: the record also has its full page; `dialog-only`:
   * it has none, its route a `RecordDialogRoute` with `fullPage={false}`),
   * its own page (`page`), the panel beside the list (`panel`, with
   * `detailPanel`), or nothing to open, every value edited in its row
   * (`rows`). `to` is the record's absolute address.
   *
   * A click on the row or Enter on it opens the record, and so does a click
   * on a link in the row to that same address (the title's), so a name cell
   * can stay a plain link: a modified click still opens it in a new tab.
   * Other links and controls keep their own click. In a card layout, a
   * click on a card's link to the record opens it the same way.
   * `onRowClick`, when given, wins over it.
   */
  opens?: DataTableOpens<TData>
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
   * What a click on a row (or Enter on it) does: open its page, or open it
   * in a dialog over the list (`useOpenRecord`, add-an-entity.md "Opening a
   * record over its list"). The rows then take a pointer and the keyboard
   * (↑/↓ between rows, Enter). A link or control inside the row keeps its
   * own click. With a `detailPanel` it replaces picking the row, and the
   * panel is then opened from the app's own control through `detailRow`.
   * Left out, a row click picks the row for the panel, if there is one.
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
  /**
   * The list's saved views as pills above the toolbar (the list page
   * standard, L3): useTableUrlState's views, by id, each with a `label`, in
   * their order. One is pressed while it's `activeView`; none once the
   * filters move off every view. Under 48rem they stay on one line that
   * scrolls sideways. A view with `columns` shows those while it's on, over
   * the Columns menu's pick.
   */
  views?: Readonly<Record<string, TView>>
  /** The view on: useTableUrlState's `activeView`, or null. */
  activeView?: string | null
  /** A pill pressed: useTableUrlState's `applyView` (it gets the view, then its id). */
  onViewChange?: (view: TView, id: string) => void
  /** The pills' group name: "Views" unless set. */
  viewsLabel?: string
  /**
   * The list page's header (4.106, the list standard's C3): its
   * `<ListHeader>`, drawn above the views. In the framed look with
   * `width="content"` the header, the views and the card share one width,
   * the table's, so the header's ⋯ and New end on the card's right edge
   * above a short table instead of at the page's far edge. With
   * `width="full"`, a table wider than the page, or the row list on a
   * phone, it spans the page as before.
   */
  pageHeader?: ReactNode
  /**
   * A Columns menu at the end of the toolbar (L5): a tick for every column
   * but the first (the name) and the row actions, remembered on this device
   * under `storageKey`. Until something is ticked it starts from
   * `visibleColumns` (or every column). While a view with `columns` is on,
   * the view's columns show and the ticks can't change. A column's name in
   * the menu is its string `header`, or `meta.label`.
   */
  columnsMenu?: DataTableColumnsMenu
  /**
   * A row's actions (L9), in a column of their own pinned to the right edge,
   * its header for screen readers only. One action is its icon (its label
   * the tooltip and name), two or more a ⋯ menu. A row with none gets an
   * empty cell. A click on them never opens the row.
   */
  rowActions?: (row: TData) => readonly DataTableRowAction[]
  /**
   * Under 48rem, a row list in place of the table (L11): the name, the
   * status at the line's end, and one muted line of the facts that matter.
   * The whole row is the target, 44px at least, and opens as `opens` says
   * (a link to the record, so a long press or a modified click works as
   * links do); rows edited in place (`kind: 'rows'`) open nothing here.
   * Row actions sit at the row's end. Headings, paging and every state hold;
   * `totals` is the table's alone. A card layout, when picked, wins.
   */
  phoneRow?: DataTablePhoneRow<TData>
  /**
   * At most this many rows, with no pagination bar: a record's list of
   * related records (R8, or RelatedTable). The caller still fetches only
   * that many; `data` past it isn't shown.
   */
  limit?: number
  /**
   * With `limit`: a View all link under the rows to the whole list, shown
   * when there are more than the rows shown.
   */
  viewAll?: DataTableViewAll
  /**
   * How the list is drawn around its rows (4.100). `plain` (the default):
   * the toolbar above the whole width, the Columns and Group menus as
   * buttons at its end, the pagination under the rows. `framed`: the
   * list is a card with a border, as wide as the table under `width`'s
   * rules, so its tools end at the table's own edge and nothing sits off
   * at the far right of a wide page. The card's top bar holds the toolbar
   * (search and Filters keep their words), Fold All while grouped, one
   * settings button holding the Columns ticks and Group By, and the layout
   * switch; its bottom bar holds the count and the pager. Saved views stay
   * above the card, outside its bar. Every other prop works the same way.
   */
  look?: DataTableLook
}

/** How DataTable draws the list around its rows (`look`). */
export type DataTableLook = 'plain' | 'framed'

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

/**
 * How a list's rows open their records (`opens`): a dialog over the list
 * with the record's full page behind it, a dialog only, its own page, the
 * panel beside the list, or nothing to open (edited in its rows).
 */
export type DataTableOpens<TData> =
  | { kind: 'dialog' | 'dialog-only' | 'page'; to: (row: TData) => string }
  | { kind: 'panel' }
  | { kind: 'rows' }

export type DataTableOpensKind = DataTableOpens<unknown>['kind']

// Whether a link is to `to` (its path and query), the record the row opens.
function linksTo(link: Element, to: string): boolean {
  if (!(link instanceof HTMLAnchorElement)) return false
  const target = new URL(to, link.href)
  const href = new URL(link.href)
  return href.origin === target.origin && href.pathname === target.pathname && href.search === target.search
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

type GroupMenuProps<TData> = {
  groupings: readonly DataTableGrouping<TData>[]
  value: string
  onValueChange: (grouping: string) => void
}

// The Group menu's items alone: its own menu's, and the framed look's
// settings menu's second group.
function GroupMenuItems<TData>({ groupings, value, onValueChange }: GroupMenuProps<TData>) {
  const current = groupings.find((grouping) => grouping.id === value)
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Group By</DropdownMenuLabel>
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
  )
}

function GroupMenu<TData>(props: GroupMenuProps<TData>) {
  const current = props.groupings.find((grouping) => grouping.id === props.value)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" data-slot="data-table-group-menu" />}>
        <ListTreeIcon aria-hidden="true" />
        {current ? `Group: ${current.label}` : 'Group'}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <GroupMenuItems {...props} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// The framed look's one settings button (`look="framed"`): the Columns
// ticks, then Group By, in one menu, in place of the two buttons with
// words. Its name says what's set that the bar no longer shows ("Table
// Settings, Grouped by Status"), and a dot on it says so to the eye.
function TableSettingsMenu<TData>({
  columns,
  grouping,
  changed,
}: {
  columns?: React.ComponentProps<typeof ColumnsMenuItems>
  grouping?: GroupMenuProps<TData>
  /** The columns differ from the list's own: a pick of the reader's, or a view's. */
  changed: boolean
}) {
  const current = grouping?.groupings.find((each) => each.id === grouping.value)
  const label = current ? `Table Settings, Grouped by ${current.label}` : 'Table Settings'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <IconAction
            icon={Settings2Icon}
            label={label}
            size="sm"
            data-tool="table-settings"
            data-set={current || changed ? true : undefined}
            className={SETTINGS_DOT_CLASS}
          />
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        {columns ? <ColumnsMenuItems {...columns} /> : null}
        {columns && grouping ? <DropdownMenuSeparator /> : null}
        {grouping ? <GroupMenuItems {...grouping} /> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// The dot on the settings button while something in it is set: the
// primary colour, ringed in the button's own background so it reads on
// either theme. Decoration: the button's name says it in words.
const SETTINGS_DOT_CLASS =
  'relative data-set:after:absolute data-set:after:top-0.5 data-set:after:right-0.5 data-set:after:size-2 ' +
  'data-set:after:rounded-full data-set:after:bg-primary data-set:after:ring-2 data-set:after:ring-background ' +
  "data-set:after:content-['']"

// `look="framed"`: the card around the list, and its two bars. The card
// clips (never hides) its overflow, so the rounded corners hold and sticky
// headings still stick to the page.
const FRAME_CLASS = 'flex flex-col overflow-clip rounded-lg border border-border bg-background'
// The phone's row list inside the card: the card is its border.
const FRAMED_PHONE_ROWS_CLASS = '[&_[data-slot=data-table-phone-rows]_ul]:rounded-none [&_[data-slot=data-table-phone-rows]_ul]:border-0'
const FRAME_BAR_CLASS = 'flex flex-wrap items-center gap-x-4 gap-y-2 bg-card px-3 py-2.5 text-card-foreground max-md:gap-x-2'

// The rows-per-page menu in the pagination bar (`pageSizes`): a radio list
// that closes on a pick. The button says the size in words of its own
// ("50 rows", as the list page standard drew it), and the menu says
// what it is.
function PageSizeMenu({
  pageSizes,
  value,
  onValueChange,
}: {
  pageSizes: readonly number[]
  value: number
  onValueChange: (pageSize: number) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            data-slot="data-table-page-size"
            aria-label={`${value} rows per page`}
          />
        }
      >
        {value} rows
        <ChevronDownIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Rows per Page</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={String(value)} onValueChange={(next) => onValueChange(Number(next))}>
            {pageSizes.map((size) => (
              <DropdownMenuRadioItem key={size} value={String(size)} closeOnClick>
                {size}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// A cell's text cut to one line (`meta.clip`). Only when it is cut does it
// take a tab stop and a tooltip with the whole text, on hover and on focus;
// re-measured on every render (the text may change) and on every resize.
// A cut cell whose content has a control of its own (the title's link)
// takes no tab stop: the control already has one, and focusing it opens
// the tooltip, since focus reaches the trigger from inside it.
function ClippedText({
  maxWidth,
  slot = 'data-table-clip',
  children,
}: {
  maxWidth: string
  slot?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [fullText, setFullText] = useState<string | null>(null)
  const [hasControl, setHasControl] = useState(false)
  const measure = () => {
    const element = ref.current
    if (!element) return
    const isCut = element.scrollWidth > element.clientWidth + 0.5
    setFullText(isCut ? element.textContent?.trim() || null : null)
    setHasControl(element.querySelector(ROW_CONTROL_SELECTOR) !== null)
  }
  useLayoutEffect(measure)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(() => measure())
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return (
    <Tooltip disabled={fullText === null}>
      <TooltipTrigger
        render={
          <span
            ref={ref}
            data-slot={slot}
            className={slot === 'data-table-title' ? TITLE_CLIP_CLASS : CLIP_CLASS}
            // Never more than 60% of the table's area, so on a phone the
            // cut column leaves the name and the rest room.
            style={{ maxWidth: `min(${maxWidth}, 60cqw)` }}
            tabIndex={fullText === null || hasControl ? undefined : 0}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent className="max-w-sm break-words whitespace-normal">{fullText}</TooltipContent>
    </Tooltip>
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
// bleed-through a solid background avoids. With `striped`, on an even row
// it's the stripe pre-mixed onto the page (--table-stripe), so the stripe
// runs the whole row's width (issue #92); `:where()` keeps that rule's
// specificity at the background's, so the row's hover below still wins.
const PINNED_CELL_CLASS = 'z-10 bg-background'
const PINNED_STRIPED_CELL_CLASS = '[:where(tbody>tr:nth-child(even))>&]:bg-(--table-stripe)'

const PINNED_COLUMN_CLASS = `sticky left-0 border-r ${PINNED_CELL_CLASS}`
const PINNED_LAST_COLUMN_CLASS = `sticky right-0 border-l ${PINNED_CELL_CLASS}`

// The totals row's label, pinned with the first column (`totals`): the
// same opaque cell, with no hover, since the row isn't one to pick.
const PINNED_TOTALS_LABEL_CLASS = PINNED_COLUMN_CLASS

// `striped` off (the default, 4.83): table.tsx's zebra taken back off the
// body (tailwind-merge drops its even-row tint for this one), so rows are
// told apart by the line under each.
const UNSTRIPED_BODY_CLASS = '[&_tr:nth-child(even)]:bg-transparent'

// A body row under the pointer (4.83): every cell, pinned ones included,
// in --table-hover (solid, so a pinned cell can wear it), with a bar in
// --primary on the first cell, so it reads without colour too; an inset
// shadow rather than a border, so nothing reflows. On a cell, not the row,
// so it covers a stripe and a pinned cell's opaque background alike
// (`.row:hover > td` outranks both). Muted text on it takes the darker grey
// a highlighted row's does (theme.css --table-hover). table.tsx's own row
// hover comes off: it would sit under the cells' tint anyway. A row that
// opens a record adds the hand cursor (SELECTABLE_ROW_CLASS); one edited in
// place keeps the arrow. A highlighted or picked row keeps its own look.
const HOVER_ROW_CLASS =
  'hover:bg-transparent hover:[--muted-foreground:var(--table-highlight-muted-foreground)] ' +
  'hover:[&>td]:bg-(--table-hover) hover:[&>td:first-child]:shadow-[inset_3px_0_0_0_var(--primary)]'
// Its bar and a focused row's ring, both on the first cell's shadow.
const HOVER_FOCUSED_ROW_CLASS =
  'focus-visible:hover:[&>td:first-child]:shadow-[inset_3px_0_0_0_var(--primary),inset_0_2px_0_0_var(--ring),inset_0_-2px_0_0_var(--ring)]'

// A column's `meta.clip`: one line, cut at `meta.maxWidth` with an ellipsis.
const DEFAULT_CLIP_WIDTH = '24rem'
const CLIP_CLASS =
  'block truncate rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
// The title's: padding, taken back by the margin, keeps its link's focus
// ring clear of the cut.
const TITLE_CLIP_CLASS = cn(CLIP_CLASS, '-m-1 p-1')

// A pinned first column's content, capped below md at 45% of the table's
// scroll area (`cqw`: the container is an inline-size query container)
// and wrapping, so a long title can't widen the column past the screen
// and leave every other column scrolling underneath it (issue #91).
// The title inside is capped at every width too (cut at 24rem, or
// wrapped with `meta.wrap`), so wider screens don't overrun either.
const PINNED_FIRST_CONTENT_CLASS = 'max-md:max-w-[45cqw] max-md:whitespace-normal max-md:break-words'

// `highlightRow`: the wash on every cell, so it covers the zebra stripe
// (on the row) and the pinned cells' opaque backgrounds (on the cell, and
// one class weaker than this); hover leaves it as it is, so "next up" never
// reads as the pointer's row. A bar in info-text on the first cell, as
// hover's is in --primary, so it reads without colour too.
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

// The column header row (4.105): the muted fill on every header cell, so
// the row of names reads apart from the rows of data, in the plain and
// framed looks alike. On the cells, not the row, so a pinned or stuck
// header cell (opaque, bg-background above) wears it too: listed after
// those, it wins. Its words keep --foreground, clear on --muted in every
// theme and palette.
const HEAD_CELL_CLASS = 'bg-muted'

// A group's heading row (`groupBy`): a little air above, so the groups
// read apart, and the page's background, never the zebra stripe.
// A column's `meta.align` as the class its header, cells and totals take.
const ALIGN_CLASS = { center: 'text-center', right: 'text-right' } as const
const alignClass = (align: 'center' | 'right' | undefined) => align && ALIGN_CLASS[align]

const GROUP_HEADING_CLASS = 'h-auto bg-background pt-4 pb-1.5 align-bottom'

// `stickyGroupHeadings`. An `overflow-x-auto` box scrolls on both axes as far
// as `position: sticky` is concerned, so a cell inside it sticks to that box
// and never to the page. When the columns fit, the box only clips, which
// leaves the page's scroll to stick to. When they don't, the box has to
// scroll sideways, so it's bounded to the screen and scrolls down too.
// `isolate` keeps these z-indexes inside the table.
const STICKY_PAGE_SCROLL_CLASS = 'isolate overflow-x-clip'
const STICKY_OWN_SCROLL_CLASS = 'isolate max-h-[calc(100dvh-var(--data-table-sticky-top))] overflow-auto'

// Collapsed borders stay where the row was, so a stuck cell draws its rule
// as an inset shadow and its row's border comes off. Above the pinned
// columns (z-10): the column header over the headings over the rows. A
// cell's sticky bounds are the whole table, not its group, so a heading isn't
// pushed off by the next: the next slides over it, later in the DOM and opaque.
const STICKY_RULE_CLASS = 'shadow-[inset_0_-1px_0_0_var(--border)]'
//
// `stickyTop` moves both down by --data-table-pin-top: the app's offset on the
// page's scroll, none in a box of the table's own (that box's top is its own,
// and the box is shortened by the offset instead).
const STICKY_HEAD_CELL_CLASS = `sticky top-(--data-table-pin-top) z-30 bg-background ${STICKY_RULE_CLASS}`
const STICKY_GROUP_HEADING_CLASS =
  `sticky top-[calc(var(--data-table-pin-top)+var(--data-table-head-height))] z-20 pt-2 ${STICKY_RULE_CLASS}`

// What focus scrolls to clears the stuck header and heading (3rem covers a
// heading's height, large density included).
const STICKY_FOCUS_CLASS =
  '[&_tbody_*]:scroll-mt-[calc(var(--data-table-pin-top)+var(--data-table-head-height)+--spacing(12))]'

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

// `width="content"`: the table and its pagination (not the toolbar) as wide
// as the columns need (`w-fit` over the table's own `w-full`), at least
// 36rem, or the width it last had loaded while it shows another state
// (--data-table-last-width), and never wider than the area: `min()` keeps
// the minimum from pushing past a phone's width, since a min-width
// outranks a max-width.
const CONTENT_WIDTH_CLASS =
  'w-fit max-w-full min-w-[min(100%,max(--spacing(144),var(--data-table-last-width,0px)))]'

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

// `stickyGroupHeadings`: whether the columns are wider than their box, which
// picks what the headings stick to, and the column header's measured height,
// which is where they stick (a header can wrap, or be hidden, so it isn't
// always --table-head-height). A layout effect, so the first paint is right.
// The table's width, not the box's scrollWidth: it reads the same in either
// mode, and a scrollbar the bounded box draws can't flip the answer back.
function useStickyHeadings(containerRef: React.RefObject<HTMLDivElement | null>, enabled: boolean) {
  const [scrollsSideways, setScrollsSideways] = useState(false)
  const [headHeight, setHeadHeight] = useState(0)

  useLayoutEffect(() => {
    const container = containerRef.current
    const contentTable = container?.querySelector('table')
    const head = contentTable?.querySelector('thead')
    if (!enabled || !container || !contentTable || !head) return

    const measure = () => {
      setScrollsSideways(contentTable.getBoundingClientRect().width > container.getBoundingClientRect().width + 0.5)
      setHeadHeight(head.getBoundingClientRect().height)
    }
    measure()

    const resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(container)
    resizeObserver.observe(contentTable)
    return () => resizeObserver.disconnect()
  }, [containerRef, enabled])

  return { scrollsSideways, headHeight }
}

// `rowActions`: the column DataTable adds for them, pinned last. Its cell
// reads the app's function through context, so the column stays the same
// object between renders (a new one would remount every cell, and close a
// menu that's open).
const RowActionsContext = createContext<((row: never) => readonly DataTableRowAction[]) | undefined>(undefined)

function RowActionsCell({ row }: { row: { original: unknown } }) {
  const getActions = useContext(RowActionsContext) as ((row: unknown) => readonly DataTableRowAction[]) | undefined
  return <RowActions actions={getActions?.(row.original) ?? []} />
}

const ROW_ACTIONS_COLUMN = {
  id: ROW_ACTIONS_COLUMN_ID,
  enableSorting: false,
  header: () => <span className="sr-only">Actions</span>,
  cell: RowActionsCell,
  meta: { align: 'right' as const },
}

// The cell under the actions' column: as narrow as its button.
const ROW_ACTIONS_CELL_CLASS = 'w-px py-0'

export function DataTable<TData extends Record<string, unknown>, TView extends DataTableView = DataTableView>({
  columns,
  data,
  total,
  page,
  pageSize,
  onPageChange,
  pageSizes,
  onPageSizeChange,
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
  width = 'content',
  striped = false,
  groupBy,
  groupSummary,
  stickyGroupHeadings = false,
  stickyTop = '0px',
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
  opens,
  detailPanel,
  onRowClick: onRowClickProp,
  detailRow,
  onDetailRowChange,
  detailLabel = 'Details',
  views,
  activeView = null,
  onViewChange,
  viewsLabel = 'Views',
  pageHeader,
  columnsMenu,
  rowActions,
  phoneRow,
  limit,
  viewAll,
  look = 'plain',
}: DataTableProps<TData, TView>) {
  // The switch's own state, for a table that doesn't pass `layout`.
  const [ownLayout, setOwnLayout] = useState('table')
  const requestedLayout = layoutProp ?? ownLayout
  const cardLayout = layouts?.find((candidate) => candidate.id === requestedLayout)
  const currentLayout = cardLayout?.id ?? 'table'
  const setLayout = (next: string) => {
    if (layoutProp === undefined) setOwnLayout(next)
    onLayoutChange?.(next)
  }

  // `opens`: the record a row opens, and opening it. Read through the
  // router's contexts, not its hooks, so a table outside a router (a
  // fixture, a widget) still renders; there, nothing opens.
  const navigation = useContext(NavigationContext) as { navigator: Navigator } | null
  const routerLocation = useContext(LocationContext) as { location: Location } | null
  const opensTo = opens && 'to' in opens ? opens : null
  const openRecord =
    opensTo && navigation && routerLocation
      ? (row: TData) => {
          const to = opensTo.to(row)
          if (opensTo.kind === 'page') void navigation.navigator.push(to)
          else void navigation.navigator.push(to, recordDialogState(routerLocation.location))
        }
      : undefined
  const openRow = onRowClickProp ?? openRecord

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

  // The columns showing: a view's while it's on, else the Columns menu's
  // pick, else the app's `visibleColumns`. The first column always shows.
  const leafIds = leafColumnIds(columns)
  const fixedColumns = leafIds.slice(0, 1)
  const viewColumns = activeView !== null ? views?.[activeView]?.columns : undefined
  const [columnsPick, setColumnsPick] = useColumnsPick(columnsMenu?.storageKey)
  const shownColumns =
    viewColumns ?? (columnsMenu && columnsPick ? visibleFromPick(leafIds, columnsPick, fixedColumns) : visibleColumns)

  // `rowActions`: their column, last.
  const hasRowActions = Boolean(rowActions)
  const tableColumns = useMemo(
    () => (hasRowActions ? [...columns, ROW_ACTIONS_COLUMN as unknown as LegacyColumnDef<TData, unknown>] : columns),
    [columns, hasRowActions],
  )
  const pinLast = Boolean(pinLastColumn || hasRowActions)

  // `limit`: a capped list shows that many rows and no pagination bar.
  const shownData = limit === undefined ? data : data.slice(0, limit)

  // `phoneRow`: a row list in place of the table under 48rem.
  const isPhone = useIsPhone()

  // TanStack treats a column missing from this map as visible, so every
  // column gets an entry once a list is given.
  // While grouped, the grouped column is hidden: its value is the heading.
  const columnVisibility = {
    ...(shownColumns
      ? Object.fromEntries(leafIds.map((id) => [id, fixedColumns.includes(id) || shownColumns.includes(id)]))
      : {}),
    ...(activeGrouping ? { [activeGrouping.id]: false } : {}),
  }

  const table = useLegacyTable({
    data: shownData,
    columns: tableColumns,
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
  // A card layout's grid takes the whole width whatever `width` says.
  const showPhoneRows = Boolean(phoneRow) && isPhone && !cardLayout
  const fitsColumns = width === 'content' && !cardLayout && !showPhoneRows
  const root = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const [lastWidth, setLastWidth] = useState<number | null>(null)
  useLayoutEffect(() => {
    const element = body.current
    if (!fitsColumns || !isSuccessView || !element) return
    const observer = new ResizeObserver(() => setLastWidth(Math.round(element.getBoundingClientRect().width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [fitsColumns, isSuccessView])

  const containerRef = useRef<HTMLDivElement>(null)
  const { barRef, isOverflowing, scrollWidth } = useBottomScrollbar(
    containerRef,
    Boolean(pinFirstColumn) && isSuccessView && !cardLayout && !showPhoneRows,
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
  const stickyGroups = stickyGroupHeadings && runs !== null && !cardLayout
  const { scrollsSideways, headHeight } = useStickyHeadings(containerRef, stickyGroups && isSuccessView)
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
  // Rows that open on a click or Enter: picked for the panel, or the app's
  // own `onRowClick`, or the record `opens` names (a dialog or its page).
  const rowsOpen = Boolean(detailPanel || openRow)
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
    const row = rows.find((candidate) => candidate.id === place.rowId)
    const control = target.closest(ROW_CONTROL_SELECTOR)
    if (control && event.currentTarget.contains(control)) {
      if (!control.matches('a[href]')) return
      // A link keeps its click, unless it's the panel's row (a title link
      // picks the row) or the record `opens` names (the title, again).
      const ownLink = !onRowClickProp && opensTo && row ? linksTo(control, opensTo.to(row.original)) : false
      if (onRowClickProp || (openRecord && !ownLink)) return
      // In the capture phase, so react-router's Link sees it prevented and
      // doesn't navigate.
      event.preventDefault()
    }
    if (openRow) {
      if (row) openRow(row.original)
      return
    }
    setSelection(place)
  }
  // A card layout's card: a click on its link to the record `opens` names
  // opens it the same way a row does (a dialog over the list, say).
  const onCardClick = (event: React.MouseEvent<HTMLElement>, row: TData) => {
    if (!openRecord || !opensTo || onRowClickProp) return
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const link = (event.target as Element).closest('a[href]')
    if (!link || !event.currentTarget.contains(link) || !linksTo(link, opensTo.to(row))) return
    event.preventDefault()
    openRecord(row)
  }
  const onListKeyDown = (event: React.KeyboardEvent<HTMLTableElement>) => {
    const target = event.target as HTMLElement
    if (event.defaultPrevented || !event.currentTarget.contains(target) || target.closest(TYPING_SELECTOR)) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (places.length === 0) return
      event.preventDefault()
      const down = event.key === 'ArrowDown'
      // From the picked row, or (no panel: rows that only open) the focused one.
      const fromKey = selectedKey ?? target.closest<HTMLElement>('tr[data-row-key]')?.dataset.rowKey
      const index = places.findIndex((place) => place.key === fromKey)
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
      if (openRow) {
        const row = rows.find((candidate) => candidate.id === place.rowId)
        if (row) openRow(row.original)
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
    const isSelected = Boolean(detailPanel) && key === selectedKey
    const isHighlighted = Boolean(highlightRow?.(row.original))
    const hovers = !isHighlighted && !isSelected
    return (
    <TableRow
      key={key}
      data-highlighted={isHighlighted || undefined}
      {...(rowsOpen
        ? {
            'data-row-key': key,
            ...(detailPanel ? { 'data-selected': isSelected || undefined, 'aria-selected': isSelected } : {}),
            tabIndex: key === tabStopKey ? 0 : -1,
            onClickCapture: (event: React.MouseEvent<HTMLTableRowElement>) => onRowClick(event, { key, rowId: row.id }),
          }
        : {})}
      className={cn(
        'hover:bg-transparent',
        hovers && HOVER_ROW_CLASS,
        isHighlighted && HIGHLIGHTED_ROW_CLASS,
        rowsOpen && SELECTABLE_ROW_CLASS,
        rowsOpen && hovers && HOVER_FOCUSED_ROW_CLASS,
        isSelected && SELECTED_ROW_CLASS,
      )}
    >
      {row.getVisibleCells().map((cell, index) => {
        const meta = cell.column.columnDef.meta
        const value = flexRender(cell.column.columnDef.cell, cell.getContext())
        // The title column (the first) is capped at every width (a long
        // discussion topic overran above md): cut to one line by default,
        // or wrapped with `meta.wrap`; `maxWidth: 'none'` lifts the cap. A
        // first column with its own `clip` or `maxWidth` keeps their meaning.
        const isTitle =
          index === 0 &&
          cell.column.id !== ROW_ACTIONS_COLUMN_ID &&
          (meta?.wrap || (!meta?.clip && meta?.maxWidth === undefined))
        const shown = isTitle && meta?.wrap ? (
          <div
            data-slot="data-table-title"
            className="whitespace-normal break-words"
            style={{ maxWidth: `min(${meta.maxWidth ?? DEFAULT_CLIP_WIDTH}, 60cqw)` }}
          >
            {value}
          </div>
        ) : isTitle ? (
          <ClippedText maxWidth={meta?.maxWidth ?? DEFAULT_CLIP_WIDTH} slot="data-table-title">
            {value}
          </ClippedText>
        ) : meta?.clip ? (
          <ClippedText maxWidth={meta.maxWidth ?? DEFAULT_CLIP_WIDTH}>{value}</ClippedText>
        ) : meta?.maxWidth && meta.maxWidth !== 'none' ? (
          <div className="whitespace-normal break-words" style={{ maxWidth: meta.maxWidth }}>
            {value}
          </div>
        ) : (
          value
        )
        const isPinnedFirst = pinFirstColumn && index === 0
        const isPinnedLast = pinLast && index === row.getVisibleCells().length - 1
        return (
          <TableCell
            key={cell.id}
            className={cn(
              isPinnedFirst && PINNED_COLUMN_CLASS,
              isPinnedLast && PINNED_LAST_COLUMN_CLASS,
              (isPinnedFirst || isPinnedLast) && striped && PINNED_STRIPED_CELL_CLASS,
              alignClass(meta?.align),
              cell.column.id === ROW_ACTIONS_COLUMN_ID && ROW_ACTIONS_CELL_CLASS,
            )}
          >
            {isPinnedFirst ? <div className={PINNED_FIRST_CONTENT_CLASS}>{shown}</div> : shown}
          </TableCell>
        )
      })}
    </TableRow>
    )
  }

  // `columnsMenu`: every column but the first and the actions, by name.
  const menuColumns = columnsMenu
    ? table
        .getAllLeafColumns()
        .filter((column) => column.id !== ROW_ACTIONS_COLUMN_ID && !fixedColumns.includes(column.id))
        .map((column) => {
          const header = column.columnDef.header
          return { id: column.id, label: column.columnDef.meta?.label ?? (typeof header === 'string' ? header : column.id) }
        })
    : []

  // `views`: the pills, in the views' order.
  const viewEntries = views ? Object.entries(views) : []

  // A record a phone row opens: its address, and what a plain tap does.
  const phoneTarget = (row: Row) => {
    const href = opensTo
      ? navigation
        ? navigation.navigator.createHref(opensTo.to(row.original))
        : opensTo.to(row.original)
      : undefined
    const onOpen = openRow
      ? () => openRow(row.original)
      : detailPanel
        ? () => setSelection({ key: row.id, rowId: row.id })
        : undefined
    return { href, onOpen }
  }
  const phoneList = (items: readonly Row[]) => (
    <ul role="list" className={PHONE_LIST_CLASS}>
      {items.map((row) => (
        <PhoneRow
          key={row.id}
          row={row.original}
          phoneRow={phoneRow as DataTablePhoneRow<TData>}
          highlighted={Boolean(highlightRow?.(row.original))}
          actions={rowActions ? <RowActions actions={rowActions(row.original)} /> : undefined}
          {...phoneTarget(row)}
        />
      ))}
    </ul>
  )

  const viewAllTotal = viewAll?.total ?? total
  // The row list a phone gets has no columns to pick.
  const showColumnsMenu = Boolean(columnsMenu) && !showPhoneRows

  // The pieces, placed as `look` says: plain, or a framed card.
  const framed = look === 'framed'
  const viewPills = (
    <>
      {viewEntries.length > 0 ? (
        <ViewPills
          label={viewsLabel}
          views={viewEntries.map(([id, view]) => ({ id, label: view.label ?? id }))}
          value={activeView}
          onValueChange={(id) => {
            const view = views?.[id]
            if (view) onViewChange?.(view, id)
          }}
        />
      ) : null}
    </>
  )

  const foldAllButton = activeGrouping ? (
    <Button variant="ghost" size="sm" data-slot="data-table-fold-all" disabled={!runs?.length} onClick={foldAll}>
      {allFolded ? 'Unfold All' : 'Fold All'}
    </Button>
  ) : null
  const columnsItems = showColumnsMenu
    ? {
        columns: menuColumns,
        visible: shownColumns ?? leafIds,
        fixed: fixedColumns,
        pick: columnsPick,
        onPickChange: setColumnsPick,
        setByView: viewColumns !== undefined,
      }
    : undefined
  const layoutSwitch = layouts?.length ? (
    <LayoutSwitch
      options={[
        { id: 'table', label: tableLayout?.label ?? 'Table', icon: tableLayout?.icon ?? TableIcon },
        ...layouts,
      ]}
      value={currentLayout}
      onValueChange={setLayout}
    />
  ) : null
  const hasTools = Boolean(layouts?.length || groupings?.length || showColumnsMenu)

  // `plain`: the toolbar, then the Columns and Group menus as buttons.
  const plainToolbar = hasTools ? (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
      {/* A basis, so on a phone the toolbar takes its own line and the
          menus wrap under it rather than squeezing it to its content. */}
      <div className="min-w-0 flex-1 basis-72">{toolbar}</div>
      {columnsItems ? <ColumnsMenu label={columnsMenu?.label} {...columnsItems} /> : null}
      {groupings?.length ? (
        <div className="flex items-center gap-2">
          {foldAllButton}
          <GroupMenu groupings={groupings} value={activeGrouping?.id ?? ''} onValueChange={setGrouping} />
        </div>
      ) : null}
      {layoutSwitch}
    </div>
  ) : (
    toolbar
  )

  // `framed`: the card's top bar, one settings button in place of the two
  // menus. Left out when there's nothing to put in it.
  const framedToolbar =
    toolbar || hasTools ? (
      <div data-slot="data-table-top-bar" className={cn(FRAME_BAR_CLASS, 'border-b border-border')}>
        {/* On a phone the settings button stays on the search's line. */}
        <div className="min-w-0 flex-1 basis-72 max-md:basis-0">{toolbar}</div>
        {hasTools ? (
          <div className="flex items-center gap-2">
            {foldAllButton}
            {columnsItems || groupings?.length ? (
              <TableSettingsMenu
                columns={columnsItems}
                grouping={
                  groupings?.length
                    ? { groupings, value: activeGrouping?.id ?? '', onValueChange: setGrouping }
                    : undefined
                }
                changed={Boolean(columnsItems && (columnsPick || viewColumns !== undefined))}
              />
            ) : null}
            {layoutSwitch}
          </div>
        ) : null}
      </div>
    ) : null

  // Loading, empty or failed: in place of the rows.
  const stateView = error ? (
    <ErrorState error={error} onRetry={onRetry} />
  ) : isLoading || isPastLastPage ? (
    cardLayout ? (
      <CardsSkeleton layout={cardLayout} />
    ) : showPhoneRows ? (
      <PhoneRowsSkeleton />
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
  ) : null

  const detailAside = !isSuccessView
    ? null
    : (
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
      )

  const rowsView = (
    <>
          {cardLayout ? (
            <Cards
              layout={cardLayout}
              runs={runs}
              rows={rows}
              folded={folded}
              onToggleFold={toggleFold}
              groupSummary={groupSummary}
              groupIcons={groupIcons}
              onCardClick={onCardClick}
            />
          ) : showPhoneRows ? (
            <div data-state="success" data-slot="data-table-phone-rows" className="flex flex-col gap-4">
              {runs
                ? runs.map((run, runIndex) => {
                    const isFolded = folded.has(run.key)
                    return (
                      <section
                        key={`${runIndex}:${run.key}`}
                        data-slot="table-group"
                        data-folded={isFolded || undefined}
                        className="flex flex-col gap-2"
                      >
                        <h2 data-slot="table-group-heading" className="flex items-baseline gap-2 px-1">
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
                        </h2>
                        {!isFolded && phoneList(run.rows)}
                      </section>
                    )
                  })
                : phoneList(rows)}
            </div>
          ) : (
            <Table
              data-state="success"
              containerRef={containerRef}
              onKeyDown={rowsOpen ? onListKeyDown : undefined}
              className={cn(stickyGroups && STICKY_FOCUS_CLASS)}
              containerStyle={
                stickyGroups
                  ? ({
                      '--data-table-head-height': `${headHeight}px`,
                      '--data-table-sticky-top': stickyTop,
                      '--data-table-pin-top': scrollsSideways ? '0px' : stickyTop,
                    } as CSSProperties)
                  : undefined
              }
              // With the sticky bar below as the visible scrollbar, hide the
              // container's own. It stays overflow-x-auto and fully
              // scrollable (wheel, trackpad, drag, and the sync effect); it
              // just no longer draws a bar directly under the last row.
              containerClassName={cn(
                // A size container has no width of its own to give, so
                // `width="content"` couldn't fit the table: there the
                // pinned column's `cqw` measures the table's area
                // (`@container/data-table`) instead.
                pinFirstColumn && width !== 'content' && '@container',
                pinFirstColumn && '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                stickyGroups && (scrollsSideways ? STICKY_OWN_SCROLL_CLASS : STICKY_PAGE_SCROLL_CLASS),
              )}
            >
              <TableHeader className={cn((!showHeader || stickyGroups) && '[&_tr]:border-0')}>
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
                            pinLast &&
                              index === headerGroup.headers.length - 1 &&
                              PINNED_LAST_COLUMN_CLASS,
                            stickyGroups && showHeader && STICKY_HEAD_CELL_CLASS,
                            showHeader && HEAD_CELL_CLASS,
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
                      className={cn(!striped && UNSTRIPED_BODY_CLASS)}
                    >
                      {/* The row's own has-aria-expanded tint (table.tsx) would
                          fill every open heading: it's never a row to pick. */}
                      <TableRow
                        data-slot="table-group-heading"
                        className={cn(
                          'hover:bg-transparent has-aria-expanded:bg-transparent',
                          stickyGroups && 'border-b-0',
                        )}
                      >
                        <TableHead
                          scope="rowgroup"
                          colSpan={visibleColumnCount}
                          className={cn(GROUP_HEADING_CLASS, stickyGroups && STICKY_GROUP_HEADING_CLASS)}
                        >
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
                <TableBody className={cn(!striped && UNSTRIPED_BODY_CLASS)}>{rows.map((row) => renderRow(row))}</TableBody>
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
                        pinLast && index === visibleColumnCount - 1 && PINNED_LAST_COLUMN_CLASS,
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

          {pinFirstColumn && isOverflowing && !cardLayout && !showPhoneRows && (
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

          {viewAll && limit !== undefined && viewAllTotal > rows.length ? (
            <ViewAllLink viewAll={viewAll} total={viewAllTotal} navigator={navigation?.navigator} />
          ) : null}
    </>
  )

  const pagination =
    limit === undefined ? (
          <div
            className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-2', framed && [FRAME_BAR_CLASS, 'border-t border-border py-2'])}
            data-slot="data-table-pagination"
          >
            <p className="type-body text-muted-foreground">
              {total === 0 ? 0 : (page - 1) * pageSize + 1}
              {'–'}
              {Math.min(page * pageSize, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              {pageSizes && pageSizes.length > 1 && onPageSizeChange ? (
                <PageSizeMenu pageSizes={pageSizes} value={pageSize} onValueChange={onPageSizeChange} />
              ) : null}
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Previous Page"
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
                aria-label="Next Page"
                disabled={page >= pageCount}
                onClick={() => onPageChange(page + 1)}
              >
                <ChevronRightIcon />
              </Button>
            </div>
          </div>
    ) : null

  // `width="content"`'s last width, kept while another state shows.
  const lastWidthStyle =
    fitsColumns && !isSuccessView && lastWidth !== null
      ? ({ '--data-table-last-width': `${lastWidth}px` } as CSSProperties)
      : undefined

  // C3: with a header, the header, views and card are one box as wide as
  // the table (the box fits its content, the card fills the box), so the
  // header ends where the card does. CSS only: nothing is measured.
  const sharedWidth = Boolean(pageHeader) && fitsColumns
  const content = framed ? (
    <div
      ref={root}
      className={cn('flex flex-col gap-4', sharedWidth && CONTENT_WIDTH_CLASS)}
      data-width={width}
      data-look="framed"
      data-shared-width={sharedWidth ? '' : undefined}
      data-layout={layouts?.length ? currentLayout : undefined}
    >
      {pageHeader}
      {viewPills}
      <DetailFrame enabled={Boolean(detailPanel) && !cardLayout} aside={detailAside}>
        {/* The card: the tools, the rows and the pager as one box, as wide
            as `width` makes the table, so the tools end at its edge. */}
        <div
          ref={body}
          data-slot="data-table-frame"
          className={cn(FRAME_CLASS, fitsColumns && !sharedWidth && CONTENT_WIDTH_CLASS)}
          style={lastWidthStyle}
        >
          {framedToolbar}
          <div
            data-slot="data-table-body"
            className={cn(
              'flex flex-col gap-4',
              (stateView || cardLayout) && 'p-3',
              showPhoneRows && !stateView && FRAMED_PHONE_ROWS_CLASS,
            )}
          >
            {stateView ?? rowsView}
          </div>
          {stateView ? null : pagination}
        </div>
      </DetailFrame>
    </div>
  ) : (
    <div
      ref={root}
      className="flex flex-col gap-4"
      data-width={width}
      data-layout={layouts?.length ? currentLayout : undefined}
    >
      {pageHeader}
      {viewPills}
      {plainToolbar}

      {/* The table, its states and its pagination: what `width="content"`
          fits to the columns, the toolbar above keeping the whole width. */}
      <div
        ref={body}
        data-slot="data-table-body"
        className={cn('flex flex-col gap-4', fitsColumns && CONTENT_WIDTH_CLASS)}
        style={lastWidthStyle}
      >
        {stateView ?? (
          <DetailFrame enabled={Boolean(detailPanel) && !cardLayout} aside={detailAside}>
            {rowsView}
            {pagination}
          </DetailFrame>
        )}
      </div>
    </div>
  )

  return (
    <EditInPlaceContext.Provider value={store}>
      <RowActionsContext.Provider value={rowActions as ((row: never) => readonly DataTableRowAction[]) | undefined}>
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
      </RowActionsContext.Provider>
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
  onCardClick,
}: {
  layout: DataTableCardLayout<TData>
  runs: (GroupRun<CardRow<TData>> & { foldable: boolean })[] | null
  rows: readonly CardRow<TData>[]
  folded: ReadonlySet<string>
  onToggleFold: (key: string) => void
  groupSummary?: (rows: TData[], group: RowGroup) => ReactNode
  groupIcons?: ReadonlyMap<string, ReactNode>
  onCardClick: (event: React.MouseEvent<HTMLElement>, row: TData) => void
}) {
  const list = (items: readonly CardRow<TData>[]) => (
    <ul
      role="list"
      className={cn(
        layout.arrange === 'list' ? CARD_LIST_CLASS : ['grid', CARD_GRID_CLASS[layout.size ?? 'md'], CARD_GRID_GAP_CLASS],
      )}
    >
      {items.map((row) => (
        <li
          key={row.id}
          data-slot="data-table-card"
          className="min-w-0 *:data-[slot=card]:glow-edge"
          // In the capture phase, so the card's own link sees it prevented.
          onClickCapture={(event) => onCardClick(event, row.original)}
        >
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
