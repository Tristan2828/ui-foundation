// A board: a column per value of one choice field (a status, a stage), a
// card per record, and a record moved by moving its card. A second way to
// look at a list, beside its DataTable, never instead of it: filters, sort
// and saved views stay the table's.
//
// - Columns: `columns`, in order, each a `value` with its `label` (a stage
//   circle and a word, say), an optional `count` (the column's total,
//   which may be more than the cards loaded), an `empty` line, and a
//   `footer` ("Showing 100 of 240", a link to the filtered list).
// - Cards: every record in `items` whose `getColumn` is one of the
//   columns' values, in `items`' order; a record whose value has no column
//   isn't shown. `renderCard` is the card's content: the title (a link to
//   the record's page) and a few values.
// - Moving: with `onMove`, a card drags to another column (a pointer) and
//   has a Move button (a menu of `moveTo`, by default the columns: the
//   keyboard and a phone, where there is no drag). `moveTo` may add values
//   with no column, such as Dropped, which take the card off the board.
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
// snap points when they don't fit (a phone shows one at a time).
import { useId, useState, type DragEvent, type ReactNode } from 'react'
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
  /** The Move menu's choices. Default: the columns. */
  moveTo?: readonly BoardMoveTarget<V>[]
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
  isLoading = false,
  error = null,
  onRetry,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
}: BoardProps<T, V>) {
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
          <div key={column.value} className="flex min-w-64 flex-1 basis-0 flex-col gap-2 rounded-lg bg-muted p-2">
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
  const targets = moveTo ?? columns.map((column) => ({ value: column.value, label: String(column.value) }))
  const move = (id: string, value: V) => {
    const item = items.find((candidate) => String(getId(candidate)) === id)
    if (item !== undefined && getColumn(item) !== value) onMove?.(item, value)
  }
  return (
    <div
      data-slot="board"
      data-state="success"
      role="group"
      aria-label={ariaLabel}
      className="flex snap-x gap-3 overflow-x-auto pb-2"
    >
      {columns.map((column) => {
        const cards = shown.filter((item) => getColumn(item) === column.value)
        return (
          <BoardColumnView
            key={column.value}
            column={column}
            count={column.count ?? cards.length}
            onDrop={onMove ? (id) => move(id, column.value) : undefined}
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
                      name={getName(item)}
                      value={getColumn(item)}
                      targets={targets}
                      onMove={(value) => move(String(getId(item)), value)}
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
    </div>
  )
}

function BoardColumnView<V extends string>({
  column,
  count,
  onDrop,
  children,
}: {
  column: BoardColumn<V>
  count: number
  onDrop?: (id: string) => void
  children: ReactNode
}) {
  const [over, setOver] = useState(false)
  const headingId = useId()
  const accepts = (event: DragEvent) => onDrop !== undefined && event.dataTransfer.types.includes(DRAG_TYPE)
  return (
    <section
      aria-labelledby={headingId}
      data-slot="board-column"
      data-over={over || undefined}
      className="flex min-w-64 flex-1 basis-0 snap-start flex-col gap-2 rounded-lg bg-muted p-2 outline-2 outline-offset-2 outline-transparent data-over:outline-ring"
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
      <h2 id={headingId} className="flex items-center gap-2 px-1 pt-0.5 type-label">
        {column.label}
        <span className="font-normal tabular-nums text-muted-foreground">{count}</span>
      </h2>
      {children}
    </section>
  )
}

function MoveMenu<V extends string>({
  name,
  value,
  targets,
  onMove,
}: {
  name: string
  value: V
  targets: readonly BoardMoveTarget<V>[]
  onMove: (value: V) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label={`Move ${name}`} title="Move to…" />}>
        <ArrowRightLeftIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Move to</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={value} onValueChange={(next) => onMove(next as V)}>
            {targets.map((target) => (
              <DropdownMenuRadioItem key={target.value} value={target.value}>
                {target.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
