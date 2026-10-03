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
// A value can be any markup, a control included, and `actions` takes any
// buttons: that's the room left for quick actions on this page (a toggle,
// a status change, ticking a checklist item) without the form.
import { useId, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowLeftIcon, SearchXIcon } from 'lucide-react'
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
}

/**
 * A titled card on the view: either label/value rows (`fields`), or one
 * block of content under the heading with no label of its own (`content`),
 * for long text (`<Markdown>`) or a sub-record list, where a label would
 * only repeat the heading. A block that's empty shows `emptyLabel`, the
 * same rule as a field.
 */
export type EntityViewSection =
  | {
      /** The section's heading (an <h2>). Unique on the page. */
      title: string
      fields: EntityViewField[]
    }
  | {
      title: string
      content: ReactNode
      emptyLabel?: string
    }

export type EntityViewProps = {
  /** The record's name or title, the page's <h1>. */
  title?: string
  /** A few status-like values beside the title, as `<Badge>`s. */
  badges?: ReactNode
  /** The header's actions: an Edit button, a Delete with its confirm dialog. */
  actions?: ReactNode
  sections: EntityViewSection[]
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
// above its value, so nothing is squeezed into a narrow second column.
function FieldRow({ field }: { field: EntityViewField }) {
  return (
    <div className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:grid sm:grid-cols-[minmax(8rem,12rem)_1fr] sm:gap-6">
      <dt className="type-label text-muted-foreground">{field.label}</dt>
      <dd className="min-w-0 type-body break-words text-foreground">{orEmptyLabel(field.value, field.emptyLabel)}</dd>
    </div>
  )
}

function ViewSection({ section }: { section: EntityViewSection }) {
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
            <dl className="flex flex-col divide-y divide-border">
              {section.fields.map((field) => (
                <FieldRow key={field.label} field={field} />
              ))}
            </dl>
          ) : (
            <div className="min-w-0 type-body break-words text-foreground">
              {orEmptyLabel(section.content, section.emptyLabel)}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

function EntityViewSkeleton() {
  return (
    <div className="flex max-w-4xl flex-col gap-6" data-state="loading">
      <Skeleton className="h-5 w-24" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="h-5 w-40" />
      </div>
      {Array.from({ length: 2 }, (_, section) => (
        <Card key={section}>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {Array.from({ length: 4 }, (_, row) => (
              <div key={row} className="flex flex-col gap-1 sm:flex-row sm:gap-6">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 flex-1" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function EntityView({
  title,
  badges,
  actions,
  sections,
  isLoading,
  error,
  onRetry,
  back,
}: EntityViewProps) {
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

  if (isLoading) return <EntityViewSkeleton />

  return (
    <div className="flex max-w-4xl flex-col gap-6" data-state="success">
      <BackLink back={back} />

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="type-page-title break-words text-foreground">{title}</h1>
          {badges && <div className="flex flex-wrap items-center gap-1.5">{badges}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </header>

      {sections.map((section) => (
        <ViewSection key={section.title} section={section} />
      ))}
    </div>
  )
}
