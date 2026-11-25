// A record's short facts (record standard A1): the values a
// facts rail beside the tabs may hold, and how each is drawn.
//
// A rail holds short values only, so a fact isn't free markup: it's one
// of a few kinds, each drawn the one way it fits, and nothing long can
// be passed. A status (its StatusMark), short text (a date, a number, a
// person's name), an emoji (Noto's picture), a few short badges, a count (optionally a link to what it counts), a
// rating (stars, hearts or a step bar, as the list's cells draw it), an
// external link, and a link to another record, which must say it's
// short (`short: true`, a provider's name), since most linked records
// (a list of discussions, a log's entries) have long titles and belong in
// a tab. Anything else is a section with `fields` or `content`, in a tab
// or in Details, never the rail.
//
// Nothing in the rail is ever cut, at any Text Size: a value too long
// for its line (text, a badge, a link, a record, a list item) wraps onto
// another, a badge inside its badge, and unbroken text breaks anywhere.
// The same in Details where the rail folds. The rail grows with the text
// (`--facts-rail-width`: 300px, 375px at Large, 420px at Extra Large), so
// a short value still keeps one line beside its label.
//
// The record's status (record standard A1): a fact marked
// `recordStatus: true` is drawn first, at the top of the rail (and of
// Details where the rail folds), whatever its place in `facts` and
// whichever rail section holds it. It's edited in place there (`edit`); a
// status that changes only through an action (closing a record records a
// date and a reason) stays read-only, with the action as a small button
// under it (`action`) and a `hint` saying why it can't be edited here.
//
// A yes/no: `kind: 'switch'` is a switch on the value's line,
// toggled where it is (a click, Space or Enter), named by the fact's
// label. It's drawn the same in the rail and in Details where the rail
// folds. An `on`/`off` word after it says the state in words; both words
// keep their room, so a toggle moves nothing after it. While the save is
// in flight the switch shows the new state and is busy; a failed save
// puts it back. Printed, it's its word (or Yes/No).
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
import { FactSwitch } from './fact-extras'
import { Emoji } from './emoji'

/** What a fact holds: one of the short kinds a rail can draw. */
export type EntityViewFactValue =
  /** A status, drawn as its StatusMark; `word` is the status's own ("As needed"). */
  | { kind: 'status'; status: StatusKind; word?: string }
  /** Short text: a date, a number, a person's name. A long one wraps onto another line, never cut. `null` is empty. */
  | { kind: 'text'; text: string | number | null | undefined }
  /**
   * One emoji (`🎂`), drawn as Noto's picture (`<Emoji>`, `size-5`), named
   * by the emoji itself for a screen reader. Printed as the character.
   * `null` or `''` is empty.
   */
  | { kind: 'emoji'; emoji: string | null | undefined }
  /** A few short labels (areas, tags) as badges, each with its icon if it has one. None is empty. */
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
   * Several items: linked records, links out, or plain words, each
   * marked by its kind's `icon` or a bullet (FactList), so long titles
   * that wrap still read apart. An item with `to` links in the app, with
   * `href` out of it (a new tab), with neither is its words. None is empty.
   */
  | { kind: 'list'; items: readonly EntityViewFactListItem[] }
  /**
   * A rating, drawn as the list's cells draw it: `stars` (the
   * default) or `hearts` for a score out of `max` (RatingScore), `bar` for a
   * quality level of `max` steps (StepBar). `value` is how many are
   * filled; `null` is empty. Named "4 of 5" for a screen reader (with
   * `word` first when given: "High, 4 of 5"). `word` is shown after it.
   */
  | { kind: 'rating'; value: number | null | undefined; max?: number; look?: EntityViewFactRatingLook; word?: string }
  /**
   * A yes/no, toggled in place by a switch named by the fact's
   * label. `onCheckedChange` saves it: while a promise it returns is
   * pending the switch shows the new state and is busy, and if it rejects
   * the switch goes back. `on`/`off` are words after the switch ("Shared",
   * "Private"); give both or neither. `disabled` keeps it read-only (a
   * `hint` can say why). Never empty, so `emptyLabel` doesn't apply, and
   * it isn't an `edit` fact: the switch is its own editor.
   */
  | {
      kind: 'switch'
      checked: boolean
      onCheckedChange: (checked: boolean) => void | Promise<unknown>
      on?: string
      off?: string
      disabled?: boolean
    }

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

/** One item of a `badges` fact with an icon: the icon before its label, in the muted tone. */
export type EntityViewFactBadge = {
  label: string
  /** An icon component (a `LucideIcon`, an app's own mark) or a node drawn as it is. Decorative: the label says it. */
  icon?: IconComponent | ReactNode
  /**
   * The badge's tone, for a label that is a state ("Pinned",
   * "Overdue"): the outline badge in that tone's text colour, its icon
   * too. Neutral (the outline) unless set. The word still says it.
   */
  tone?: EntityViewFactBadgeTone
}

/** A badge item's tone: the design language's four, as outline badges. */
export type EntityViewFactBadgeTone = 'success' | 'warning' | 'info' | 'destructive'

const BADGE_TONE = {
  success: 'outline-success',
  warning: 'outline-warning',
  info: 'outline-info',
  destructive: 'outline-destructive',
} as const satisfies Record<EntityViewFactBadgeTone, string>

/** A small button under a fact's value: "Close…" under a status that changes only through it. */
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
   * The record's status: drawn first, at the top of the rail (or
   * of Details), whatever its place in `facts` or its section's among the
   * rail's. One per record; usually a `kind: 'status'` fact.
   */
  recordStatus?: boolean
  /**
   * A few words on the value, such as why it can't be edited here
   * ("Changes when the record is closed"). An info button after the value
   * shows it on hover and keyboard focus; a touch screen shows it as a
   * line under the value instead. A screen reader reads it with the value.
   */
  hint?: string
  /** A small button under the value, drawn in the rail and in Details alike. */
  action?: EntityViewFactAction
}

// Nothing in the rail is ever cut, at any Text Size (4.145): a value too
// long for its line wraps onto another, and unbroken text (a code, an
// address) breaks anywhere rather than running past the rail.
const NEVER_CUT_INLINE = 'wrap-anywhere'

const LINK_CLASS =
  'rounded-sm font-medium text-link underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50'

// A badge item's icon in the muted tone a list's item icons have
// (FactList's marks): a component drawn at the badge's icon size, or the
// app's own node as it is.
function badgeIcon(icon: IconComponent | ReactNode, toned = false) {
  // A component: a function, or a forwardRef or memo object (a LucideIcon); an element is a node.
  const isComponent = typeof icon === 'function' || (typeof icon === 'object' && icon !== null && !isValidElement(icon) && '$$typeof' in icon)
  const Icon = icon as IconComponent
  return (
    <span data-slot="entity-view-fact-badge-icon" aria-hidden="true" data-icon="inline-start" className={cn('inline-flex shrink-0', !toned && 'text-muted-foreground')}>
      {isComponent ? <Icon aria-hidden="true" className="size-3" /> : (icon as ReactNode)}
    </span>
  )
}

/**
 * A fact as the view draws it: `null` when empty. `label` names a control
 * the fact draws (a switch). `printed`: as the printout has it (an emoji
 * as its character, not Noto's picture).
 */
export function factValue(fact: EntityViewFactValue, label = '', printed = false): ReactNode {
  switch (fact.kind) {
    case 'emoji':
      if (!fact.emoji) return null
      return printed ? fact.emoji : <Emoji emoji={fact.emoji} label={fact.emoji} className="size-5" />
    case 'switch':
      return <FactSwitch fact={fact} label={label} />
    case 'status':
      return <StatusMark kind={fact.status}>{fact.word}</StatusMark>
    case 'text': {
      if (fact.text === null || fact.text === undefined || fact.text === '') return null
      const text = String(fact.text)
      return (
        <span data-slot="entity-view-fact-text" className={cn(NEVER_CUT_INLINE, 'tabular-nums')}>
          {text}
        </span>
      )
    }
    case 'badges':
      if (fact.items.length === 0) return null
      return (
        <span className="inline-flex max-w-full min-w-0 flex-wrap gap-1">
          {fact.items.map((item, index) => {
            const { label, icon, tone } = typeof item === 'string' ? { label: item, icon: undefined, tone: undefined } : item
            return (
              // A label longer than the rail wraps inside its badge, which
              // grows a line rather than cutting it.
              <Badge
                key={`${index}:${label}`}
                variant={tone ? BADGE_TONE[tone] : 'outline'}
                data-tone={tone}
                className="h-auto min-h-5 max-w-full shrink whitespace-normal"
              >
                {icon !== undefined && icon !== null && badgeIcon(icon, tone !== undefined)}
                <span className={cn('min-w-0', NEVER_CUT_INLINE)}>{label}</span>
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
        <a href={fact.href} target="_blank" rel="noreferrer" className={cn(LINK_CLASS, NEVER_CUT_INLINE)}>
          {fact.name}
          <ExternalLinkIcon aria-hidden="true" className="ml-1 inline size-3.5 align-[-0.125em]" />
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
        <Link to={fact.to} className={cn(LINK_CLASS, NEVER_CUT_INLINE)}>
          {fact.name}
        </Link>
      )
  }
}

/** A facts section's facts as fields rows, for Details, the column and printing: the status first. */
export function factsAsFields(facts: readonly EntityViewFact[], printed = false) {
  return statusFirst(facts).map((fact) => ({
    label: fact.label,
    value: factValue(fact, fact.label, printed),
    emptyLabel: fact.emptyLabel,
    // A switch is its own editor: an `edit` would wrap it in another.
    edit: fact.kind === 'switch' ? undefined : fact.edit,
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
 * The sections with the one holding the status fact moved before
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

/**
 * The width the view needs for the facts rail beside its column at
 * Regular: 60rem (the column ~40rem, the 300px rail, the gap). At the
 * large densities it grows by the rail's extra width and the gap's
 * (`factsRailMinWidth`).
 */
export const FACTS_RAIL_MIN_WIDTH = 960

// The column's share of FACTS_RAIL_MIN_WIDTH: what's left of 960 without
// Regular's 300px rail and its 24px gap (gap-6).
const FACTS_RAIL_COLUMN = FACTS_RAIL_MIN_WIDTH - 300 - 24

/**
 * The room the rail needs where `node` is, read from the density's own
 * `--facts-rail-width` and `--spacing` (the gap is `gap-6`): 960px at
 * Regular, 1041px at Large, about 1090px at Extra Large.
 */
export function factsRailMinWidth(node: Element) {
  const style = getComputedStyle(node)
  const rail = parseFloat(style.getPropertyValue('--facts-rail-width'))
  const spacing = style.getPropertyValue('--spacing').trim()
  const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  const step = spacing.endsWith('rem') ? parseFloat(spacing) * rootSize : parseFloat(spacing)
  if (!Number.isFinite(rail) || !Number.isFinite(step)) return FACTS_RAIL_MIN_WIDTH
  return FACTS_RAIL_COLUMN + rail + step * 6
}

/**
 * Whether the element's parent (the room the view has: the page's content
 * area, or a dialog's body) is wide enough for the facts rail: `min` px,
 * or by default the rail's room at the density in force
 * (`factsRailMinWidth`). A ResizeObserver measures it: its first report
 * comes after layout and before paint, and then on every resize, so the
 * rail and the Details tab never flash. A change of Text Size
 * (`data-density` on <html>) measures again.
 */
export function useWideParent<T extends HTMLElement>(enabled: boolean, min?: number) {
  const [node, setNode] = useState<T | null>(null)
  const [wide, setWide] = useState(false)
  useLayoutEffect(() => {
    const parent = node?.parentElement
    if (!enabled || !node || !parent || typeof ResizeObserver === 'undefined') return
    // Its layout width, not its box on screen: a dialog scaling in as it
    // opens reads ~5% narrow on screen, and the observer doesn't report
    // again when the scale ends, which left a rail that only just fits
    // (Extra Large's ~1,090px in a 70rem dialog) folded for good.
    const measure = () => setWide(parent.offsetWidth >= (min ?? factsRailMinWidth(node)))
    const observer = new ResizeObserver(measure)
    observer.observe(parent)
    const density = typeof MutationObserver === 'undefined' ? null : new MutationObserver(measure)
    density?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-density', 'class', 'style'] })
    return () => {
      observer.disconnect()
      density?.disconnect()
    }
  }, [node, enabled, min])
  return [setNode, enabled && wide] as const
}
