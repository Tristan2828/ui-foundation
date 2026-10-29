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
//   menu and what a screen reader hears after a move.
// - Cards: every record in `items` whose `getColumn` is one of the
//   columns' values, in `items`' order; a record whose value has no column
//   isn't shown. `renderCard` is the card's content: the title (a link to
//   the record's page) and a few values.
// - Moving: with `onMove`, a card drags to another column (a pointer) and
//   has a Move button (a menu of `moveTo`, by default the columns: the
//   keyboard and a phone, where there is no drag). `moveTo` may add values
//   with no column, such as Dropped, which take the card off the board.
//   After a move from the menu the focus goes back to the card's Move
//   button in its new column (to the board, if the card left it), and a
//   status line says where the card went.
//   Without `onMove` the board is read-only: a computed field.
//   `onMove(item, value)` is the save; the app makes it optimistic
//   (useRecordUpdate), so placing cards by `getColumn` on the record shows
//   a move at once, and a refusal puts the card back.
// - States: `isLoading` (skeleton columns), `error` (ErrorState with
//   `onRetry`), and an empty board (`emptyTitle`, `emptyDescription`,
//   `emptyAction`), each for the board as a whole; an empty column is not
//   an empty state, only a muted line.
//
// Columns share the width, at least 16rem each, and scroll sideways with
// snap points when they don't fit. A phone shows one column at a time,
// with the edge of the next one showing.
import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { ArrowRightLeftIcon } from 'lucide-react'
import { cn } from 'cn'
import type { AppError } from '@/api/contracts'
import { ErrorState } from '@/components/app/error-state'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'

export type BoardColumn<V extends string> = {
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
}

/** A value a card can be moved to from its Move menu. */
export type BoardMoveTarget<V extends string> = { value: V; label: string }

export type BoardProps<T, V extends string> = {
  /** Names the board as a whole ("Tasks by status"). */
  'aria-label': string
  columns: readonly BoardColumn<V>[]
  items: readonly T[]
  getId: (item: T) => string | number
  /** The record's value of the field: which column its card is in. */
  getColumn: (item: T) => V
  /** What the Move button calls the record: "Move <name>". */
  getName: (item: T) => string
  renderCard: (item: T) => ReactNode
  /** Saves the record's new value. Omitted: a read-only board. */
  onMove?: (item: T, value: V) => void
  /** The Move menu's choices. Default: the columns, by their `name`. */
  moveTo?: readonly BoardMoveTarget<V>[]
  /** The columns' heading level: 2 under the page's h1 (the default), deeper under a section. */
  headingLevel?: 2 | 3 | 4 | 5 | 6
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

const columnName = <V extends string>(column: BoardColumn<V>): string =>
  column.name ?? (typeof column.label === 'string' ? column.label : column.value)

export function Board<T, V extends string>({
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
  isLoading = false,
  error = null,
  onRetry,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
}: BoardProps<T, V>) {
  const boardRef = useRef<HTMLDivElement>(null)
  const [announcement, setAnnouncement] = useState('')
  // A move from the Move menu, until its card is in its new column or off
  // the board. The card is remounted there, so the Move button that had
  // the focus is gone: its new one takes the focus, or the board does.
  const moved = useRef<{ id: string; value: V } | null>(null)
  useEffect(() => {
    const pending = moved.current
    if (pending === null) return
    const item = items.find((candidate) => String(getId(candidate)) === pending.id)
    if (item !== undefined && getColumn(item) !== pending.value) return
    moved.current = null
    const board = boardRef.current
    // Only when the focus was lost with the old button, never taken from
    // wherever the user has gone since.
    if (board === null || (document.activeElement !== null && document.activeElement !== document.body)) return
    const button = Array.from(board.querySelectorAll<HTMLElement>('[data-board-move]')).find(
      (candidate) => candidate.dataset.boardMove === pending.id,
    )
    ;(button ?? board).focus()
  }, [items, getId, getColumn])

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
          <div key={column.value} className={cn('flex flex-col gap-2 rounded-lg bg-muted p-2', COLUMN_WIDTH)}>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    )
  }
  const shown = items.filter((item) => columns.some((column) => column.value === getColumn(item)))
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
  const move = (id: string, value: V, from: 'drag' | 'menu') => {
    const item = items.find((candidate) => String(getId(candidate)) === id)
    if (onMove === undefined || item === undefined || getColumn(item) === value) return
    const column = columns.find((candidate) => candidate.value === value)
    const where = targets.find((target) => target.value === value)?.label ?? (column ? columnName(column) : value)
    setAnnouncement(`Moved ${getName(item)} to ${where}`)
    if (from === 'menu') moved.current = { id, value }
    onMove(item, value)
  }
  return (
    <div
      ref={boardRef}
      data-slot="board"
      data-state="success"
      role="group"
      aria-label={ariaLabel}
      tabIndex={-1}
      className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 outline-none"
    >
      {columns.map((column) => {
        const cards = shown.filter((item) => getColumn(item) === column.value)
        return (
          <BoardColumnView
            key={column.value}
            column={column}
            count={column.count ?? cards.length}
            headingLevel={headingLevel}
            onDrop={onMove ? (id) => move(id, column.value, 'drag') : undefined}
          >
            {cards.map((item) => (
              <Card
                key={getId(item)}
                size="sm"
                data-slot="board-card"
                draggable={onMove ? true : undefined}
                onDragStart={
                  onMove
                    ? (event) => {
                        event.dataTransfer.setData(DRAG_TYPE, String(getId(item)))
                        event.dataTransfer.effectAllowed = 'move'
                      }
                    : undefined
                }
                className={cn('gap-2 px-3 py-3', onMove && 'cursor-grab active:cursor-grabbing')}
              >
                <div className="flex items-start gap-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-2">{renderCard(item)}</div>
                  {onMove && (
                    <MoveMenu
                      id={String(getId(item))}
                      name={getName(item)}
                      value={getColumn(item)}
                      targets={targets}
                      onMove={(value) => move(String(getId(item)), value, 'menu')}
                    />
                  )}
                </div>
              </Card>
            ))}
            {cards.length === 0 && (
              <p className="px-1 py-6 text-center type-caption text-muted-foreground">{column.empty ?? 'Nothing here'}</p>
            )}
            {column.footer && <div className="px-1 type-caption text-muted-foreground">{column.footer}</div>}
          </BoardColumnView>
        )
      })}
      <span role="status" className="sr-only">
        {announcement}
      </span>
    </div>
  )
}

function BoardColumnView<V extends string>({
  column,
  count,
  headingLevel,
  onDrop,
  children,
}: {
  column: BoardColumn<V>
  count: number
  headingLevel: 2 | 3 | 4 | 5 | 6
  onDrop?: (id: string) => void
  children: ReactNode
}) {
  const [over, setOver] = useState(false)
  const headingId = useId()
  const Heading = `h${headingLevel}` as const
  const accepts = (event: DragEvent) => onDrop !== undefined && event.dataTransfer.types.includes(DRAG_TYPE)
  return (
    <section
      aria-labelledby={headingId}
      data-slot="board-column"
      data-over={over || undefined}
      className={cn(
        'flex snap-start flex-col gap-2 rounded-lg bg-muted p-2 outline-2 outline-offset-2 outline-transparent data-over:outline-ring',
        COLUMN_WIDTH,
      )}
      onDragOver={(event) => {
        if (!accepts(event)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setOver(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false)
      }}
      onDrop={(event) => {
        setOver(false)
        if (!accepts(event)) return
        event.preventDefault()
        onDrop?.(event.dataTransfer.getData(DRAG_TYPE))
      }}
    >
      <Heading id={headingId} className="flex items-center gap-2 px-1 pt-0.5 type-label">
        {column.label}
        <span className="font-normal tabular-nums text-muted-foreground">{count}</span>
      </Heading>
      {children}
    </section>
  )
}

function MoveMenu<V extends string>({
  id,
  name,
  value,
  targets,
  onMove,
}: {
  id: string
  name: string
  value: V
  targets: readonly BoardMoveTarget<V>[]
  onMove: (value: V) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-xs" aria-label={`Move ${name}`} title="Move to…" data-board-move={id} />}
      >
        <ArrowRightLeftIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Move to</DropdownMenuLabel>
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
