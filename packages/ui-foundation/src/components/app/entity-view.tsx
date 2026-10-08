// Generic read-only view of one record, the read-side partner of
// EntityForm: the record's title with a few status badges beside it, an
// actions area (Edit, Delete), and sections of label/value rows laid out to
// read rather than as a form. It owns the loading, not-found and error
// states, the way DataTable does for a list.
//
// Deliberately thin, like EntityForm: each value is the screen's own
// markup, built with the same cell patterns as the table's columns
// (badges, names of linked records, a done-count), and <Markdown> for
// long text. This component never formats a field. What it does guarantee
// is that an empty value reads as the plan's "not set" label, never a
// blank.
//
// A value can be any markup, a control included, and so can `badges`:
// that's where quick actions go (cell pattern 17), a value the plan marks
// as changed straight from this page and saved on its own through
// `useRecordUpdate`: a status picked in the header, a yes/no switch,
// checklist items ticked in place.
//
// Editing in place (cell pattern 18): a field, a `content` section or the
// title marked `edit` turns into its form control where it's shown, and
// saves when you leave it. This component runs it (one field open at a
// time, the leave-page prompt); EditableValue is each value's side, and a
// header badge uses it directly. A field not marked renders exactly as
// before. Edit, in `actions`, stays for everything else. A sub-item list
// edits in place too (editInPlace's `list` kind, editable-list.tsx): its
// items added, edited, moved and removed on the page.
//
// Two layouts. `column` (the default): every section in one column capped
// at max-w-4xl. `rail`, for a record with long content: the page takes the
// content area's whole width, sections placed `rail` go in a narrow column
// on the right that stays in view while the main column scrolls (an issue
// tracker's shape), and the rest fill the main column. Below the width two
// columns need, one column: header, rail, main. The DOM is in that order at
// every width, so reading and tab order match the screen.
import { useEffect, useId, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowLeftIcon, SearchXIcon } from 'lucide-react'
import { cn } from 'cn'
import type { AppError } from '@/api/contracts'
import { ErrorState } from '@/components/app/error-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { EditInPlaceContext, type EditInPlace, type EditInPlaceList } from './edit-in-place'
import { EditInPlaceStore } from './edit-in-place-store'
import { EditableList } from './editable-list'
import { EditableValue, LeaveGuard } from './editable-value'

export type EntityViewField = {
  label: string
  /**
   * The value as the screen renders it. `null`, `undefined`, `false`, `''`
   * and an empty array all count as empty and show `emptyLabel` instead,
   * so `{tags.map(...)}` or `{email}` can be passed as they are.
   */
  value: ReactNode
  /** What an empty value reads as: the plan's "not set" label. Defaults to "Not set". */
  emptyLabel?: string
  /** Editable in place: `editInPlace({...})`. Unmarked, the value is read-only. */
  edit?: EditInPlace
}

/**
 * A titled card on the view: either label/value rows (`fields`), or one
 * block of content under the heading with no label of its own (`content`),
 * for long text (`<Markdown>`) or a sub-record list, where a label would
 * only repeat the heading. A block that's empty shows `emptyLabel`, the
 * same rule as a field.
 */
export type EntityViewSection = (
  | {
      /** The section's heading (an <h2>). Unique on the page. */
      title: string
      fields: EntityViewField[]
    }
  | {
      title: string
      content: ReactNode
      emptyLabel?: string
      /**
       * The block is editable in place, named by the section's title: long
       * text (`editInPlace({ kind: 'long-text', ... })`), or a list of
       * sub-items (`editInPlace({ kind: 'list', ... })`). A list shows its
       * own items, with `content` above them (a done-count, or nothing),
       * and `emptyLabel` in place of the items when there are none.
       */
      edit?: EditInPlace | EditInPlaceList
    }
) & {
  /**
   * Where the section goes in the `rail` layout: `rail` for the short ones
   * (a summary, label/value fields, a few links), `main` (the default) for
   * long text and long lists. The `column` layout ignores it.
   */
  placement?: EntityViewPlacement
}

export type EntityViewPlacement = 'main' | 'rail'

/**
 * `column` (the default): one column, at most max-w-4xl wide. `rail`: the
 * content area's whole width, with the sections placed `rail` in a narrow
 * column on the right (one column on a narrow screen, rail first).
 */
export type EntityViewLayout = 'column' | 'rail'

export type EntityViewProps = {
  /** The record's name or title, the page's <h1>. */
  title?: string
  /** The title is editable in place; `label` is the field's ("Name"). */
  titleEdit?: EditInPlace & { label: string }
  /**
   * A few status-like values beside the title, as `<Badge>`s, or as the
   * control that changes one when the plan makes it a quick action (a
   * status `Select`, a yes/no `Switch`).
   */
  badges?: ReactNode
  /** The header's actions: an Edit button, a Delete with its confirm dialog. */
  actions?: ReactNode
  sections: EntityViewSection[]
  /** `rail` puts the sections placed `rail` in a column on the right. Defaults to `column`. */
  layout?: EntityViewLayout
  /** The rail's landmark name (its `<aside>`). Defaults to the title + " details". */
  railLabel?: string
  isLoading: boolean
  /** A `notfound` error (including another user's record) shows "Not found" and a way back, never a retry. */
  error?: AppError | null
  onRetry?: () => void
  /** The entity's list: a link above the title, and the not-found state's way out. */
  back: { to: string; label: string }
}

const DEFAULT_EMPTY_LABEL = 'Not set'

function isEmptyValue(value: ReactNode) {
  return (
    value === null ||
    value === undefined ||
    value === false ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  )
}

function BackLink({ back }: { back: EntityViewProps['back'] }) {
  return (
    <Link
      to={back.to}
      className="inline-flex w-fit items-center gap-1 rounded-sm type-label text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <ArrowLeftIcon aria-hidden="true" className="size-4" />
      {back.label}
    </Link>
  )
}

function orEmptyLabel(value: ReactNode, emptyLabel: string | undefined) {
  return isEmptyValue(value) ? (
    <span className="text-muted-foreground">{emptyLabel ?? DEFAULT_EMPTY_LABEL}</span>
  ) : (
    value
  )
}

// Label beside value from `sm` up; below it (a phone) the label sits
// above its value, so nothing is squeezed into a narrow second column. In
// the rail the list's own width decides instead (a container query on the
// <dl>): label above value in the narrow rail, beside it once the rail's
// sections stack full width under the header.
const FIELD_ROW = {
  page: 'sm:grid sm:grid-cols-[minmax(8rem,12rem)_1fr] sm:gap-6',
  rail: '@lg/fields:grid @lg/fields:grid-cols-[minmax(8rem,12rem)_1fr] @lg/fields:gap-6',
}

function FieldRow({ field, inRail }: { field: EntityViewField; inRail: boolean }) {
  return (
    <div className={cn('flex flex-col gap-1 py-3 first:pt-0 last:pb-0', FIELD_ROW[inRail ? 'rail' : 'page'])}>
      <dt className="type-label text-muted-foreground">{field.label}</dt>
      <dd className="min-w-0 type-body break-words text-foreground">
        {field.edit ? (
          <EditableValue label={field.label} edit={field.edit}>
            {orEmptyLabel(field.value, field.emptyLabel)}
          </EditableValue>
        ) : (
          orEmptyLabel(field.value, field.emptyLabel)
        )}
      </dd>
    </div>
  )
}

function ViewSection({ section, inRail = false }: { section: EntityViewSection; inRail?: boolean }) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId}>
      <Card>
        <CardHeader>
          <h2 id={headingId} className="type-section-title text-foreground">
            {section.title}
          </h2>
        </CardHeader>
        <CardContent>
          {'fields' in section ? (
            <dl className={cn('flex flex-col divide-y divide-border', inRail && '@container/fields')}>
              {section.fields.map((field) => (
                <FieldRow key={field.label} field={field} inRail={inRail} />
              ))}
            </dl>
          ) : section.edit?.kind === 'list' ? (
            <div className="flex min-w-0 flex-col gap-2 type-body break-words text-foreground">
              {!isEmptyValue(section.content) && section.content}
              <EditableList label={section.title} edit={section.edit} emptyLabel={section.emptyLabel ?? DEFAULT_EMPTY_LABEL} />
            </div>
          ) : (
            <div className="min-w-0 type-body break-words text-foreground">
              {section.edit ? (
                <EditableValue label={section.title} edit={section.edit}>
                  {orEmptyLabel(section.content, section.emptyLabel)}
                </EditableValue>
              ) : (
                orEmptyLabel(section.content, section.emptyLabel)
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

// The rail layout's columns. The view is a container, so the switch to
// two columns follows the width the page actually has (the sidebar open
// or not), not the window's: two from 56rem (896px), where the main
// column still gets ~32rem beside a 22rem rail. Below that, one column in
// DOM order (header, rail, main); from it, the grid puts the rail on the
// right of row 1 and main on its left, both starting under the header.
const RAIL_LAYOUT = {
  page: '@container/view flex min-w-0 flex-col gap-6',
  columns: 'flex flex-col gap-6 @4xl/view:grid @4xl/view:grid-cols-[minmax(0,1fr)_22rem] @4xl/view:items-start',
  rail: '@4xl/view:col-start-2 @4xl/view:row-start-1',
  main: 'flex min-w-0 flex-col gap-6 @4xl/view:col-start-1 @4xl/view:row-start-1',
  // Main alone (no rail sections): the whole row.
  mainAlone: '@4xl/view:col-span-2',
  // Sticky only beside main, and only while the whole rail fits on screen
  // (`data-fits`, measured): a taller one scrolls with the page, so its end
  // is never stuck below the fold.
  sticky: '@4xl/view:data-[fits]:sticky @4xl/view:data-[fits]:top-6',
}

function SkeletonCard({ rows, stacked }: { rows: number; stacked: boolean }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className={cn('flex flex-col gap-1', !stacked && 'sm:flex-row sm:gap-6')}>
            <Skeleton className="h-5 w-32" />
            <Skeleton className={cn('h-5', stacked ? 'w-full' : 'flex-1')} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// The page's shape before the record arrives, in the layout it will have,
// so nothing jumps when it loads.
function EntityViewSkeleton({ layout }: { layout: EntityViewLayout }) {
  const header = (
    <>
      <Skeleton className="h-5 w-24" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="h-5 w-40" />
      </div>
    </>
  )
  if (layout === 'rail') {
    return (
      <div className={RAIL_LAYOUT.page} data-state="loading" data-layout="rail">
        {header}
        <div className={RAIL_LAYOUT.columns}>
          <div className={cn(RAIL_LAYOUT.rail, 'flex flex-col gap-6')}>
            <SkeletonCard rows={4} stacked />
          </div>
          <div className={RAIL_LAYOUT.main}>
            <SkeletonCard rows={6} stacked={false} />
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="flex max-w-4xl flex-col gap-6" data-state="loading">
      {header}
      {Array.from({ length: 2 }, (_, section) => (
        <SkeletonCard key={section} rows={4} stacked={false} />
      ))}
    </div>
  )
}

// The rail's top offset (top-6) plus as much again below it.
const RAIL_MARGIN_PX = 48

// Whether `element` fits in the window with room around it, re-measured
// whenever it or the window changes size (a field opening in place, a
// rotated phone).
function useFitsWindow() {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [fits, setFits] = useState(false)
  useEffect(() => {
    if (!element) return
    const measure = () => setFits(element.offsetHeight + RAIL_MARGIN_PX <= window.innerHeight)
    // A ResizeObserver reports once as soon as it observes: the first measure.
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [element])
  return [setElement, fits] as const
}

function Rail({ label, sections }: { label: string; sections: EntityViewSection[] }) {
  const [ref, fits] = useFitsWindow()
  return (
    <aside
      ref={ref}
      aria-label={label}
      data-fits={fits ? '' : undefined}
      className={cn(RAIL_LAYOUT.rail, RAIL_LAYOUT.sticky, 'flex min-w-0 flex-col gap-6')}
    >
      {sections.map((section) => (
        <ViewSection key={section.title} section={section} inRail />
      ))}
    </aside>
  )
}

export function EntityView({
  title,
  titleEdit,
  badges,
  actions,
  sections,
  layout = 'column',
  railLabel,
  isLoading,
  error,
  onRetry,
  back,
}: EntityViewProps) {
  // Editing in place: one store per view, and the leave-page prompt only
  // while a field is open.
  const [store] = useState(() => new EditInPlaceStore())
  const openField = useSyncExternalStore(
    store.subscribe,
    () => store.open,
    () => store.open,
  )

  if (error?.kind === 'notfound') {
    // A record that doesn't exist and one that belongs to another user are
    // the same plain 404, so this never says which. Retrying can't help.
    return (
      <Empty data-state="notfound">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon />
          </EmptyMedia>
          <EmptyTitle>Not found</EmptyTitle>
          <EmptyDescription>{error.message}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="sm" variant="outline" nativeButton={false} render={<Link to={back.to} />}>
            Back to {back.label}
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  if (error) return <ErrorState error={error} onRetry={onRetry} />

  if (isLoading) return <EntityViewSkeleton layout={layout} />

  const railSections = sections.filter((section) => section.placement === 'rail')
  const mainSections = sections.filter((section) => section.placement !== 'rail')

  return (
    <EditInPlaceContext.Provider value={store}>
    <div
      className={layout === 'rail' ? RAIL_LAYOUT.page : 'flex max-w-4xl flex-col gap-6'}
      data-state="success"
      data-layout={layout}
    >
      {openField !== null && <LeaveGuard store={store} />}
      <BackLink back={back} />

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="type-page-title break-words text-foreground">
            {titleEdit ? (
              <EditableValue label={titleEdit.label} edit={titleEdit} layout="inline" className="w-full">
                {title}
              </EditableValue>
            ) : (
              title
            )}
          </h1>
          {badges && <div className="flex flex-wrap items-center gap-1.5">{badges}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </header>

      {layout === 'rail' ? (
        <div className={RAIL_LAYOUT.columns}>
          {railSections.length > 0 && (
            <Rail label={railLabel ?? `${title ?? 'Record'} details`} sections={railSections} />
          )}
          <div className={cn(RAIL_LAYOUT.main, railSections.length === 0 && RAIL_LAYOUT.mainAlone)}>
            {mainSections.map((section) => (
              <ViewSection key={section.title} section={section} />
            ))}
          </div>
        </div>
      ) : (
        sections.map((section) => <ViewSection key={section.title} section={section} />)
      )}
    </div>
    </EditInPlaceContext.Provider>
  )
}
