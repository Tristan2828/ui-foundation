// A record's short facts (4.106, record standard A1): the values a
// facts rail beside the tabs may hold, and how each is drawn.
//
// A rail holds short values only, so a fact isn't free markup: it's one
// of a few kinds, each drawn the one way it fits on a line, and nothing
// long can be passed. A status (its StatusMark), short text (a date, a
// number, a person's name: one line, cut with its whole text on hover),
// a few short badges, a count (optionally a link to what it counts), an
// external link, and a link to another record, which must say it's
// short (`short: true`, a provider's name), since most linked records
// (a list of discussions, a log's entries) have long titles and belong in
// a tab. Anything else is a section with `fields` or `content`, in a tab
// or in Details, never the rail.
import type { ReactNode } from 'react'
import { useLayoutEffect, useState } from 'react'
import { Link } from 'react-router'
import { ExternalLinkIcon } from 'lucide-react'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import type { StatusKind } from '@/lib/status-kinds'
import type { EditInPlace } from './edit-in-place'
import { StatusMark } from './status-mark'

/** What a fact holds: one of the short kinds a rail can draw. */
export type EntityViewFactValue =
  /** A status, drawn as its StatusMark; `word` is the status's own ("As needed"). */
  | { kind: 'status'; status: StatusKind; word?: string }
  /** Short text: a date, a number, a person's name. One line, cut with its whole text on hover. `null` is empty. */
  | { kind: 'text'; text: string | number | null | undefined }
  /** A few short labels (areas, tags) as badges. None is empty. */
  | { kind: 'badges'; items: readonly string[] }
  /** A count, and where it links to, if anywhere (`/discussions?provider=3`). */
  | { kind: 'count'; count: number; to?: string }
  /** A link out of the app, its words `name`, opening in a new tab. */
  | { kind: 'link'; href: string; name: string }
  /**
   * Another record, by a short `name` (a person's, a place's). `short: true`
   * says the app knows its titles are short: a record whose titles run
   * long (a discussion, a log entry) is a section in a tab instead.
   */
  | { kind: 'record'; name: string; to: string; short: true }

export type EntityViewFact = EntityViewFactValue & {
  label: string
  /** What an empty value reads as, for this fact. Defaults to the view's `emptyText`. */
  emptyLabel?: string
  /** Editable in place, as a field is (`inPlace.select`, `inPlace.date`); it's drawn by its kind at rest. */
  edit?: EditInPlace
}

const LINK_CLASS =
  'rounded-sm font-medium text-link underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50'

/** A fact as the view draws it: `null` when empty. */
export function factValue(fact: EntityViewFactValue): ReactNode {
  switch (fact.kind) {
    case 'status':
      return <StatusMark kind={fact.status}>{fact.word}</StatusMark>
    case 'text': {
      if (fact.text === null || fact.text === undefined || fact.text === '') return null
      const text = String(fact.text)
      return (
        <span data-slot="entity-view-fact-text" title={text} className="inline-block max-w-full truncate align-bottom tabular-nums">
          {text}
        </span>
      )
    }
    case 'badges':
      if (fact.items.length === 0) return null
      return (
        <span className="inline-flex max-w-full flex-wrap gap-1">
          {fact.items.map((item) => (
            <Badge key={item} variant="outline" className="max-w-full truncate">
              {item}
            </Badge>
          ))}
        </span>
      )
    case 'count':
      return fact.to ? (
        <Link to={fact.to} className={cn(LINK_CLASS, 'tabular-nums')}>
          {fact.count}
        </Link>
      ) : (
        <span className="tabular-nums">{fact.count}</span>
      )
    case 'link':
      return (
        <a href={fact.href} target="_blank" rel="noreferrer" className={cn(LINK_CLASS, 'inline-flex max-w-full items-center gap-1')}>
          <span className="truncate">{fact.name}</span>
          <ExternalLinkIcon aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )
    case 'record':
      return (
        <Link to={fact.to} title={fact.name} className={cn(LINK_CLASS, 'inline-block max-w-full truncate align-bottom')}>
          {fact.name}
        </Link>
      )
  }
}

/** A facts section's facts as fields rows, for Details, the column and printing. */
export function factsAsFields(facts: readonly EntityViewFact[]) {
  return facts.map((fact) => ({ label: fact.label, value: factValue(fact), emptyLabel: fact.emptyLabel, edit: fact.edit }))
}

/** The width the view needs for the facts rail beside its column: 60rem (the column ~40rem, a 300px rail, the gap). */
export const FACTS_RAIL_MIN_WIDTH = 960

/**
 * Whether the element's parent (the room the view has: the page's content
 * area, or a dialog's body) is at least `min` px wide. Measured before
 * paint and on every resize, so the rail and the Details tab never flash.
 */
export function useWideParent<T extends HTMLElement>(enabled: boolean, min = FACTS_RAIL_MIN_WIDTH) {
  const [node, setNode] = useState<T | null>(null)
  const [wide, setWide] = useState(false)
  useLayoutEffect(() => {
    const parent = node?.parentElement
    if (!enabled || !parent) {
      setWide(false)
      return
    }
    const measure = () => setWide(parent.getBoundingClientRect().width >= min)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [node, enabled, min])
  return [setNode, wide] as const
}
