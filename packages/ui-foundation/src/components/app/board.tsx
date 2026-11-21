// A board: a column per value of one choice field (a status, a stage), a
// card per record, and a record moved by moving its card. A second way to
// look at a list, beside its DataTable, never instead of it: filters, sort
// and saved views stay the table's.
//
// - Columns: `columns`, in order, each a `value` with its `label` (a stage
//   circle and a word, say), an optional `count` (the column's total,
//   which may be more than the cards loaded), an `empty` line, and a
//   `footer` ("Showing 100 of 240", a link to the filtered list). A
//   column whose `label` isn't plain text gives its `name` for the Move
//   menu and what a screen reader hears after a move. A column's header
//   may also hold a `description` (a caption under the name), a `note`
//   and an `action` (a +); `lead` outlines the column the list starts in.
// - Cards: every record in `items` whose `getColumn` is one of the
//   columns' values, in `items`' order; a record whose value has no column
//   isn't shown. `renderCard` is the card's content: the title (a link to
//   the record's page) and a few values.
// - Groups: a column with `groups` splits its cards by `getGroup`,
//   each group a heading with its count that folds its cards. A card whose
//   group isn't one of the column's isn't shown.
// - Order: with `ordered`, cards keep `items`' order and a drag
//   within a column (or a group) reorders them, a line showing where the
//   card will land; the menu has Move Up, Move Down and Move to Top. A
//   column with `ordered: false` (a Done column, by date) has none of it.
// - Paging: with `pageSize`, a column or a group shows its first
//   cards, then "Show N More". `pageKey` changing (the filters) folds every
//   one back to its first page.
// - Moving: with `onMove`, a card drags to another column (a pointer) and
//   has a Move button (a menu of `moveTo`, by default the columns: the
//   keyboard and a phone, where there is no drag). `moveTo` may add values
//   with no column, such as Dropped, which take the card off the board.
//   With `menu`, the button is ⋯ ("Actions for <name>") and holds the app's
//   own items too. After a move from the menu the focus goes back to the
//   card's menu button where it now is (to the board, if the card left it),
//   and a status line says where the card went.
//   Without `onMove` the board is read-only: a computed field.
//   `onMove(item, value, place)` is the save: `place` is the card's group
//   and its new neighbours (`beforeId`, `afterId`) on an ordered column.
//   The app makes it optimistic (useRecordUpdate), so placing cards by
//   `getColumn` on the record shows a move at once, and a refusal puts the
//   card back.
// - States: `isLoading` (skeleton columns), `error` (ErrorState with
//   `onRetry`), and an empty board (`emptyTitle`, `emptyDescription`,
//   `emptyAction`), each for the board as a whole; an empty column is not
//   an empty state, only a muted line.
//
// Columns share the width, at least 16rem each, and scroll sideways with
// snap points when they don't fit. A phone shows one column at a time,
// with the edge of the next one showing; `phone="counts"` shows a row of
// the columns' counts instead, below lg, that picks the one column shown.
import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { ArrowRightLeftIcon, ChevronDownIcon, ChevronRightIcon, EllipsisIcon } from 'lucide-react'
import { cn } from 'cn'
import type { AppError } from '@/api/contracts'
import { ErrorState } from '@/components/app/error-state'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import {
  dropPlace,
  endPlace,
  moreCount,
  neighboursOf,
  orderTargets,
  placeNumber,
  shownCount,
  type BoardId,
  type BoardNeighbours,
  type BoardOrderKind,
} from './board-order'

/** A group of a column's cards: a heading that folds them. */
export type BoardGroup<G extends string = string> = {
  /** The value `getGroup` gives this group's cards. */
  value: G
  /** The heading, plain text: shown in small capitals, and heard after a move. */
  label: string
  /** Beside the heading. Omitted: the group's cards on the board are counted. */
  count?: number
  /** Open at first. Default true. */
  defaultOpen?: boolean
  /** The line an empty group shows. Default "Nothing here". */
  empty?: ReactNode
  /** Under the group's cards. */
  footer?: ReactNode
}

/** Where a move put a card: its group, and its new neighbours on an ordered column (both null otherwise). */
export type BoardPlace<G extends string = string> = {
  group?: G
  /** The card it now sits before, among `items` in that column (and group); null at the end. */
  beforeId: BoardId | null
  /** The card it now sits after; null at the start. */
  afterId: BoardId | null
}

export type BoardColumn<V extends string, G extends string = string> = {
  /** The field's value this column holds. */
  value: V
  /** The column's heading: a word, or a glyph and a word. */
  label: ReactNode
  /**
   * The column's name as plain text: its entry in the default Move menu and
   * in what a screen reader hears after a move. Omitted: `label` when it is
   * a string, else `value`.
   */
  name?: string
  /** The column's total, beside its heading. Omitted: the cards on the board are counted. */
  count?: number
  /** The line an empty column shows. Default "Nothing here". */
  empty?: ReactNode
  /** Under the cards: "Showing 100 of 240", a link to the whole list. */
  footer?: ReactNode
  /** The column's groups, in order. Needs the board's `getGroup`. */
  groups?: readonly BoardGroup<G>[]
  /** Default: the board's `ordered`. `false` gives this column no order. */
  ordered?: boolean
  /** A caption under the column's name. */
  description?: ReactNode
  /** A control at the end of the header, a +. */
  action?: ReactNode
  /** Short muted text in the header before the action: "3 need review". */
  note?: ReactNode
  /** The lead column, outlined: where the list starts. */
  lead?: boolean
  /** Its name in the phone's row of counts. Default: its name. */
  shortName?: string
}

/** A value a card can be moved to from its Move menu. */
export type BoardMoveTarget<V extends string> = { value: V; label: string }

export type BoardProps<T, V extends string, G extends string = string> = {
  /** Names the board as a whole ("Tasks by status"). */
  'aria-label': string
  columns: readonly BoardColumn<V, G>[]
  items: readonly T[]
  getId: (item: T) => string | number
  /** The record's value of the field: which column its card is in. */
  getColumn: (item: T) => V
  /** What the Move button calls the record: "Move <name>". */
  getName: (item: T) => string
  renderCard: (item: T) => ReactNode
  /** Saves the record's new value, and its place. Omitted: a read-only board. */
  onMove?: (item: T, value: V, place: BoardPlace<G>) => void
  /** The Move menu's choices. Default: the columns, by their `name`. */
  moveTo?: readonly BoardMoveTarget<V>[]
  /** The columns' heading level: 2 under the page's h1 (the default), deeper under a section. */
  headingLevel?: 2 | 3 | 4 | 5 | 6
  /** Cards keep `items`' order and can be reordered. Only with `onMove`. */
  ordered?: boolean
  /** Which group of its column a card is in, for a column with `groups`. */
  getGroup?: (item: T) => G
  /** Each column, or group, shows this many cards, then "Show N More". */
  pageSize?: number
  /** When it changes, every column and group goes back to its first page. */
  pageKey?: string
  /** The app's own items, after the board's in the card's menu. */
  menu?: (item: T) => ReactNode
  /** Below lg: one column with the next one's edge (`swipe`, the default), or a row of counts that picks it. */
  phone?: 'swipe' | 'counts'
  isLoading?: boolean
  error?: AppError | null
  onRetry?: () => void
  emptyTitle?: ReactNode
  emptyDescription?: ReactNode
  emptyAction?: ReactNode
}

// The drag's data type: a card of this board, and nothing a drop from
// elsewhere (a file, a link) carries.
const DRAG_TYPE = 'application/x-ui-foundation-board-card'

// At least 16rem, sharing the width; on a phone the board's width less 2rem,
// so the next column's edge shows there is more to scroll to.
const COLUMN_WIDTH = 'min-w-[calc(100%-2rem)] flex-1 basis-0 sm:min-w-64'
// The phone's counts row picks one column, the board's whole width below lg.
const COUNTS_COLUMN_WIDTH = 'min-w-0 flex-1 basis-0 lg:min-w-64'

// The drop line (1A): 3px in the text colour, inset 4px, centred in the
// 8px gap above (or below) a card.
const DROP_LINE = 'pointer-events-none absolute inset-x-1 h-[3px] rounded-full bg-foreground'

const columnName = <V extends string, G extends string>(column: BoardColumn<V, G>): string =>
  column.name ?? (typeof column.label === 'string' ? column.label : column.value)

const sameId = (a: BoardId | null, b: BoardId | null) => (a === null || b === null ? a === b : String(a) === String(b))

const zoneKey = (value: string, group?: string) => (group === undefined ? value : `${value}\u0000${group}`)

const ORDER_WORDS: Record<BoardOrderKind, string> = { up: 'up', down: 'down', top: 'to the top' }

// Where in a zone's shown cards a drag's pointer is: before or after the
// card under it (its top or bottom half), or after the last when on none.
function pointerIndex(event: DragEvent<HTMLElement>, shownIds: readonly BoardId[]) {
  const card = (event.target as Element).closest('[data-board-card]')
  const at = card ? shownIds.findIndex((id) => String(id) === card.getAttribute('data-board-card')) : -1
  if (card === null || at < 0) return shownIds.length
  const box = card.getBoundingClientRect()
  return at + (event.clientY > box.top + box.height / 2 ? 1 : 0)
}

type Pending = { id: string; value: string; group?: string; neighbours?: BoardNeighbours }

export function Board<T, V extends string, G extends string = string>({
  'aria-label': ariaLabel,
  columns,
  items,
  getId,
  getColumn,
  getName,
  renderCard,
  onMove,
  moveTo,
  headingLevel = 2,
  ordered = false,
  getGroup,
  pageSize,
  pageKey,
  menu,
  phone = 'swipe',
  isLoading = false,
  error = null,
  onRetry,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
}: BoardProps<T, V, G>) {
  const boardRef = useRef<HTMLDivElement>(null)
  const boardId = useId()
  const [announcement, setAnnouncement] = useState('')
  // The card being dragged: the native events come faster than React
  // renders, and dragover can't read the drag's data, so a ref holds it.
  const dragging = useRef<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<{ zone: string; index: number } | null>(null)
  const [pages, setPages] = useState<{ key: string | undefined; open: Record<string, number> }>({ key: pageKey, open: {} })
  const [folded, setFolded] = useState<Record<string, boolean>>({})
  const [phoneColumn, setPhoneColumn] = useState<V | undefined>(undefined)
  // A move from the menu, until its card is where it was sent. A card moved
  // to another column is remounted there, so the button that had the focus
  // is gone: its new one takes the focus, or the board does.
  const moved = useRef<Pending | null>(null)
  useEffect(() => {
    const pending = moved.current
    if (pending === null) return
    const item = items.find((candidate) => String(getId(candidate)) === pending.id)
    if (item !== undefined) {
      if (getColumn(item) !== pending.value) return
      if (pending.group !== undefined && getGroup?.(item) !== pending.group) return
      if (pending.neighbours !== undefined) {
        const ids = items
          .filter((candidate) => getColumn(candidate) === pending.value && (pending.group === undefined || getGroup?.(candidate) === pending.group))
          .map(getId)
        const now = neighboursOf(ids, pending.id)
        if (now === null || !sameId(now.beforeId, pending.neighbours.beforeId) || !sameId(now.afterId, pending.neighbours.afterId)) return
      }
    }
    moved.current = null
    const board = boardRef.current
    if (board === null) return
    const button = Array.from(board.querySelectorAll<HTMLElement>('[data-board-move]')).find(
      (candidate) => candidate.dataset.boardMove === pending.id,
    )
    // Only when the focus was lost with the old button (or is still on it),
    // never taken from wherever the user has gone since.
    const active = document.activeElement
    if (active !== null && active !== document.body && active !== button) return
    ;(button ?? board).focus()
  }, [items, getId, getColumn, getGroup])

  if (error) {
    return (
      <div data-slot="board" data-state="error">
        <ErrorState error={error} onRetry={onRetry} />
      </div>
    )
  }
  if (isLoading) {
    return (
      <div data-slot="board" data-state="loading" role="group" aria-busy="true" aria-label={ariaLabel} className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((column) => (
          <div key={column.value} className={cn('flex flex-col gap-2 rounded-lg bg-muted p-2 [--muted-foreground:var(--table-highlight-muted-foreground)]', COLUMN_WIDTH)}>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    )
  }
  const groupOf = (item: T): G | undefined => getGroup?.(item)
  const inColumn = (item: T, column: BoardColumn<V, G>) =>
    getColumn(item) === column.value && (column.groups === undefined || column.groups.some((group) => group.value === groupOf(item)))
  const shown = items.filter((item) => columns.some((column) => inColumn(item, column)))
  if (shown.length === 0) {
    return (
      <div data-slot="board" data-state="empty">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{emptyTitle}</EmptyTitle>
            {emptyDescription && <EmptyDescription>{emptyDescription}</EmptyDescription>}
          </EmptyHeader>
          {emptyAction && <EmptyContent>{emptyAction}</EmptyContent>}
        </Empty>
      </div>
    )
  }
  const targets = moveTo ?? columns.map((column) => ({ value: column.value, label: columnName(column) }))
  const isOrdered = (column: BoardColumn<V, G> | undefined) => onMove !== undefined && column !== undefined && (column.ordered ?? ordered)
  const zoneItems = (value: V, group?: G) =>
    items.filter((item) => getColumn(item) === value && (group === undefined || groupOf(item) === group))
  const zoneIds = (value: V, group?: G) => zoneItems(value, group).map(getId)
  const pagesOf = (zone: string) => (pages.key === pageKey ? (pages.open[zone] ?? 1) : 1)
  const showMore = (zone: string) =>
    setPages((was) => {
      const open = was.key === pageKey ? was.open : {}
      return { key: pageKey, open: { ...open, [zone]: (open[zone] ?? 1) + 1 } }
    })
  const whereLabel = (value: V, group?: G) => {
    const column = columns.find((candidate) => candidate.value === value)
    const where = targets.find((target) => target.value === value)?.label ?? (column ? columnName(column) : value)
    const groupLabel = group === undefined ? undefined : column?.groups?.find((candidate) => candidate.value === group)?.label
    return groupLabel === undefined ? where : `${where}, ${groupLabel}`
  }
  const save = (item: T, value: V, place: BoardPlace<G>, message: string, pending?: Pending) => {
    setAnnouncement(message)
    if (pending) moved.current = pending
    onMove?.(item, value, place)
  }
  const find = (id: string) => items.find((candidate) => String(getId(candidate)) === id)

  // The Move To menu: to the end of the column (the card's own group, when
  // it's one of the column's), or off the board.
  const moveToValue = (id: string, value: V) => {
    const item = find(id)
    if (onMove === undefined || item === undefined || getColumn(item) === value) return
    const column = columns.find((candidate) => candidate.value === value)
    const own = groupOf(item)
    const group = column?.groups?.some((candidate) => candidate.value === own) ? own : undefined
    const place: BoardPlace<G> =
      isOrdered(column) && (column?.groups === undefined || group !== undefined)
        ? { group, ...endPlace(zoneIds(value, group), id) }
        : { group, beforeId: null, afterId: null }
    save(item, value, place, `Moved ${getName(item)} to ${whereLabel(value, group)}`, { id, value, group })
  }
  // The menu's Order items, within the card's own zone.
  const orderCard = (item: T, kind: BoardOrderKind) => {
    const value = getColumn(item)
    const column = columns.find((candidate) => candidate.value === value)
    const group = column?.groups ? groupOf(item) : undefined
    const id = String(getId(item))
    const target = orderTargets(zoneIds(value, group), id)[kind]
    if (target === undefined) return
    save(item, value, { group, ...target }, `Moved ${getName(item)} ${ORDER_WORDS[kind]}`, { id, value, group, neighbours: target })
  }
  // A drop into a zone at an index of its cards (its end, for a folded group).
  const dropInto = (value: V, group: G | undefined, index: number) => {
    const id = dragging.current
    const item = id === null ? undefined : find(id)
    if (onMove === undefined || id === null || item === undefined) return
    const column = columns.find((candidate) => candidate.value === value)
    const sameZone = getColumn(item) === value && (group === undefined || groupOf(item) === group)
    let place: BoardPlace<G>
    if (isOrdered(column)) {
      const ids = zoneIds(value, group)
      const at = dropPlace(ids, index, id)
      if (at === null) return
      place = { group, ...at }
      if (sameZone) {
        const { k, n } = placeNumber(ids, id, at)
        save(item, value, place, `Moved ${getName(item)} to place ${k} of ${n} in ${column ? columnName(column) : value}`)
        return
      }
    } else {
      if (sameZone) return
      place = { group, beforeId: null, afterId: null }
    }
    save(item, value, place, `Moved ${getName(item)} to ${whereLabel(value, group)}`)
  }
  const endDrag = () => {
    dragging.current = null
    setDragId(null)
    setOver(null)
  }
  const accepts = (event: DragEvent) => onMove !== undefined && event.dataTransfer.types.includes(DRAG_TYPE)
  // The drag-over and drop handlers of an ordered zone (a column, or a
  // group): the line follows the pointer; a folded group drops at its end.
  const zoneHandlers = (zone: string, value: V, group: G | undefined, shownIds: readonly BoardId[], foldedTo?: number) => ({
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (!accepts(event)) return
      event.preventDefault()
      event.stopPropagation()
      event.dataTransfer.dropEffect = 'move'
      const index = foldedTo ?? pointerIndex(event, shownIds)
      if (over?.zone !== zone || over.index !== index) setOver({ zone, index })
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver((was) => (was?.zone === zone ? null : was))
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      if (!accepts(event)) return
      event.preventDefault()
      event.stopPropagation()
      dropInto(value, group, foldedTo ?? pointerIndex(event, shownIds))
      endDrag()
    },
  })

  const anyAction = columns.some((column) => column.action !== undefined)
  const counts = phone === 'counts'
  const chosen = phoneColumn ?? columns[0]?.value
  const columnId = (value: V) => `${boardId}-column-${value}`

  // One card. On an ordered column it sits in a slot that holds the drop
  // line (the card itself clips what overflows it).
  const cardView = (item: T, column: BoardColumn<V, G>, zone: string, index: number, shownLength: number) => {
    const id = String(getId(item))
    const ordering = isOrdered(column)
    const value = getColumn(item)
    const group = column.groups ? groupOf(item) : undefined
    const order = ordering ? orderTargets(zoneIds(value, group), id) : undefined
    const card = (
      <Card
        key={getId(item)}
        size="sm"
        data-slot="board-card"
        data-board-card={ordering ? id : undefined}
        draggable={onMove ? true : undefined}
        onDragStart={
          onMove
            ? (event) => {
                // Picked up by its title link or anywhere else: the whole
                // card is what's dragged, not the link's text.
                const box = event.currentTarget.getBoundingClientRect()
                event.dataTransfer.setDragImage(event.currentTarget, event.clientX - box.left, event.clientY - box.top)
                event.dataTransfer.setData(DRAG_TYPE, id)
                event.dataTransfer.effectAllowed = 'move'
                dragging.current = id
                setDragId(id)
              }
            : undefined
        }
        onDragEnd={onMove ? endDrag : undefined}
        className={cn('glow-edge gap-2 px-3 py-3', onMove && 'cursor-grab active:cursor-grabbing', ordering && dragId === id && 'opacity-50')}
      >
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-2">{renderCard(item)}</div>
          {onMove && (
            <CardMenu
              id={id}
              name={getName(item)}
              value={value}
              targets={targets}
              onMove={(next) => moveToValue(id, next)}
              order={
                order && {
                  allowed: { up: order.up !== undefined, down: order.down !== undefined, top: order.top !== undefined },
                  run: (kind) => orderCard(item, kind),
                }
              }
              extra={menu?.(item)}
            />
          )}
        </div>
      </Card>
    )
    if (!ordering) return card
    const line = over?.zone === zone ? (over.index === index ? 'before' : over.index >= shownLength && index === shownLength - 1 ? 'after' : null) : null
    return (
      <div key={getId(item)} data-slot="board-card-slot" className="relative">
        {line && <span aria-hidden="true" data-slot="board-drop-line" className={cn(DROP_LINE, line === 'before' ? '-top-[5.5px]' : '-bottom-[5.5px]')} />}
        {card}
      </div>
    )
  }

  // A zone's cards: its first page, "Show N More", or its empty line.
  const zoneCards = (column: BoardColumn<V, G>, zone: string, cards: readonly T[], empty: ReactNode) => {
    const page = pagesOf(zone)
    const visible = cards.slice(0, shownCount(cards.length, pageSize, page))
    const more = moreCount(cards.length, pageSize, page)
    const lineInEmpty = isOrdered(column) && cards.length === 0 && over?.zone === zone
    return (
      <>
        {visible.map((item, index) => cardView(item, column, zone, index, visible.length))}
        {more > 0 && (
          <Button variant="ghost" size="sm" className="self-start" onClick={() => showMore(zone)}>
            Show {more} More
          </Button>
        )}
        {cards.length === 0 && (
          <p className={cn('px-1 py-6 text-center type-caption text-muted-foreground', lineInEmpty && 'relative')}>
            {empty ?? 'Nothing here'}
            {lineInEmpty && <span aria-hidden="true" data-slot="board-drop-line" className={cn(DROP_LINE, 'top-0')} />}
          </p>
        )}
      </>
    )
  }

  // A drop on a column with no order: only a change of column.
  const moveToValueByDrag = (id: string, value: V) => {
    dragging.current = id
    dropInto(value, undefined, 0)
    endDrag()
  }

  const columnsView = columns.map((column) => {
    const ordering = isOrdered(column)
    const headingId = `${columnId(column.value)}-heading`
    let body: ReactNode
    let count: number
    let handlers: ReturnType<typeof zoneHandlers> | undefined
    if (column.groups) {
      const groups = column.groups.map((group) => ({ group, cards: zoneItems(column.value, group.value) }))
      count = column.count ?? groups.reduce((sum, { cards }) => sum + cards.length, 0)
      const GroupHeading = `h${Math.min(headingLevel + 1, 6)}` as 'h3'
      body = groups.map(({ group, cards }) => {
        const zone = zoneKey(column.value, group.value)
        const open = !(folded[zone] ?? group.defaultOpen === false)
        const visible = cards.slice(0, shownCount(cards.length, pageSize, pagesOf(zone))).map(getId)
        const groupId = `${columnId(column.value)}-group-${group.value}`
        const dropHere =
          onMove === undefined
            ? undefined
            : ordering
              ? zoneHandlers(zone, column.value, group.value, open ? visible : [], open ? undefined : cards.length)
              : zoneHandlers(zone, column.value, group.value, [], 0)
        const overFolded = !open && over?.zone === zone
        return (
          <div key={group.value} role="group" aria-labelledby={`${groupId}-heading`} data-slot="board-group" className="flex flex-col gap-2" {...dropHere}>
            <GroupHeading id={`${groupId}-heading`} className="m-0">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={groupId}
                onClick={() => setFolded((was) => ({ ...was, [zone]: open }))}
                className={cn(
                  'flex min-h-9 w-full items-center gap-1.5 rounded-md px-1 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
                  overFolded && 'ring-2 ring-foreground',
                )}
              >
                {open ? <ChevronDownIcon aria-hidden="true" className="size-4" /> : <ChevronRightIcon aria-hidden="true" className="size-4" />}
                {group.label} <span className="font-normal tracking-normal tabular-nums">{group.count ?? cards.length}</span>
              </button>
            </GroupHeading>
            <div id={groupId} hidden={!open} className="flex flex-col gap-2">
              {open && zoneCards(column, zone, cards, group.empty)}
              {open && group.footer && <div className="px-1 type-caption text-muted-foreground">{group.footer}</div>}
            </div>
          </div>
        )
      })
    } else {
      const zone = zoneKey(column.value)
      const cards = shown.filter((item) => getColumn(item) === column.value)
      count = column.count ?? cards.length
      const visible = cards.slice(0, shownCount(cards.length, pageSize, pagesOf(zone))).map(getId)
      if (ordering) handlers = zoneHandlers(zone, column.value, undefined, visible)
      body = zoneCards(column, zone, cards, column.empty)
    }
    return (
      <BoardColumnView
        key={column.value}
        id={counts ? columnId(column.value) : undefined}
        headingId={counts || column.groups ? headingId : undefined}
        column={column}
        count={count}
        headingLevel={headingLevel}
        actionSpace={anyAction}
        className={counts ? cn(COUNTS_COLUMN_WIDTH, chosen !== column.value && 'hidden lg:flex') : COLUMN_WIDTH}
        handlers={handlers}
        onDrop={onMove && !ordering && !column.groups ? (id) => moveToValueByDrag(id, column.value) : undefined}
      >
        {body}
        {column.footer && <div className="px-1 type-caption text-muted-foreground">{column.footer}</div>}
      </BoardColumnView>
    )
  })

  const board = (
    <div
      ref={boardRef}
      data-slot="board"
      data-state="success"
      role="group"
      aria-label={ariaLabel}
      tabIndex={-1}
      className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 outline-none"
    >
      {columnsView}
      <span role="status" className="sr-only">
        {announcement}
      </span>
    </div>
  )
  if (!counts) return board
  return (
    <div data-slot="board-frame" className="flex min-w-0 flex-col gap-3">
      <div
        role="group"
        aria-label={`${ariaLabel}: columns`}
        data-slot="board-counts"
        className="grid gap-1 lg:hidden"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        {columns.map((column) => {
          const total =
            column.count ??
            (column.groups ? items.filter((item) => inColumn(item, column)).length : items.filter((item) => getColumn(item) === column.value).length)
          return (
            <button
              key={column.value}
              type="button"
              aria-pressed={chosen === column.value}
              aria-controls={columnId(column.value)}
              onClick={() => setPhoneColumn(column.value)}
              className={cn(
                'flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-0.5 py-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                chosen === column.value ? 'border-primary bg-primary/10 text-foreground' : 'border-transparent bg-muted/50 text-muted-foreground',
              )}
            >
              <span className="text-base font-semibold tabular-nums">{total}</span>{' '}
              <span className="max-w-full truncate text-[0.6875rem] font-medium">{column.shortName ?? columnName(column)}</span>
            </button>
          )
        })}
      </div>
      {board}
    </div>
  )
}

function BoardColumnView<V extends string, G extends string>({
  id,
  headingId: givenHeadingId,
  column,
  count,
  headingLevel,
  actionSpace,
  className,
  handlers,
  onDrop,
  children,
}: {
  id?: string
  headingId?: string
  column: BoardColumn<V, G>
  count: number
  headingLevel: 2 | 3 | 4 | 5 | 6
  actionSpace: boolean
  className: string
  handlers?: {
    onDragOver: (event: DragEvent<HTMLElement>) => void
    onDragLeave: (event: DragEvent<HTMLElement>) => void
    onDrop: (event: DragEvent<HTMLElement>) => void
  }
  onDrop?: (id: string) => void
  children: ReactNode
}) {
  const [over, setOver] = useState(false)
  const ownHeadingId = useId()
  const headingId = givenHeadingId ?? ownHeadingId
  const Heading = `h${headingLevel}` as const
  const accepts = (event: DragEvent) => onDrop !== undefined && event.dataTransfer.types.includes(DRAG_TYPE)
  const slotted = column.note !== undefined || column.action !== undefined || actionSpace || column.description !== undefined
  const heading = (
    <Heading id={headingId} className={slotted ? 'flex items-center gap-2 type-label' : 'flex items-center gap-2 px-1 pt-0.5 type-label'}>
      {column.label}
      <span className="font-normal tabular-nums text-muted-foreground">{count}</span>
    </Heading>
  )
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      data-slot="board-column"
      data-over={over || undefined}
      className={cn(
        column.lead
          ? 'flex snap-start flex-col gap-2 rounded-lg border-2 border-foreground bg-background p-2 outline-2 outline-offset-2 outline-transparent data-over:outline-ring'
          : 'flex snap-start flex-col gap-2 rounded-lg bg-muted p-2 [--muted-foreground:var(--table-highlight-muted-foreground)] outline-2 outline-offset-2 outline-transparent data-over:outline-ring',
        className,
      )}
      {...(handlers ?? {
        onDragOver: (event: DragEvent<HTMLElement>) => {
          if (!accepts(event)) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
          setOver(true)
        },
        onDragLeave: (event: DragEvent<HTMLElement>) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false)
        },
        onDrop: (event: DragEvent<HTMLElement>) => {
          setOver(false)
          if (!accepts(event)) return
          event.preventDefault()
          onDrop?.(event.dataTransfer.getData(DRAG_TYPE))
        },
      })}
    >
      {slotted ? (
        <div className="flex flex-col gap-0.5 px-1 pt-0.5">
          <div className="flex min-h-9 items-center gap-2">
            {heading}
            <span aria-hidden="true" className="flex-1" />
            {column.note !== undefined && <span className="type-caption text-muted-foreground">{column.note}</span>}
            {column.action ?? (actionSpace && <span aria-hidden="true" className="size-9 shrink-0" />)}
          </div>
          {column.description !== undefined && <p className="type-caption text-muted-foreground">{column.description}</p>}
        </div>
      ) : (
        heading
      )}
      {children}
    </section>
  )
}

function CardMenu<V extends string>({
  id,
  name,
  value,
  targets,
  onMove,
  order,
  extra,
}: {
  id: string
  name: string
  value: V
  targets: readonly BoardMoveTarget<V>[]
  onMove: (value: V) => void
  order?: { allowed: Record<BoardOrderKind, boolean>; run: (kind: BoardOrderKind) => void }
  extra?: ReactNode
}) {
  const actions = extra !== undefined && extra !== null && extra !== false
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          actions ? (
            <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${name}`} title="Actions" data-board-move={id} />
          ) : (
            <Button variant="ghost" size="icon-xs" aria-label={`Move ${name}`} title="Move To…" data-board-move={id} />
          )
        }
      >
        {actions ? <EllipsisIcon aria-hidden="true" /> : <ArrowRightLeftIcon aria-hidden="true" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Move To</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={value} onValueChange={(next) => onMove(next as V)}>
            {targets.map((target) => (
              // Choosing closes the menu: a move is done, not a setting to
              // try several of.
              <DropdownMenuRadioItem key={target.value} value={target.value} closeOnClick>
                {target.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        {order && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Order</DropdownMenuLabel>
              <DropdownMenuItem disabled={!order.allowed.up} onClick={() => order.run('up')}>
                Move Up
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!order.allowed.down} onClick={() => order.run('down')}>
                Move Down
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!order.allowed.top} onClick={() => order.run('top')}>
                Move to Top
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
        {actions && (
          <>
            <DropdownMenuSeparator />
            {extra}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
