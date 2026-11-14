// A record's short facts (4.106, record standard A1): the values a
// facts rail beside the tabs may hold, and how each is drawn.
//
// A rail holds short values only, so a fact isn't free markup: it's one
// of a few kinds, each drawn the one way it fits on a line, and nothing
// long can be passed. A status (its StatusMark), short text (a date, a
// number, a person's name: one line, cut with its whole text on hover),
// a few short badges, a count (optionally a link to what it counts), a
// rating (stars, hearts or a step bar, as the list's cells draw it), an
// external link, and a link to another record, which must say it's
// short (`short: true`, a provider's name), since most linked records
// (a list of discussions, a log's entries) have long titles and belong in
// a tab. Anything else is a section with `fields` or `content`, in a tab
// or in Details, never the rail.
//
// The record's status (4.115, record standard A1): a fact marked
// `recordStatus: true` is drawn first, at the top of the rail (and of
// Details where the rail folds), whatever its place in `facts` and
// whichever rail section holds it. It's edited in place there (`edit`); a
// status that changes only through an action (closing a record records a
// date and a reason) stays read-only, with the action as a small button
// under it (`action`) and a `hint` saying why it can't be edited here.
import type { ReactElement, ReactNode } from 'react'
import { isValidElement, useLayoutEffect, useState } from 'react'
import { Link } from 'react-router'
import { ExternalLinkIcon } from 'lucide-react'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import type { StatusKind } from '@/lib/status-kinds'
import type { EditInPlace } from './edit-in-place'
import { FactList, FactListItem } from './fact-list'
import { RatingScore } from './rating-score'
import { StepBar } from './step-bar'
import type { IconComponent } from './icon-component'
import { StatusMark } from './status-mark'

/** What a fact holds: one of the short kinds a rail can draw. */
export type EntityViewFactValue =
  /** A status, drawn as its StatusMark; `word` is the status's own ("As needed"). */
  | { kind: 'status'; status: StatusKind; word?: string }
  /** Short text: a date, a number, a person's name. One line, cut with its whole text on hover. `null` is empty. */
  | { kind: 'text'; text: string | number | null | undefined }
  /** A few short labels (areas, tags) as badges, each with its icon if it has one (4.115). None is empty. */
  | { kind: 'badges'; items: readonly (string | EntityViewFactBadge)[] }
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
  /**
   * Several items (4.111): linked records, links out, or plain words, each
   * marked by its kind's `icon` or a bullet (FactList), so long titles
   * that wrap still read apart. An item with `to` links in the app, with
   * `href` out of it (a new tab), with neither is its words. None is empty.
   */
  | { kind: 'list'; items: readonly EntityViewFactListItem[] }
  /**
   * A rating (4.117), drawn as the list's cells draw it: `stars` (the
   * default) or `hearts` for a score out of `max` (RatingScore), `bar` for a
   * quality level of `max` steps (StepBar). `value` is how many are
   * filled; `null` is empty. Named "4 of 5" for a screen reader (with
   * `word` first when given: "High, 4 of 5"). `word` is shown after it.
   */
  | { kind: 'rating'; value: number | null | undefined; max?: number; look?: EntityViewFactRatingLook; word?: string }

/** How a `rating` fact draws its score. */
export type EntityViewFactRatingLook = 'stars' | 'hearts' | 'bar'

/** One item of a `list` fact. */
export type EntityViewFactListItem = {
  name: string
  /** A record in the app (`/discussions/3`). */
  to?: string
  /** A page out of the app, opening in a new tab. */
  href?: string
  /** Its kind's icon (the record standard's 4I); a bullet without one. */
  icon?: IconComponent
}

/** One item of a `badges` fact with an icon (4.115): the icon before its label, in the muted tone. */
export type EntityViewFactBadge = {
  label: string
  /** An icon component (a `LucideIcon`, an app's own mark) or a node drawn as it is. Decorative: the label says it. */
  icon?: IconComponent | ReactNode
}

/** A small button under a fact's value (4.115): "Close…" under a status that changes only through it. */
export type EntityViewFactAction = {
  /** The button's words ("Close…"; an ellipsis when it opens a dialog). */
  label: string
  /** Drawn before the words. */
  icon?: IconComponent
  /** What a click does, when `render` isn't given. */
  onClick?: () => void
  /**
   * The app's own action instead (one that opens its dialog), given the
   * button the fact would draw, so it can be the dialog's trigger with the
   * same look: `(button) => <CloseDialog trigger={button} />`, or
   * `<DialogTrigger render={button} />`. What it returns is drawn as it is.
   */
  render?: (button: ReactElement) => ReactNode
}

export type EntityViewFact = EntityViewFactValue & {
  label: string
  /** What an empty value reads as, for this fact. Defaults to the view's `emptyText`. */
  emptyLabel?: string
  /** Editable in place, as a field is (`inPlace.select`, `inPlace.date`); it's drawn by its kind at rest. */
  edit?: EditInPlace
  /**
   * The record's status (4.115): drawn first, at the top of the rail (or
   * of Details), whatever its place in `facts` or its section's among the
   * rail's. One per record; usually a `kind: 'status'` fact.
   */
  recordStatus?: boolean
  /**
   * A few words on the value (4.115), such as why it can't be edited here
   * ("Changes when the record is closed"). An info button after the value
   * shows it on hover and keyboard focus; a touch screen shows it as a
   * line under the value instead. A screen reader reads it with the value.
   */
  hint?: string
  /** A small button under the value (4.115), drawn in the rail and in Details alike. */
  action?: EntityViewFactAction
}

const LINK_CLASS =
  'rounded-sm font-medium text-link underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50'

// A badge item's icon in the muted tone a list's item icons have
// (FactList's marks): a component drawn at the badge's icon size, or the
// app's own node as it is.
function badgeIcon(icon: IconComponent | ReactNode) {
  // A component: a function, or a forwardRef or memo object (a LucideIcon); an element is a node.
  const isComponent = typeof icon === 'function' || (typeof icon === 'object' && icon !== null && !isValidElement(icon) && '$$typeof' in icon)
  const Icon = icon as IconComponent
  return (
    <span data-slot="entity-view-fact-badge-icon" aria-hidden="true" data-icon="inline-start" className="inline-flex shrink-0 text-muted-foreground">
      {isComponent ? <Icon aria-hidden="true" className="size-3" /> : (icon as ReactNode)}
    </span>
  )
}

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
          {fact.items.map((item, index) => {
            const { label, icon } = typeof item === 'string' ? { label: item, icon: undefined } : item
            return (
              <Badge key={`${index}:${label}`} variant="outline" className="max-w-full">
                {icon !== undefined && icon !== null && badgeIcon(icon)}
                <span className="min-w-0 truncate">{label}</span>
              </Badge>
            )
          })}
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
    case 'list':
      if (fact.items.length === 0) return null
      return (
        <FactList>
          {fact.items.map((item, index) => (
            <FactListItem key={`${index}:${item.name}`} icon={item.icon}>
              {item.to ? (
                <Link to={item.to} className={LINK_CLASS}>
                  {item.name}
                </Link>
              ) : item.href ? (
                <a href={item.href} target="_blank" rel="noreferrer" className={LINK_CLASS}>
                  {item.name}
                  <ExternalLinkIcon aria-hidden="true" className="ml-1 inline size-3.5 align-[-0.125em]" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              ) : (
                item.name
              )}
            </FactListItem>
          ))}
        </FactList>
      )
    case 'rating': {
      if (fact.value === null || fact.value === undefined) return null
      const max = fact.max ?? 5
      return fact.look === 'bar' ? (
        <StepBar value={fact.value} steps={max} word={fact.word} className="align-middle" />
      ) : (
        <RatingScore value={fact.value} max={max} glyph={fact.look === 'hearts' ? 'heart' : 'star'} word={fact.word} />
      )
    }
    case 'record':
      return (
        <Link to={fact.to} title={fact.name} className={cn(LINK_CLASS, 'inline-block max-w-full truncate align-bottom')}>
          {fact.name}
        </Link>
      )
  }
}

/** A facts section's facts as fields rows, for Details, the column and printing: the status first. */
export function factsAsFields(facts: readonly EntityViewFact[]) {
  return statusFirst(facts).map((fact) => ({
    label: fact.label,
    value: factValue(fact),
    emptyLabel: fact.emptyLabel,
    edit: fact.edit,
    hint: fact.hint,
    action: fact.action,
    recordStatus: fact.recordStatus,
  }))
}

// The status fact first, the rest in their order.
function statusFirst(facts: readonly EntityViewFact[]): readonly EntityViewFact[] {
  const at = facts.findIndex((fact) => fact.recordStatus)
  return at <= 0 ? facts : [facts[at], ...facts.slice(0, at), ...facts.slice(at + 1)]
}

/**
 * The sections with the one holding the status fact (4.115) moved before
 * the other sections that share its place (the rail, or a tab's
 * side), so the status is the first fact there. Nothing else moves.
 */
export function statusSectionFirst<T extends { placement?: string; tab?: string }>(sections: readonly T[]): T[] {
  const holds = (section: T) => 'facts' in section && (section as T & { facts: readonly EntityViewFact[] }).facts.some((fact) => fact.recordStatus)
  const at = sections.findIndex(holds)
  if (at < 0) return [...sections]
  const status = sections[at]
  const sameSpot = (section: T) => section.placement === status.placement && section.tab === status.tab
  const first = sections.findIndex(sameSpot)
  if (first === at) return [...sections]
  const rest = sections.filter((_, index) => index !== at)
  rest.splice(first, 0, status)
  return rest
}

/** The width the view needs for the facts rail beside its column: 60rem (the column ~40rem, a 300px rail, the gap). */
export const FACTS_RAIL_MIN_WIDTH = 960

/**
 * Whether the element's parent (the room the view has: the page's content
 * area, or a dialog's body) is at least `min` px wide. A ResizeObserver
 * measures it: its first report comes after layout and before paint, and
 * then on every resize, so the rail and the Details tab never flash.
 */
export function useWideParent<T extends HTMLElement>(enabled: boolean, min = FACTS_RAIL_MIN_WIDTH) {
  const [node, setNode] = useState<T | null>(null)
  const [wide, setWide] = useState(false)
  useLayoutEffect(() => {
    const parent = node?.parentElement
    if (!enabled || !parent || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setWide(parent.getBoundingClientRect().width >= min))
    observer.observe(parent)
    return () => observer.disconnect()
  }, [node, enabled, min])
  return [setNode, enabled && wide] as const
}
