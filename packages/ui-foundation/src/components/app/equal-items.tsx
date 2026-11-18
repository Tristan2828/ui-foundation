// A few equal things in a record (record page standard R10): the phases of
// a plan, the stores a price is compared at, a handful of options. One data
// shape, five looks, each the record picks for what it shows:
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
// - `stepper` (4.127): the items in order as a row of numbered steps, each
//   done, current or upcoming (an item's `step`), picking the one item
//   whose panel shows under it; it opens on the current step. For a
//   sequence where one is running and the others are looked at in turn (a
//   plan's phases). The steps are a tablist: arrow keys, Home and End move
//   and pick; on a phone the row scrolls sideways in its own box, as the
//   record's tab bar does.
//
// The parts are the record's own: a state is a `Badge` in the outline
// style (design-language.md "The three badge styles"), a field is the
// rail's label/value row (field-rows.ts, as EntityView draws it), an empty
// value is the record's dash, read as "Not set". It owns its empty states:
// no items reads `emptyText` ("Nothing yet"), an item with no fields
// `noFieldsText` ("No details").
//
// An item can carry its own parts too (4.94): `content`, anything of the
// app's (an editor of several fields, a note, a chart), drawn under its
// fields at the item's full width, never in the label/value grid; and
// `actions`, its own buttons (Edit, Remove), at the end of its title line,
// or the table's last column. `wide` gives an item the whole row in
// `cards` and `panels`, for content that needs it (an editor open).
import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EMPTY_DASH, isEmptyValue } from '@/lib/empty-value'
import { EmptyText } from './empty-value'
import { FIELD_LABEL, FIELD_ROW, FIELD_ROW_BASE, FIELD_VALUE } from './field-rows'

/** Which look a set of equal items takes. */
export type EqualItemsLook = 'cards' | 'table' | 'featured' | 'panels' | 'stepper'

/**
 * Where an item is in a sequence, for `look="stepper"`: `done` (a filled
 * step with a check), `current` (ringed, "Current" under its name, its
 * panel's border the accent) or `upcoming` (outlined, the default).
 */
export type EqualItemStep = 'done' | 'current' | 'upcoming'

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
  /** Its details, in order. None (and no `content`) reads as `noFieldsText`. */
  fields?: readonly EqualItemField[]
  /**
   * Anything of the app's, under the fields at the item's full width (an
   * editor of several fields, a note): never squeezed into the label/value
   * grid. In the `table` look, a row of its own under the item's.
   */
  content?: ReactNode
  /**
   * The item's own buttons (Edit, Remove), small and named for the item
   * ("Edit Phase 2"): at the end of its title line, beside a featured
   * toggle's button (never inside it), or the `table` look's last column.
   */
  actions?: ReactNode
  /** The whole row in the `cards` and `panels` looks (an editor open in it). */
  wide?: boolean
  /** For `look="stepper"`: done, current or upcoming (the default). */
  step?: EqualItemStep
  /**
   * For `look="stepper"`: a step that needs a look while another is shown
   * (an unsaved change that needs an answer in it): a small warning dot on
   * its step, and these words at the end of the step's name ("needs an
   * answer").
   */
  attention?: string
}

export type EqualItemsProps = {
  items: readonly EqualItem[]
  /** Defaults to `cards`. */
  look?: EqualItemsLook
  /**
   * For `look="featured"`: the item shown in full. Defaults to the first
   * one; an id that matches none falls back to the first too. For
   * `look="stepper"`: the step shown first, defaulting to the `current`
   * one, else the first.
   */
  featuredId?: string
  /**
   * For `look="stepper"`: the step shown, when the app keeps it (in the
   * URL, say). An id that matches none falls back as `featuredId` does.
   * Without it, the stepper keeps its own.
   */
  selectedId?: string
  /** For `look="stepper"`: called with the step picked. */
  onSelectedChange?: (id: string) => void
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
  /** For `look="table"`: the actions column's heading, for screen readers. Defaults to "Actions". */
  actionsColumn?: string
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

const hasPart = (part: ReactNode) => part !== undefined && part !== null && part !== false

function Actions({ actions, className }: { actions: ReactNode; className?: string }) {
  if (!hasPart(actions)) return null
  return (
    <div data-slot="equal-item-actions" className={cn('flex shrink-0 flex-wrap items-center justify-end gap-1', className)}>
      {actions}
    </div>
  )
}

// The title and its state, then the item's actions at the line's end.
function Title({ item, level, className }: { item: EqualItem; level: Level; className?: string }) {
  const Heading = `h${level}` as const
  const withActions = hasPart(item.actions)
  const heading = (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1', withActions ? 'flex-1' : className)}>
      <Heading className="min-w-0 type-body font-semibold break-words text-foreground">{item.title}</Heading>
      <StateBadge state={item.state} />
    </div>
  )
  if (!withActions) return heading
  return (
    <div className={cn('flex min-w-0 items-start gap-2', className)}>
      {heading}
      <Actions actions={item.actions} className="-my-1" />
    </div>
  )
}

// An item's body: its fields, then its own content at full width. Content
// alone needs no fields, and reads no "No details".
function Body({
  item,
  noFieldsText,
  rows,
}: {
  item: EqualItem
  noFieldsText: string
  rows: 'beside' | 'stacked' | 'compact'
}) {
  if (!hasPart(item.content)) return <Fields fields={item.fields} noFieldsText={noFieldsText} rows={rows} />
  return (
    <>
      {item.fields && item.fields.length > 0 && <Fields fields={item.fields} noFieldsText={noFieldsText} rows={rows} />}
      <div data-slot="equal-item-content" className="min-w-0">
        {item.content}
      </div>
    </>
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
          data-wide={item.wide ? '' : undefined}
          className={cn(
            'flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground',
            item.wide && 'col-span-full',
          )}
        >
          <Title item={item} level={level} />
          <Body item={item} noFieldsText={noFieldsText} rows="compact" />
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
          data-wide={item.wide ? '' : undefined}
          className={cn(
            'flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground',
            item.wide && 'col-span-full',
          )}
        >
          <Title item={item} level={level} className="border-b border-border bg-muted/40 px-4 py-3" />
          <div className="flex flex-col gap-3 px-4 py-3">
            <Body item={item} noFieldsText={noFieldsText} rows="stacked" />
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
  actionsColumn,
}: Omit<LookProps, 'level' | 'noFieldsText'> & { titleColumn: string; stateColumn: string; actionsColumn: string }) {
  const columns: string[] = []
  for (const item of items) for (const field of item.fields ?? []) if (!columns.includes(field.label)) columns.push(field.label)
  const hasState = items.some((item) => stateOf(item.state))
  const hasActions = items.some((item) => hasPart(item.actions))
  const span = 1 + (hasState ? 1 : 0) + columns.length + (hasActions ? 1 : 0)
  return (
    <div data-slot="equal-items-table" className="@container/equal-table rounded-lg border border-border bg-card text-card-foreground">
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
            {hasActions && (
              <TableHead scope="col">
                <span className="sr-only">{actionsColumn}</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody className="[&_tr:nth-child(even)]:bg-transparent">
          {items.map((item) => (
            <Fragment key={item.id}>
              <TableRow data-slot="equal-item" className={cn(hasPart(item.content) && 'border-b-0')}>
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
                {hasActions && (
                  <TableCell className="w-0 py-1">
                    <Actions actions={item.actions} className="flex-nowrap" />
                  </TableCell>
                )}
              </TableRow>
              {/* The item's own content: a row under its own, as wide as the
                table's box (not its scroll width, on a phone), held in view
                while the table scrolls sideways. */}
              {hasPart(item.content) && (
                <TableRow data-slot="equal-item-content-row" className="hover:bg-transparent">
                  <TableCell colSpan={span} className="pt-0 whitespace-normal">
                    <div
                      data-slot="equal-item-content"
                      className="sticky left-(--table-cell-px) w-[calc(100cqw-var(--table-cell-px)*2)] min-w-0"
                    >
                      {item.content}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
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
        <Body item={featured} noFieldsText={noFieldsText} rows="beside" />
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
        {/* The item's actions sit beside the toggle, never inside its button. */}
        <div className="flex min-w-0 items-center">
          <Heading className="m-0 min-w-0 flex-1">
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
          <Actions actions={item.actions} className="pr-4" />
        </div>
        <CollapsibleContent className="flex flex-col gap-3 px-4 pt-1 pb-4 pl-10">
          <Body item={item} noFieldsText={noFieldsText} rows="beside" />
        </CollapsibleContent>
      </Collapsible>
    </li>
  )
}

// The items as numbered steps joined by a line, a tablist picking the one
// panel shown under it (Base UI's tabs: arrow keys, Home and End move and
// pick, Tab goes on into the panel). A step's name is what it shows plus
// hidden words ("Step 2: Phase 2: Build, done"), never an aria-label, so
// the visible text stays in the name. Wider than its column (a phone, many
// steps), the row scrolls sideways in its own box, never the page, and
// keeps the shown step in view.
function Stepper({
  items,
  label,
  level,
  noFieldsText,
  featuredId,
  selectedId,
  onSelectedChange,
}: LookProps & Pick<EqualItemsProps, 'featuredId' | 'selectedId' | 'onSelectedChange'>) {
  const has = (id: string | undefined): id is string => id !== undefined && items.some((item) => item.id === id)
  const first = has(featuredId) ? featuredId : (items.find((item) => item.step === 'current') ?? items[0]!).id
  const [own, setOwn] = useState(first)
  const shownId = has(selectedId) ? selectedId : has(own) ? own : first
  const listRef = useRef<HTMLDivElement>(null)
  // Keep the shown step in the row's view when it scrolls sideways; the
  // row only, never the page.
  useLayoutEffect(() => {
    const list = listRef.current
    const tab = list?.querySelector<HTMLElement>('[data-slot="equal-item-step"][data-active]')
    if (!list || !tab || list.scrollWidth <= list.clientWidth) return
    const left = tab.offsetLeft - list.offsetLeft
    if (left < list.scrollLeft || left + tab.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollLeft = left - (list.clientWidth - tab.offsetWidth) / 2
    }
  }, [shownId])
  return (
    <TabsPrimitive.Root
      data-slot="equal-items-stepper"
      value={shownId}
      onValueChange={(next) => {
        const id = String(next)
        setOwn(id)
        onSelectedChange?.(id)
      }}
      className="flex min-w-0 flex-col gap-3"
    >
      <TabsPrimitive.List
        ref={listRef}
        activateOnFocus
        aria-label={label}
        className="relative flex max-w-full overflow-x-auto overflow-y-hidden [scrollbar-width:thin]"
      >
        {items.map((item, index) => {
          const step = item.step ?? 'upcoming'
          return (
            <TabsPrimitive.Tab
              key={item.id}
              value={item.id}
              data-slot="equal-item-step"
              data-step={step}
              aria-current={step === 'current' ? 'step' : undefined}
              className={cn(
                'group/step relative flex min-h-11 min-w-18 flex-1 basis-0 flex-col items-center gap-1 rounded-md px-1 pt-1 pb-1.5 text-center text-xs text-muted-foreground outline-none',
                'hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset',
                'data-active:font-semibold data-active:text-foreground',
                // The line from the step before, under the marks.
                'before:absolute before:top-4 before:right-1/2 before:h-0.5 before:w-full first:before:hidden',
                step === 'upcoming' ? 'before:bg-border' : 'before:bg-primary',
              )}
            >
              <span
                aria-hidden="true"
                data-slot="equal-item-step-mark"
                className={cn(
                  'relative z-10 grid size-6.5 shrink-0 place-items-center rounded-full border-2 text-xs font-bold tabular-nums',
                  step === 'done'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : step === 'current'
                      ? 'border-primary bg-card text-foreground'
                      : 'border-border bg-card text-muted-foreground',
                  // The shown step: a ring round its mark.
                  'group-data-active/step:ring-2 group-data-active/step:ring-ring group-data-active/step:ring-offset-2 group-data-active/step:ring-offset-card',
                )}
              >
                {step === 'done' ? <CheckIcon className="size-3.5" /> : index + 1}
                {item.attention && (
                  <span
                    data-slot="equal-item-step-attention"
                    className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border border-card bg-warning-text"
                  />
                )}
              </span>
              {/* The hidden words sit inside the clamped line, so the name
                  reads "Phase 1, done" with no gap a block would add. */}
              <span className="line-clamp-3 max-w-full min-w-0 break-words">
                <span className="sr-only">{`Step ${index + 1}: `}</span>
                {item.title}
                {step === 'done' && <span className="sr-only">, done</span>}
                {item.attention && <span className="sr-only">{`, ${item.attention}`}</span>}
              </span>
              {step === 'current' && <span className="font-normal text-muted-foreground">Current</span>}
            </TabsPrimitive.Tab>
          )
        })}
      </TabsPrimitive.List>
      {items.map((item) => (
        <TabsPrimitive.Panel
          key={item.id}
          value={item.id}
          data-slot="equal-item"
          data-step={item.step ?? 'upcoming'}
          className={cn(
            'flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
            item.step === 'current' ? 'border-primary' : 'border-border',
          )}
        >
          <Title item={item} level={level} />
          <Body item={item} noFieldsText={noFieldsText} rows="beside" />
        </TabsPrimitive.Panel>
      ))}
    </TabsPrimitive.Root>
  )
}

/**
 * A few equal, related things inside a record view (record page standard
 * R10): one data shape, five looks.
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
 * best, `panels` when each has several details and must read as separate,
 * `stepper` for a sequence with a current step, its steps picking the one
 * panel shown (design-language.md "A few equal things"). An item's own `content` (an
 * editor) goes under its fields at full width, its `actions` (Edit, Remove)
 * at its title line's end; `wide` gives it the whole row of cards or panels.
 */
export function EqualItems({
  items,
  look = 'cards',
  featuredId,
  defaultOpenIds,
  selectedId,
  onSelectedChange,
  label,
  headingLevel = 3,
  titleColumn = 'Name',
  stateColumn = 'Status',
  actionsColumn = 'Actions',
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
        <ItemsTable
          items={items}
          label={label}
          titleColumn={titleColumn}
          stateColumn={stateColumn}
          actionsColumn={actionsColumn}
        />
      ) : look === 'featured' ? (
        <Featured {...shared} featuredId={featuredId} defaultOpenIds={defaultOpenIds} />
      ) : look === 'stepper' ? (
        <Stepper {...shared} featuredId={featuredId} selectedId={selectedId} onSelectedChange={onSelectedChange} />
      ) : look === 'panels' ? (
        <Panels {...shared} />
      ) : (
        <Cards {...shared} />
      )}
    </div>
  )
}
