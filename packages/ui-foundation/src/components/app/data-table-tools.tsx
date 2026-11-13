// DataTable's tools from the list and record page standards, each drawn by
// data-table.tsx: the saved views' pills (L3), the Columns menu (L5), a
// row's actions (L9), the row list a phone gets (L11) and a capped list's
// View all (R8). Kept here so data-table.tsx stays about the table.
import type { ReactNode } from 'react'
import type { Navigator } from 'react-router'
import { Columns3Icon, EllipsisIcon } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { IconAction } from './icon-action'
import type { IconComponent } from './icon-component'
import { PillFilter } from './pill-filter'
import { togglePick, type ColumnsPick } from './table-columns'

// --- L3: saved views ----------------------------------------------------------

/**
 * A saved view as DataTable's `views` reads it: useTableUrlState's
 * TableView, which has these two among its fields.
 */
export type DataTableView = {
  /** The pill's word ("Current"); the view's id unless set. */
  label?: string
  /** The columns this view shows; while it's on they win over the Columns menu. */
  columns?: readonly string[]
}

// The pills on one line that scrolls sideways under 48rem, wrapping wider.
// The padding keeps the focus ring inside the scroll box.
export function ViewPills({
  views,
  value,
  onValueChange,
  label,
}: {
  views: readonly { id: string; label: string }[]
  value: string | null
  onValueChange: (id: string) => void
  label: string
}) {
  return (
    <div data-slot="data-table-views" className="max-md:-mx-1 max-md:overflow-x-auto max-md:p-1">
      <PillFilter
        label={label}
        allLabel={null}
        options={views.map((view) => ({ value: view.id, label: view.label }))}
        // No view's id matches '' (filters set by hand), so none is pressed.
        value={value ?? ''}
        onValueChange={onValueChange}
        className="max-md:w-max max-md:flex-nowrap"
      />
    </div>
  )
}

// --- L5: the Columns menu -----------------------------------------------------

export type DataTableColumnsMenu = {
  /**
   * Where the pick is remembered on this device, one key per list
   * (`"my-app:medications:columns"`).
   */
  storageKey: string
  /** The button's text: "Columns" unless set. */
  label?: string
}

export function ColumnsMenu({
  columns,
  visible,
  fixed,
  pick,
  onPickChange,
  setByView,
  label = 'Columns',
}: {
  /** Every column the menu can tick, in order, with its name. */
  columns: readonly { id: string; label: string }[]
  /** Every column id showing now, ticked or not tickable. */
  visible: readonly string[]
  /** Columns always shown (the name, the actions): never in the menu. */
  fixed: readonly string[]
  pick: ColumnsPick | null
  onPickChange: (pick: ColumnsPick | null) => void
  /** A view on that sets its own columns: the ticks show them and can't change. */
  setByView: boolean
  label?: string
}) {
  const ids = [...fixed, ...columns.map((column) => column.id)]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" data-slot="data-table-columns-menu" />}>
        <Columns3Icon aria-hidden="true" />
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{setByView ? 'Set by This View' : 'Show Columns'}</DropdownMenuLabel>
          {columns.map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={visible.includes(column.id)}
              disabled={setByView}
              onCheckedChange={(checked) => onPickChange(togglePick(ids, visible, column.id, checked, pick))}
            >
              {column.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
        {pick && !setByView ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onPickChange(null)}>Reset to the List's Columns</DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// --- L9: row actions ----------------------------------------------------------

/** One of a row's actions (DataTable `rowActions`). */
export type DataTableRowAction = {
  /** What it does ("Delete"): the menu item's text, or the icon's tooltip and name when it's the only one. */
  label: string
  /** Drawn alone when it's the row's only action, beside the label in the ⋯ menu. */
  icon?: IconComponent
  onSelect: () => void
  /** `destructive` for Delete and the like. */
  tone?: 'default' | 'destructive'
  disabled?: boolean
}

export function RowActions({ actions, rowLabel }: { actions: readonly DataTableRowAction[]; rowLabel?: string }) {
  if (actions.length === 0) return null
  const only = actions.length === 1 ? actions[0] : undefined
  if (only) {
    return only.icon ? (
      <IconAction
        icon={only.icon}
        label={only.label}
        tone={only.tone}
        size="sm"
        variant="ghost"
        disabled={only.disabled}
        onClick={only.onSelect}
        data-slot="data-table-row-action"
      />
    ) : (
      <Button
        variant="ghost"
        size="sm"
        disabled={only.disabled}
        onClick={only.onSelect}
        data-slot="data-table-row-action"
        className={cn(only.tone === 'destructive' && 'text-destructive-text')}
      >
        {only.label}
      </Button>
    )
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <IconAction icon={EllipsisIcon} label={rowLabel ? `Actions for ${rowLabel}` : 'Actions'} size="sm" variant="ghost" data-slot="data-table-row-actions" />
        }
      />
      <DropdownMenuContent align="end" className="w-44">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <DropdownMenuItem
              key={action.label}
              variant={action.tone === 'destructive' ? 'destructive' : 'default'}
              disabled={action.disabled}
              onClick={action.onSelect}
            >
              {Icon ? <Icon aria-hidden="true" /> : null}
              {action.label}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// --- L11: a row list on a phone -----------------------------------------------

/** What a row shows in the row list a phone gets (DataTable `phoneRow`). */
export type DataTablePhoneRow<TData> = {
  /** The record's name: plain text, since the whole row is the link or button. */
  title: (row: TData) => ReactNode
  /** Beside the name, at the end of the line: the status badge. */
  status?: (row: TData) => ReactNode
  /** The facts that matter (two, usually) on one muted line under it, between dots; empty ones are left out. */
  facts?: (row: TData) => readonly ReactNode[]
}

// The whole row is the target, 44px at least, lit as a table row is on hover.
const PHONE_TARGET_CLASS =
  'flex min-h-11 min-w-0 flex-1 flex-col justify-center gap-0.5 px-2 py-2 text-left outline-none ' +
  'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset'
const PHONE_OPENS_CLASS = 'cursor-pointer hover:bg-(--table-hover)'

export function PhoneRow<TData>({
  row,
  phoneRow,
  actions,
  highlighted,
  href,
  onOpen,
}: {
  row: TData
  phoneRow: DataTablePhoneRow<TData>
  actions?: ReactNode
  highlighted: boolean
  /** The record's address: the row is a link to it. */
  href?: string
  /** What a plain click (or Enter) on the row does; with no `href`, the row is a button. */
  onOpen?: () => void
}) {
  const facts = (phoneRow.facts?.(row) ?? []).filter((fact) => fact !== null && fact !== undefined && fact !== '' && fact !== false)
  const content = (
    <>
      <span className="flex min-w-0 items-baseline justify-between gap-3">
        <span className="min-w-0 type-body font-medium break-words text-foreground">{phoneRow.title(row)}</span>
        {phoneRow.status ? <span className="shrink-0">{phoneRow.status(row)}</span> : null}
      </span>
      {facts.length > 0 ? (
        <span className="flex flex-wrap gap-x-1.5 type-caption text-muted-foreground">
          {facts.map((fact, index) => (
            <span key={index} className="inline-flex gap-x-1.5">
              {index > 0 ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="sr-only">, </span>
                </>
              ) : null}
              {fact}
            </span>
          ))}
        </span>
      ) : null}
    </>
  )
  return (
    <li
      data-slot="data-table-phone-row"
      data-highlighted={highlighted || undefined}
      className={cn(
        'flex items-center gap-1 border-b border-border last:border-b-0',
        highlighted &&
          '[--muted-foreground:var(--table-highlight-muted-foreground)] bg-(--table-highlight) shadow-[inset_3px_0_0_0_var(--info-text)]',
      )}
    >
      {href !== undefined ? (
        <a
          href={href}
          className={cn(PHONE_TARGET_CLASS, PHONE_OPENS_CLASS)}
          onClick={(event) => {
            if (!onOpen || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
            event.preventDefault()
            onOpen()
          }}
        >
          {content}
        </a>
      ) : onOpen ? (
        <button type="button" className={cn(PHONE_TARGET_CLASS, PHONE_OPENS_CLASS)} onClick={onOpen}>
          {content}
        </button>
      ) : (
        <div className={PHONE_TARGET_CLASS}>{content}</div>
      )}
      {actions ? <div className="shrink-0 pr-1">{actions}</div> : null}
    </li>
  )
}

export const PHONE_LIST_CLASS = 'flex flex-col overflow-hidden rounded-lg border border-border'

export function PhoneRowsSkeleton() {
  return (
    <ul className={PHONE_LIST_CLASS} data-state="loading" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <li key={index} className="flex flex-col gap-1.5 border-b border-border px-2 py-2.5 last:border-b-0">
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-3 w-2/5" />
        </li>
      ))}
    </ul>
  )
}

// --- R8: a capped list's View all ---------------------------------------------

/** Where a capped list's whole list is (DataTable `viewAll`). */
export type DataTableViewAll = {
  /** The list, filtered to this record (`/health/visits?provider=12`). */
  to: string
  /** How many there are: the table's `total` unless set. */
  total?: number
  /** The link's text: "View all <total>" unless set. */
  label?: string
}

export function ViewAllLink({ viewAll, total, navigator }: { viewAll: DataTableViewAll; total: number; navigator?: Navigator }) {
  return (
    <a
      data-slot="data-table-view-all"
      href={navigator ? navigator.createHref(viewAll.to) : viewAll.to}
      className="self-start rounded-sm type-body font-medium text-link underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      onClick={(event) => {
        if (!navigator || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        void navigator.push(viewAll.to)
      }}
    >
      {viewAll.label ?? `View All ${total}`}
    </a>
  )
}
