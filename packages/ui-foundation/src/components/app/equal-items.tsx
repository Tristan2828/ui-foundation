// A few equal things in a record (record page standard R10): the phases of
// a plan, the stores a price is compared at, a handful of options. One data
// shape, four looks, each the record picks for what it shows:
//
// - `cards`: a row of equal cards that wraps (one column on a phone), each
//   its title, its state as a badge and its fields as short label/value
//   lines.
//   For a few things with little to say about each.
// - `table`: one compact row per item, a column per field label. For
//   things compared on the same values.
// - `featured`: the item `featuredId` names (the current one, the best one)
//   in full, then the others as toggles that open in place, one or several
//   at a time. Never navigation.
// - `panels`: a panel per item side by side, every detail labelled above
//   its value, stacking on a phone. For things with several details each
//   that need to read as separate.
//
// The parts are the record's own: a state is a `Badge` in the outline
// style (design-language.md "The three badge styles"), a field is the
// rail's label/value row (field-rows.ts, as EntityView draws it), an empty
// value is the record's dash, read as "Not set". It owns its empty states:
// no items reads `emptyText` ("Nothing yet"), an item with no fields
// `noFieldsText` ("No details").
import { useState, type ReactNode } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EMPTY_DASH, isEmptyValue } from '@/lib/empty-value'
import { EmptyText } from './empty-value'
import { FIELD_LABEL, FIELD_ROW, FIELD_ROW_BASE, FIELD_VALUE } from './field-rows'

/** Which look a set of equal items takes. */
export type EqualItemsLook = 'cards' | 'table' | 'featured' | 'panels'

/**
 * A state's tone, from design-language.md "Semantic tones": `neutral` (the
 * default) for most values, a colour only where the state means good,
 * bad or worth a look. Drawn as the outline badge of that tone.
 */
export type EqualItemTone = 'neutral' | 'info' | 'success' | 'warning' | 'destructive'

/** A small status ("Current", "Done", "Planned") and its tone. */
export type EqualItemState = {
  label: string
  /** Defaults to `neutral`. */
  tone?: EqualItemTone
}

/** One labelled value of an item. */
export type EqualItemField = {
  /** The label: a word or two. In the `table` look, its column's heading. */
  label: string
  /** The value, formatted as the screen's cells are. Empty reads as a dash. */
  value: ReactNode
}

/** One of the equal things. */
export type EqualItem = {
  /** Unique in the list; a stored id when there is one. */
  id: string
  /** Its name ("Phase 2", "Plus"). Plain text: it names the item's toggle and row. */
  title: string
  /** A small status, as a badge: words alone are a neutral one. */
  state?: string | EqualItemState
  /** Its details, in order. None reads as `noFieldsText`. */
  fields?: readonly EqualItemField[]
}

export type EqualItemsProps = {
  items: readonly EqualItem[]
  /** Defaults to `cards`. */
  look?: EqualItemsLook
  /**
   * For `look="featured"`: the item shown in full. Defaults to the first
   * one; an id that matches none falls back to the first too.
   */
  featuredId?: string
  /**
   * For `look="featured"`: the other items open when it first shows.
   * Each toggle opens and closes on its own after that.
   */
  defaultOpenIds?: readonly string[]
  /** The set's name for screen readers ("Phases"); the table's caption. */
  label: string
  /** The items' heading level: 3 (the default) under a section's h2. */
  headingLevel?: 3 | 4 | 5
  /** For `look="table"`: the first column's heading. Defaults to "Name". */
  titleColumn?: string
  /** For `look="table"`: the state column's heading. Defaults to "Status". */
  stateColumn?: string
  /** What no items says. Defaults to "Nothing yet". */
  emptyText?: string
  /** What an item with no fields says. Defaults to "No details". */
  noFieldsText?: string
  className?: string
}

const TONE_BADGE = {
  neutral: 'outline',
  info: 'outline-info',
  success: 'outline-success',
  warning: 'outline-warning',
  destructive: 'outline-destructive',
} as const satisfies Record<EqualItemTone, string>

const stateOf = (state: EqualItem['state']): EqualItemState | undefined =>
  state === undefined || state === '' ? undefined : typeof state === 'string' ? { label: state } : state

function StateBadge({ state }: { state: EqualItem['state'] }) {
  const value = stateOf(state)
  if (!value) return null
  return (
    <Badge data-slot="equal-item-state" variant={TONE_BADGE[value.tone ?? 'neutral']}>
      {value.label}
    </Badge>
  )
}

function Value({ value }: { value: ReactNode }) {
  return isEmptyValue(value) ? <EmptyText text={EMPTY_DASH} /> : value
}

// The item's fields. `beside` is the rail's rows (field-rows.ts): the
// label left of its value from an 18rem list (a featured item, an open
// toggle), stacked in a narrower one. `stacked` keeps every label above its
// value (panels). `compact` is a card's: label and value on one line, no
// rules between, for a few short facts.
function Fields({
  fields,
  noFieldsText,
  rows,
}: {
  fields: readonly EqualItemField[] | undefined
  noFieldsText: string
  rows: 'beside' | 'stacked' | 'compact'
}) {
  if (!fields || fields.length === 0) {
    return <p className="type-body text-muted-foreground">{noFieldsText}</p>
  }
  if (rows === 'compact') {
    return (
      <dl data-slot="equal-item-fields" className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1.5">
        {fields.map((field, index) => (
          <div key={`${field.label}-${index}`} className="contents">
            <dt className={cn(FIELD_LABEL, 'break-words')}>{field.label}</dt>
            <dd className={FIELD_VALUE}>
              <Value value={field.value} />
            </dd>
          </div>
        ))}
      </dl>
    )
  }
  return (
    <dl data-slot="equal-item-fields" className="@container/fields flex flex-col divide-y divide-border">
      {fields.map((field, index) => (
        <div
          key={`${field.label}-${index}`}
          className={cn(FIELD_ROW_BASE, rows === 'beside' && FIELD_ROW.railBeside)}
        >
          <dt className={FIELD_LABEL}>{field.label}</dt>
          <dd className={FIELD_VALUE}>
            <Value value={field.value} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

type Level = NonNullable<EqualItemsProps['headingLevel']>

function Title({ item, level, className }: { item: EqualItem; level: Level; className?: string }) {
  const Heading = `h${level}` as const
  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1', className)}>
      <Heading className="min-w-0 type-body font-semibold break-words text-foreground">{item.title}</Heading>
      <StateBadge state={item.state} />
    </div>
  )
}

type LookProps = Required<Pick<EqualItemsProps, 'label' | 'noFieldsText'>> & {
  items: readonly EqualItem[]
  level: Level
}

function Cards({ items, label, level, noFieldsText }: LookProps) {
  return (
    <ul aria-label={label} className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,14rem),1fr))] gap-3">
      {items.map((item) => (
        <li
          key={item.id}
          data-slot="equal-item"
          className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground"
        >
          <Title item={item} level={level} />
          <Fields fields={item.fields} noFieldsText={noFieldsText} rows="compact" />
        </li>
      ))}
    </ul>
  )
}

function Panels({ items, label, level, noFieldsText }: LookProps) {
  return (
    <ul
      aria-label={label}
      className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]"
    >
      {items.map((item) => (
        <li
          key={item.id}
          data-slot="equal-item"
          className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground"
        >
          <Title item={item} level={level} className="border-b border-border bg-muted/40 px-4 py-3" />
          <div className="px-4 py-3">
            <Fields fields={item.fields} noFieldsText={noFieldsText} rows="stacked" />
          </div>
        </li>
      ))}
    </ul>
  )
}

// One column per field label, in the order the items first give them; an
// item without one reads as a dash there. The title is each row's header.
function ItemsTable({
  items,
  label,
  titleColumn,
  stateColumn,
}: Omit<LookProps, 'level' | 'noFieldsText'> & { titleColumn: string; stateColumn: string }) {
  const columns: string[] = []
  for (const item of items) for (const field of item.fields ?? []) if (!columns.includes(field.label)) columns.push(field.label)
  const hasState = items.some((item) => stateOf(item.state))
  return (
    <div data-slot="equal-items-table" className="rounded-lg border border-border bg-card text-card-foreground">
      <Table>
        <caption className="sr-only">{label}</caption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col" className="type-label text-muted-foreground">
              {titleColumn}
            </TableHead>
            {hasState && (
              <TableHead scope="col" className="type-label text-muted-foreground">
                {stateColumn}
              </TableHead>
            )}
            {columns.map((column) => (
              <TableHead key={column} scope="col" className="type-label text-muted-foreground">
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="[&_tr:nth-child(even)]:bg-transparent">
          {items.map((item) => (
            <TableRow key={item.id} data-slot="equal-item">
              <TableHead
                scope="row"
                className="h-auto min-w-28 py-(--table-cell-py) font-semibold sm:min-w-40 break-words whitespace-normal"
              >
                {item.title}
              </TableHead>
              {hasState && (
                <TableCell>
                  {stateOf(item.state) ? <StateBadge state={item.state} /> : <EmptyText text={EMPTY_DASH} />}
                </TableCell>
              )}
              {columns.map((column) => (
                <TableCell key={column} className="type-body tabular-nums">
                  <Value value={item.fields?.find((field) => field.label === column)?.value} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function Featured({
  items,
  label,
  level,
  noFieldsText,
  featuredId,
  defaultOpenIds,
}: LookProps & { featuredId: string | undefined; defaultOpenIds: readonly string[] | undefined }) {
  const featured = items.find((item) => item.id === featuredId) ?? items[0]!
  const rest = items.filter((item) => item !== featured)
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-3">
      <section
        data-slot="equal-item"
        data-featured=""
        aria-label={featured.title}
        className="flex min-w-0 flex-col gap-3 rounded-lg border border-primary bg-card p-4 text-card-foreground"
      >
        <Title item={featured} level={level} />
        <Fields fields={featured.fields} noFieldsText={noFieldsText} rows="beside" />
      </section>
      {rest.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card text-card-foreground">
          {rest.map((item) => (
            <FeaturedToggle
              key={item.id}
              item={item}
              level={level}
              noFieldsText={noFieldsText}
              defaultOpen={defaultOpenIds?.includes(item.id) ?? false}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

// A heading holding its button (the disclosure pattern): Enter and Space
// open and close it, Tab moves on to the next, and the button says
// whether it's open. Each opens on its own, so several can be open.
function FeaturedToggle({
  item,
  level,
  noFieldsText,
  defaultOpen,
}: {
  item: EqualItem
  level: Level
  noFieldsText: string
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const Heading = `h${level}` as const
  return (
    <li data-slot="equal-item">
      <Collapsible open={open} onOpenChange={setOpen}>
        <Heading className="m-0">
          <CollapsibleTrigger
            data-slot="equal-item-toggle"
            className="flex min-h-11 w-full items-center gap-2 px-4 py-2 text-left outline-none hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
          >
            <ChevronDownIcon
              aria-hidden="true"
              className={cn('size-4 shrink-0 text-muted-foreground transition-transform', !open && '-rotate-90')}
            />
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="min-w-0 type-body font-semibold break-words text-foreground">{item.title}</span>
              <StateBadge state={item.state} />
            </span>
          </CollapsibleTrigger>
        </Heading>
        <CollapsibleContent className="px-4 pt-1 pb-4 pl-10">
          <Fields fields={item.fields} noFieldsText={noFieldsText} rows="beside" />
        </CollapsibleContent>
      </Collapsible>
    </li>
  )
}

/**
 * A few equal, related things inside a record view (record page standard
 * R10): one data shape, four looks.
 *
 * ```tsx
 * <EqualItems
 *   label="Phases"
 *   look="featured"
 *   featuredId="p2"
 *   items={[
 *     { id: 'p1', title: 'Phase 1', state: { label: 'Done', tone: 'success' }, fields: [{ label: 'Weeks', value: '1–4' }] },
 *     { id: 'p2', title: 'Phase 2', state: { label: 'Current', tone: 'info' }, fields: [{ label: 'Weeks', value: '5–8' }] },
 *     { id: 'p3', title: 'Phase 3', state: 'Planned', fields: [{ label: 'Weeks', value: '9–12' }] },
 *   ]}
 * />
 * ```
 *
 * `cards` for a few things with little to say about each, `table` for
 * things compared on the same values, `featured` when one is current or
 * best, `panels` when each has several details and must read as separate
 * (design-language.md "A few equal things").
 */
export function EqualItems({
  items,
  look = 'cards',
  featuredId,
  defaultOpenIds,
  label,
  headingLevel = 3,
  titleColumn = 'Name',
  stateColumn = 'Status',
  emptyText = 'Nothing yet',
  noFieldsText = 'No details',
  className,
}: EqualItemsProps) {
  if (items.length === 0) {
    return (
      <p data-slot="equal-items" data-look={look} data-state="empty" className={cn('type-body text-muted-foreground', className)}>
        {emptyText}
      </p>
    )
  }
  const shared = { items, label, level: headingLevel, noFieldsText }
  return (
    <div data-slot="equal-items" data-look={look} className={cn('min-w-0', className)}>
      {look === 'table' ? (
        <ItemsTable items={items} label={label} titleColumn={titleColumn} stateColumn={stateColumn} />
      ) : look === 'featured' ? (
        <Featured {...shared} featuredId={featuredId} defaultOpenIds={defaultOpenIds} />
      ) : look === 'panels' ? (
        <Panels {...shared} />
      ) : (
        <Cards {...shared} />
      )}
    </div>
  )
}
