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
// items added, edited, moved and removed on the page. Long text can
// autosave as it's typed (`autosave`), and be the editor itself, with no
// click to open (`alwaysEditable`).
//
// In the header, `subtitle` under the title (a goal, a one-line summary).
// Around the sections: `notice` (a <Notice>) under the header, across the
// page, for a state that decides what you do with the record; `strip` (a
// <KeyStats>) under that, the record's key numbers; `footer`
// (a <SourceCredit>) after them all, for crediting the data's source.
//
// Opened in a dialog over its list (RecordDialogRoute, record-dialog.tsx),
// the view is the same: its <h1> names the dialog, the back link gives way
// to the dialog's bar (Open full page, Close), and not found's way out
// closes the dialog.
//
// Printing the notes (entity-view-print.tsx): sections marked `print`
// (the long text: details, prep, questions) give the header a Print notes
// button, which prints those sections alone under the title and
// subtitle, with no rail, shell or buttons, on light paper.
//
// Two layouts. `column` (the default): every section in one column capped
// at max-w-4xl. `rail`, for a record with long content: the page takes the
// content area's whole width, sections placed `rail` go in a narrow column
// on the right that stays in view while the main column scrolls (an issue
// tracker's shape), and the rest fill the main column. Below the width two
// columns need, one column: header, rail, main, or header, main, rail with
// `mobileOrder="main-first"` (a record whose long content is what you open
// it for: notes, a checklist). The DOM is in that order at every width, so
// reading and tab order match the screen: beside each other, the columns'
// places come from the grid, not the DOM.
//
// Tabs (4.76, #303): a main section with a `tab` goes under a tab list at
// the top of the main column, one tab per distinct name in the order the
// sections first give it, and only the selected tab's sections show. The
// rest of the main column stays above the list, and the rail always shows.
// The selected tab is `?tab=<slug>` (the history entry replaced, its state
// kept, so a record over its list stays the dialog); the first tab is the
// bare address, and an unknown slug reads as the first. Every tab's
// sections stay mounted, hidden, so a field open in place survives a
// switch. With no `tab` on any section, nothing changes.
//
// `leading`, left of the title: the record's mark or avatar, with the
// title, subtitle and badges beside it at every width. A rail field's
// label sits to the left of its value (`railFields`, `beside` by default
// since 4.81), as in an issue tracker's sidebar, stacked again where the
// rail's list is too narrow for both.
//
// The record page standard (4.81): `badges` sit on the title's line,
// wrapping under a long title; Print notes is an icon (`IconAction`, its
// words the tooltip and name); an empty value reads as a dash
// (`emptyText`), and `emptyFields="fold"` folds each fields card's empty
// ones behind an "N empty" toggle, still edited in place once opened.
import { createContext, useContext, useEffect, useId, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ArrowLeftIcon, ChevronDownIcon, SearchXIcon } from 'lucide-react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { PrintNotes, type EntityViewPrintSection } from './entity-view-print'
import { EditInPlaceContext, type EditInPlace, type EditInPlaceList } from './edit-in-place'
import { EditInPlaceStore } from './edit-in-place-store'
import { EditableList } from './editable-list'
import { editRowClass, onEditRowClick } from './edit-row'
import { EditableValue, LeaveGuard } from './editable-value'
import { EmptyText } from './empty-value'
import { EMPTY_DASH, isEmptyValue } from '@/lib/empty-value'
import { useRecordDialog } from './record-dialog-context'
import { entityViewTabSlug } from '@/lib/entity-view-tab'

export type EntityViewField = {
  label: string
  /**
   * The value as the screen renders it. `null`, `undefined`, `false`, `''`
   * and an empty array all count as empty and show `emptyLabel` instead,
   * so `{tags.map(...)}` or `{email}` can be passed as they are.
   */
  value?: ReactNode
  /** What an empty value reads as, for this field. Defaults to the view's `emptyText` (a dash). */
  emptyLabel?: string
  /**
   * Editable in place: `editInPlace({...})`, or a ready-made `inPlace`
   * preset, whose `shown` is the value when `value` is left out.
   * Unmarked, the value is read-only.
   */
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
  /**
   * The section is part of the record's printed notes: marking any one
   * adds a Print notes button to the header, which prints the marked
   * sections alone (their content as shown, read-only, nothing folded)
   * under the title and subtitle. `{ answerSpace: true }` also leaves
   * room under each item of the section's numbered lists, to write an
   * answer by hand (a visit's questions).
   */
  print?: boolean | { answerSpace?: boolean }
  /**
   * The tab the section goes under, by name ("Steps", "Used in"): main
   * sections only (a `rail` one ignores it). Any main section with a tab
   * adds a tab list to the main column, one tab per name in the order the
   * sections first give it; sections without one stay above the list. The
   * selected tab is in the address, `?tab=<slug of the name>`.
   */
  tab?: string
}

export type EntityViewPlacement = 'main' | 'rail'

/**
 * `column` (the default): one column, at most max-w-4xl wide. `rail`: the
 * content area's whole width, with the sections placed `rail` in a narrow
 * column on the right (one column on a narrow screen, rail first).
 */
export type EntityViewLayout = 'column' | 'rail'

/**
 * Which column comes first where the rail layout is one column (a phone,
 * or a narrow content area): `rail-first` (the default) or `main-first`.
 */
export type EntityViewMobileOrder = 'rail-first' | 'main-first'

/**
 * How a rail section's fields lay out: `stacked` (the default), each label
 * above its value; `beside`, the label to the left of its value, stacked
 * where the rail's list is narrower than 18rem (a small phone).
 */
export type EntityViewRailFields = 'stacked' | 'beside'

/**
 * What a fields card does with its empty fields: `show` (the default),
 * each with the empty text; `fold`, the filled ones first and an
 * "N empty" toggle that opens the rest, still edited in place.
 */
export type EntityViewEmptyFields = 'show' | 'fold'

export type EntityViewProps = {
  /** The record's name or title, the page's <h1>, and the browser tab's once it loads (`documentTitle`). */
  title?: string
  /**
   * The browser tab's name for this record once it has loaded: `title`
   * unless this says otherwise, read as "<this> · <app>" inside `AppShell`.
   * `false` leaves the tab to the nav ("Widgets · <app>"). Loading, an
   * error, and leaving the view all show the nav's title.
   */
  documentTitle?: string | false
  /** The title is editable in place; `label` is the field's ("Name"). */
  titleEdit?: EditInPlace & { label: string }
  /**
   * Left of the title, top-aligned with it: the record's mark or avatar
   * (an image, an icon, initials), at a size of the screen's own choosing
   * (`size-10` to `size-16`). The title, subtitle and badges sit beside it
   * at every width. Decorative unless it says something the title doesn't:
   * give an image `alt=""`.
   */
  leading?: ReactNode
  /**
   * A line under the title, in muted body type: what the record is for (a
   * goal, a one-line summary). Any markup, an `<EditableValue>` included,
   * so it can be edited in place where it's shown.
   */
  subtitle?: ReactNode
  /**
   * A few status-like values on the title's line, after it, as `<Badge>`s,
   * or as the control that changes one when the plan makes it a quick
   * action (a status `Select`, a yes/no `Switch`). A title too long for
   * them on its line pushes them to the next; `subtitle` stays below.
   */
  badges?: ReactNode
  /**
   * The header's actions: the record's own commands in words (New visit,
   * Mark done), then the universal ones as an `<IconAction>` (Delete, with
   * its confirm dialog, `tone="destructive"`). They follow Print notes.
   */
  actions?: ReactNode
  /**
   * A state that decides what you do with the record, said before
   * anything else (a `<Notice>`): under the header, across the page at
   * every width. Announced when it appears or changes after the page loads.
   */
  notice?: ReactNode
  /**
   * A row of the record's key numbers (`<KeyStats>`) under the header and
   * its notice, across the page at every width: in the rail layout above
   * both columns, so on a phone it comes before the rail and the main
   * column.
   */
  strip?: ReactNode
  sections: EntityViewSection[]
  /**
   * Below every section (both columns in the rail layout), in small muted
   * type outside any card: where the record's data comes from
   * (`<SourceCredit>`), when its source's terms ask for a credit.
   */
  footer?: ReactNode
  /** `rail` puts the sections placed `rail` in a column on the right. Defaults to `column`. */
  layout?: EntityViewLayout
  /**
   * In the `rail` layout, where its columns stack (a phone): the rail
   * before the main column (`rail-first`, the default), or the main column
   * straight after the header and its `strip` (`main-first`). Two columns
   * wide, the rail stays on the right either way. The `column` layout
   * ignores it.
   */
  mobileOrder?: EntityViewMobileOrder
  /**
   * The Print notes action's words, when a section is marked `print`: its
   * tooltip and accessible name as an icon, its text as `words`. Defaults
   * to "Print notes".
   */
  printLabel?: string
  /** Print notes as an icon (`icon`, the default since 4.81) or a button with its words (`words`). */
  printLook?: 'icon' | 'words'
  /** The rail's landmark name (its `<aside>`). Defaults to the title + " details". */
  railLabel?: string
  /**
   * In the `rail` layout, a rail section's fields: each label to the left
   * of its value (`beside`, the default since 4.81), falling back to
   * stacked where the rail is too narrow for both, or above it
   * (`stacked`). Once the rail's sections stack full width on a narrower
   * screen, labels sit beside values either way.
   */
  railFields?: EntityViewRailFields
  /**
   * Empty fields in a fields card (the rail's and the main column's):
   * shown with the empty text (`show`, the default), or folded (`fold`):
   * the card lists its filled fields, then "N empty" opens the rest in
   * their places, each still edited in place. A value set elsewhere moves
   * its field into the card.
   */
  emptyFields?: EntityViewEmptyFields
  /**
   * What an empty value reads as across the view (a field's or a block's
   * own `emptyLabel` wins): a dash by default, in the muted tone, read
   * by a screen reader as "Not set".
   */
  emptyText?: string
  isLoading: boolean
  /** A `notfound` error (including another user's record) shows "Not found" and a way back, never a retry. */
  error?: AppError | null
  onRetry?: () => void
  /** The entity's list: a link above the title, and the not-found state's way out. */
  back: { to: string; label: string }
}

// The view's empty text and whether fields cards fold their empty ones,
// for every section without threading them through each layout.
const EmptyContext = createContext<{ text: string; fold: boolean }>({ text: EMPTY_DASH, fold: false })

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

function OrEmpty({ value, emptyLabel }: { value: ReactNode; emptyLabel: string | undefined }) {
  const empty = useContext(EmptyContext)
  return isEmptyValue(value) ? <EmptyText text={emptyLabel ?? empty.text} /> : value
}

// A preset shows its own value unless the screen gives one.
const fieldValue = (field: EntityViewField) => (field.value !== undefined ? field.value : field.edit?.shown)

// Label beside value from `sm` up; below it (a phone) the label sits
// above its value, so nothing is squeezed into a narrow second column. In
// the rail the list's own width decides instead (a container query on the
// <dl>): label above value in the narrow rail, beside it once the rail's
// sections stack full width under the header.
// `railFields="beside"` (4.76) puts them side by side in the rail too,
// from an 18rem list (a rail card beside the main column is ~19rem
// inside), with a narrower label column, and stacked below that.
const FIELD_ROW = {
  page: 'sm:grid sm:grid-cols-[minmax(--spacing(32),--spacing(48))_1fr] sm:gap-6',
  rail: '@lg/fields:grid @lg/fields:grid-cols-[minmax(--spacing(32),--spacing(48))_1fr] @lg/fields:gap-6',
  railBeside:
    '@2xs/fields:grid @2xs/fields:grid-cols-[minmax(--spacing(24),--spacing(28))_minmax(0,1fr)] @2xs/fields:items-baseline @2xs/fields:gap-4 @2xs/fields:py-2.5 @lg/fields:grid-cols-[minmax(--spacing(32),--spacing(48))_1fr] @lg/fields:gap-6',
}

type FieldPlace = keyof typeof FIELD_ROW

function FieldRow({ field, place }: { field: EntityViewField; place: FieldPlace }) {
  const value = fieldValue(field)
  // An editable row is the target as a whole (4.88, F15/F18): the list's
  // row hover, its pencil at the end, a chevron on a phone.
  const editable = Boolean(field.edit)
  return (
    <div
      className={cn(
        'flex flex-col gap-1 py-3 first:pt-0 last:pb-0',
        FIELD_ROW[place],
        editable && cn(editRowClass, '-mx-2 px-2 first:pt-2 last:pb-2'),
      )}
      onClick={editable ? onEditRowClick : undefined}
    >
      <dt className="type-label text-muted-foreground">{field.label}</dt>
      <dd className="min-w-0 type-body break-words text-foreground">
        {field.edit ? (
          <EditableValue label={field.label} edit={field.edit} look="row">
            <OrEmpty value={value} emptyLabel={field.emptyLabel} />
          </EditableValue>
        ) : (
          <OrEmpty value={value} emptyLabel={field.emptyLabel} />
        )}
      </dd>
    </div>
  )
}

// A fields card's rows. Folded (`emptyFields="fold"`), the filled fields
// show and the empty ones wait behind "N empty", which opens them in their
// places (the card's order kept) and then reads "Hide empty". Whether a
// field is empty is read on every render, so one filled elsewhere joins
// the card at once.
function FieldList({ fields, inRail, place }: { fields: EntityViewField[]; inRail: boolean; place: FieldPlace }) {
  const empty = useContext(EmptyContext)
  const [open, setOpen] = useState(false)
  const listId = useId()
  const emptyCount = empty.fold ? fields.filter((field) => isEmptyValue(fieldValue(field))).length : 0
  const shown = emptyCount === 0 || open ? fields : fields.filter((field) => !isEmptyValue(fieldValue(field)))
  return (
    <div className="flex flex-col gap-3">
      {shown.length > 0 && (
        <dl id={listId} className={cn('flex flex-col divide-y divide-border', inRail && '@container/fields')}>
          {shown.map((field) => (
            <FieldRow key={field.label} field={field} place={place} />
          ))}
        </dl>
      )}
      {emptyCount > 0 && (
        <button
          type="button"
          data-slot="entity-view-empty-toggle"
          aria-expanded={open}
          aria-controls={shown.length > 0 ? listId : undefined}
          onClick={() => setOpen((was) => !was)}
          className="inline-flex w-fit items-center gap-1 rounded-sm type-label text-muted-foreground underline underline-offset-3 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:min-h-11"
        >
          {open ? 'Hide empty' : `${emptyCount} empty`}
          <ChevronDownIcon aria-hidden="true" className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
        </button>
      )}
    </div>
  )
}

function ViewSection({
  section,
  inRail = false,
  railFields = 'beside',
}: {
  section: EntityViewSection
  inRail?: boolean
  railFields?: EntityViewRailFields
}) {
  const headingId = useId()
  const empty = useContext(EmptyContext)
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
            <FieldList
              fields={section.fields}
              inRail={inRail}
              place={!inRail ? 'page' : railFields === 'beside' ? 'railBeside' : 'rail'}
            />
          ) : section.edit?.kind === 'list' ? (
            <div className="flex min-w-0 flex-col gap-2 type-body break-words text-foreground">
              {!isEmptyValue(section.content) && section.content}
              <EditableList label={section.title} edit={section.edit} emptyLabel={section.emptyLabel ?? empty.text} />
            </div>
          ) : (
            <div className="min-w-0 type-body break-words text-foreground">
              {section.edit ? (
                <EditableValue label={section.title} edit={section.edit}>
                  <OrEmpty value={section.content} emptyLabel={section.emptyLabel} />
                </EditableValue>
              ) : (
                <OrEmpty value={section.content} emptyLabel={section.emptyLabel} />
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
// DOM order (header, rail, main, or main first); from it, the grid puts the rail on the
// right of row 1 and main on its left, both starting under the header.
const RAIL_LAYOUT = {
  page: '@container/view flex min-w-0 flex-col gap-6',
  columns: 'flex flex-col gap-6 @4xl/view:grid @4xl/view:grid-cols-[minmax(0,1fr)_--spacing(88)] @4xl/view:items-start',
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
function EntityViewSkeleton({ layout, mobileOrder }: { layout: EntityViewLayout; mobileOrder: EntityViewMobileOrder }) {
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
    const main = (
      <div className={RAIL_LAYOUT.main}>
        <SkeletonCard rows={6} stacked={false} />
      </div>
    )
    return (
      <div className={RAIL_LAYOUT.page} data-state="loading" data-layout="rail">
        {header}
        <div className={RAIL_LAYOUT.columns}>
          {mobileOrder === 'main-first' && main}
          <div className={cn(RAIL_LAYOUT.rail, 'flex flex-col gap-6')}>
            <SkeletonCard rows={4} stacked />
          </div>
          {mobileOrder === 'rail-first' && main}
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

function Rail({
  label,
  sections,
  fields,
}: {
  label: string
  sections: EntityViewSection[]
  fields: EntityViewRailFields
}) {
  const [ref, fits] = useFitsWindow()
  return (
    <aside
      ref={ref}
      aria-label={label}
      data-fits={fits ? '' : undefined}
      className={cn(RAIL_LAYOUT.rail, RAIL_LAYOUT.sticky, 'flex min-w-0 flex-col gap-6')}
    >
      {sections.map((section) => (
        <ViewSection key={section.title} section={section} inRail railFields={fields} />
      ))}
    </aside>
  )
}

const TAB_PARAM = 'tab'

type ViewTab = { slug: string; name: string; sections: EntityViewSection[] }

// The main sections' tabs, in the order the sections first name them. Two
// names with one slug ("Notes", "notes") are one tab, under the first.
function tabsOf(sections: EntityViewSection[]) {
  const tabs: ViewTab[] = []
  for (const section of sections) {
    if (section.tab === undefined) continue
    const slug = entityViewTabSlug(section.tab)
    const tab = tabs.find((each) => each.slug === slug)
    if (tab) tab.sections.push(section)
    else tabs.push({ slug, name: section.tab, sections: [section] })
  }
  return tabs
}

// The tab list, under the sections with no tab, and every tab's sections
// (hidden but mounted unless selected). The selected tab is the address's,
// changed in place: the entry replaced, its state kept (a record over its
// list stays the dialog), the scroll where it was.
function MainTabs({ tabs, label }: { tabs: ViewTab[]; label: string }) {
  const location = useLocation()
  const navigate = useNavigate()
  const asked = new URLSearchParams(location.search).get(TAB_PARAM)
  const selected = tabs.find((tab) => tab.slug === asked)?.slug ?? tabs[0]!.slug
  const select = (slug: string) => {
    const params = new URLSearchParams(location.search)
    if (slug === tabs[0]!.slug) params.delete(TAB_PARAM)
    else params.set(TAB_PARAM, slug)
    const search = params.toString()
    void navigate(
      { pathname: location.pathname, search: search ? `?${search}` : '', hash: location.hash },
      { replace: true, state: location.state, preventScrollReset: true },
    )
  }
  return (
    <Tabs
      value={selected}
      onValueChange={(value) => select(String(value))}
      data-slot="entity-view-tabs"
      className="min-w-0 gap-6"
    >
      {/* Wider than the column (many tabs, a phone), the list scrolls
          sideways on its own, never the page. */}
      <TabsList
        variant="line"
        activateOnFocus
        aria-label={label}
        className="h-auto w-full max-w-full justify-start gap-1 overflow-x-auto overflow-y-hidden border-b border-border p-0 [scrollbar-width:thin]"
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.slug}
            value={tab.slug}
            className="h-9 flex-none px-3 text-muted-foreground group-data-horizontal/tabs:after:bottom-0 pointer-coarse:h-11 dark:text-muted-foreground"
          >
            {tab.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.slug} value={tab.slug} keepMounted className="flex min-w-0 flex-col gap-6 [font-size:inherit]">
          {tab.sections.map((section) => (
            <ViewSection key={section.title} section={section} />
          ))}
        </TabsContent>
      ))}
    </Tabs>
  )
}

export function EntityView({
  title,
  documentTitle,
  titleEdit,
  leading,
  subtitle,
  badges,
  actions,
  notice,
  strip,
  sections,
  footer,
  layout = 'column',
  mobileOrder = 'rail-first',
  railLabel,
  railFields = 'beside',
  emptyFields = 'show',
  emptyText = EMPTY_DASH,
  printLabel = 'Print notes',
  printLook = 'icon',
  isLoading,
  error,
  onRetry,
  back,
}: EntityViewProps) {
  // Editing in place: one store per view, and the leave-page prompt only
  // while a field is open (or one is always editable).
  const [store] = useState(() => new EditInPlaceStore())
  // Opened over its list (RecordDialogRoute): the heading names the dialog,
  // and the dialog's own bar replaces the back link.
  const dialog = useRecordDialog()
  const editing = useSyncExternalStore(
    store.subscribe,
    () => store.editing,
    () => store.editing,
  )
  useDocumentTitle(isLoading || error || documentTitle === false ? undefined : (documentTitle ?? title))

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
          {dialog ? (
            <Button size="sm" variant="outline" onClick={dialog.close}>
              Back to {back.label}
            </Button>
          ) : (
            <Button size="sm" variant="outline" nativeButton={false} render={<Link to={back.to} />}>
              Back to {back.label}
            </Button>
          )}
        </EmptyContent>
      </Empty>
    )
  }

  if (error) return <ErrorState error={error} onRetry={onRetry} />

  if (isLoading) return <EntityViewSkeleton layout={layout} mobileOrder={mobileOrder} />

  const printSections: EntityViewPrintSection[] = sections
    .filter((section) => section.print)
    .map((section) => ({
      title: section.title,
      ...('fields' in section
        ? {
            fields: section.fields.map((field) => ({
              label: field.label,
              value: field.value !== undefined ? field.value : field.edit?.shown,
            })),
          }
        : { content: section.content, emptyLabel: section.emptyLabel }),
      answerSpace: typeof section.print === 'object' && section.print.answerSpace === true,
    }))
  const printButton = printSections.length > 0 && (
    <PrintNotes label={printLabel} look={printLook} title={title} subtitle={subtitle} sections={printSections} />
  )
  const railSections = sections.filter((section) => section.placement === 'rail')
  const mainSections = sections.filter((section) => section.placement !== 'rail')
  // Tabs: a main section's `tab` (a rail one's is ignored, in either layout).
  const tabs = tabsOf(mainSections)
  const tabbed = (section: EntityViewSection) => section.placement !== 'rail' && section.tab !== undefined
  const tabList = tabs.length > 0 && <MainTabs tabs={tabs} label={`${title ?? 'Record'} sections`} />
  const main = (
    <div className={cn(RAIL_LAYOUT.main, railSections.length === 0 && RAIL_LAYOUT.mainAlone)}>
      {mainSections
        .filter((section) => !tabbed(section))
        .map((section) => (
          <ViewSection key={section.title} section={section} />
        ))}
      {tabList}
    </div>
  )

  return (
    <EditInPlaceContext.Provider value={store}>
    <EmptyContext.Provider value={{ text: emptyText, fold: emptyFields === 'fold' }}>
    <div
      className={layout === 'rail' ? RAIL_LAYOUT.page : 'flex max-w-4xl flex-col gap-6'}
      data-state="success"
      data-layout={layout}
    >
      {editing && <LeaveGuard store={store} />}
      {!dialog && <BackLink back={back} />}

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/* The title keeps at least 16rem beside the actions, which wrap
            under one another (right-aligned) rather than squeeze it: at
            36px buttons a record with many actions (eight) took the whole
            row and left the title 0px wide, a letter per line (4.63.2). */}
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:min-w-64 sm:gap-4">
        {leading && (
          <div data-slot="entity-view-leading" className="flex shrink-0 items-center">
            {leading}
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {/* The title's line: the title, then the status and badges after
              it, wrapping under a title too long for both. */}
          <div data-slot="entity-view-title-line" className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <h1 id={dialog?.titleId} className="min-w-0 max-w-full type-page-title break-words text-foreground">
              {titleEdit ? (
                <EditableValue label={titleEdit.label} edit={titleEdit} layout="inline" className="w-full">
                  {title}
                </EditableValue>
              ) : (
                title
              )}
            </h1>
            {badges && (
              <div data-slot="entity-view-badges" className="flex flex-wrap items-center gap-1.5">
                {badges}
              </div>
            )}
          </div>
          {subtitle && (
            <div data-slot="entity-view-subtitle" className="type-body break-words text-muted-foreground">
              {subtitle}
            </div>
          )}
        </div>
        </div>
        {(actions || printButton) && (
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
            {printButton}
            {actions}
          </div>
        )}
      </header>

      {/* Always rendered, so a notice that appears or changes later (a
          tick elsewhere on the page clears it) is announced; one there
          from the start is read in its place. Empty, it takes no gap. */}
      <div role="status" data-slot="entity-view-notice" className="empty:hidden">
        {notice}
      </div>

      {strip && <div data-slot="entity-view-strip">{strip}</div>}

      {layout === 'rail' ? (
        <div className={RAIL_LAYOUT.columns}>
          {mobileOrder === 'main-first' && main}
          {railSections.length > 0 && (
            <Rail label={railLabel ?? `${title ?? 'Record'} details`} sections={railSections} fields={railFields} />
          )}
          {mobileOrder === 'rail-first' && main}
        </div>
      ) : (
        <>
          {sections
            .filter((section) => !tabbed(section))
            .map((section) => (
              <ViewSection key={section.title} section={section} />
            ))}
          {tabList}
        </>
      )}

      {footer && (
        <footer data-slot="entity-view-footer" className="type-caption text-muted-foreground">
          {footer}
        </footer>
      )}
    </div>
    </EmptyContext.Provider>
    </EditInPlaceContext.Provider>
  )
}
