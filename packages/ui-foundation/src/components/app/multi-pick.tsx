// A picker for a small set (up to about 25 options): every option shown
// at once as a toggle chip, with a box above that filters them. The
// control for a multi field whose options are few and all loaded (tags, a
// dozen categories), on a form and edited in place (cell-patterns.md
// "Editable value", "A small set"). A large set keeps MultiReference:
// typing searches the server.
//
// Which one is the app's choice, by the control it renders, not switched
// here by option count: the two save differently in place (each pick at
// once here, the whole set on leaving there) and load differently (every
// option here, a server search there), so a set crossing 25 would change
// how saving works under the user. The plan names the set small.
//
// - **Edited in place, each pick saves on its own** (`onPick`), like a
//   quick action (pattern 17): the chip shows the pick at once with a
//   spinner beside it until the server answers. A refusal puts that one
//   chip back, with its reason under the chips; picks still saving carry
//   on. Nothing is drafted, so leaving the field or Esc only closes it.
// - **On a form** (`onValueChange`): a click changes the value, saved
//   with the form.
// - Keyboard: the filter box first; Down goes to the chips, Left/Right
//   (Home/End) move along them, Up goes back to the box, and Space or
//   Enter toggles a chip.
// - Every multi-pick (4.88, the form standard's F13): the chips wrap at
//   every width, under the filter box. Past `limit` options (30) it shows
//   the picked ones and the first 30, then "Show all N"; a filter searches
//   them all. The options can be the app's list of records (its query's
//   rows as `{ id, label }`, `loading` while it loads), so a link to
//   several other records uses it too.
// - `onCreate` (4.102): when what's typed names no option, Create "<typed>"
//   shows under the chips (Enter in the box does the same when nothing
//   matches; Down reaches it when there are no chips). It calls the app's
//   `onCreate(name)`: its small create form with the name filled in, or a
//   save straight away. While that's out the button reads Creating
//   "<typed>"… (`aria-busy`), the box can't change, and an edit in place
//   holding this stays open (`data-edit-hold`). The option it resolves
//   with joins the chips and is picked (in place, saved as any pick is);
//   `null` (the form cancelled) changes nothing. A rejection shows its
//   reason under the chips and keeps what was typed, so Create can be
//   tried again. Either way the caret goes back to the box.
import { CheckIcon } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { namesRecord } from '@/lib/names-record'
import { messageOf } from './edit-in-place-store'

export type MultiPickOption<Id extends string | number> = {
  id: Id
  label: string
  /**
   * The icon or colour the app draws for this value elsewhere (its
   * category glyph in its categorical slot), shown before the label. Drawn
   * `aria-hidden`: the label names it.
   */
  icon?: ReactNode
}

export type MultiPickProps<Id extends string | number> = {
  /** Every option, in display order. */
  options: readonly MultiPickOption<Id>[]
  /**
   * The picked ids. Edited in place, the record's saved value
   * (`widget.tagIds`), not the control's `props.value`: nothing is drafted.
   */
  value: readonly Id[]
  /** On a form: the value changed. */
  onValueChange?: (value: Id[]) => void
  /**
   * Edited in place: saves one pick (`picked` true adds `id`, false removes
   * it), resolving once saved and rejecting with the AppError. Build it on
   * the record's latest value, so quick picks don't lose each other:
   * `(id, picked) => save((widget) => ({ tags: toggled(widget.tags, id, picked) }))`.
   */
  onPick?: (id: Id, picked: boolean) => Promise<unknown>
  /** The field's label: the chips' group is named by it, the filter box "Filter <label>". */
  'aria-label': string
  /** The id of a line under the control (an edit in place's status line). */
  'aria-describedby'?: string
  /** Id for the filter box, so a <FieldLabel htmlFor> labels it on a form. */
  id?: string
  /** The filter box's placeholder. */
  placeholder?: string
  /** Shown when there are no options at all. */
  emptyText?: string
  /**
   * How many options show before "Show all N": past it, the picked ones
   * and the first `limit`. Defaults to 30. A filter always searches them all.
   */
  limit?: number
  /** The options are still loading (the app's query of its records): "Loading…" in place of the chips. */
  loading?: boolean
  /** Shown, not changeable. */
  readOnly?: boolean
  /**
   * Offers Create "<typed>" when what's typed names no option (ignoring
   * case and spaces at the ends). Opens the app's create form with the
   * name, or saves it at once, and resolves with the new option, which is
   * then picked (in place, through `onPick`), or `null` when the form was
   * cancelled. Rejecting (with the AppError) shows the reason in the
   * picker, the typed name kept. The new option shows as a chip until the
   * app's `options` have it.
   */
  onCreate?: (name: string) => Promise<MultiPickOption<Id> | null>
  className?: string
}

// A pick on its way to the server: what the chip shows meanwhile, and how
// many of its saves are still out. Kept once they're all answered until
// the saved value next changes, so the chip doesn't flicker back between
// the save resolving and the record that holds it arriving.
type Pending = { picked: boolean; inFlight: number }

export function MultiPick<Id extends string | number>({
  options,
  value,
  onValueChange,
  onPick,
  'aria-label': label,
  'aria-describedby': describedBy,
  id,
  placeholder = 'Filter',
  emptyText = 'No options.',
  limit = 30,
  loading = false,
  readOnly = false,
  onCreate,
  className,
}: MultiPickProps<Id>) {
  const key = useId()
  const [filter, setFilter] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [pending, setPending] = useState<ReadonlyMap<Id, Pending>>(() => new Map())
  const [refused, setRefused] = useState<ReadonlyMap<Id, string>>(() => new Map())
  // Options made here that the app's `options` don't have yet.
  const [created, setCreated] = useState<readonly MultiPickOption<Id>[]>([])
  // The name Create is making, while the app's answer is out.
  const [creating, setCreating] = useState<string | null>(null)
  const [createFailed, setCreateFailed] = useState<string | null>(null)
  // Said to a screen reader once a created option is picked.
  const [announced, setAnnounced] = useState('')
  const filterBox = useRef<HTMLInputElement>(null)
  const chips = useRef<HTMLDivElement>(null)
  const createButton = useRef<HTMLButtonElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // The saved value moved (a save's record arrived): answered picks give
  // way to it. Picks still saving keep showing.
  const [seenValue, setSeenValue] = useState(value)
  if (seenValue !== value) {
    setSeenValue(value)
    if ([...pending.values()].some((entry) => entry.inFlight === 0))
      setPending(new Map([...pending].filter(([, entry]) => entry.inFlight > 0)))
  }

  // The app's options, then any made here that they don't have yet.
  const all = created.length === 0 ? options : [...options, ...created.filter((made) => !options.some((option) => option.id === made.id))]
  // What a create answered later reads: the value and picks by then.
  const latest = useRef({ value, pending })
  useLayoutEffect(() => {
    latest.current = { value, pending }
  })

  const isPicked = (option: Id) => pending.get(option)?.picked ?? value.includes(option)
  const shown = all.filter((option) => isPicked(option.id)).map((option) => option.id)

  const settle = (option: Id, ok: boolean) =>
    setPending((current) => {
      const entry = current.get(option)
      if (!entry) return current
      const next = new Map(current)
      const inFlight = entry.inFlight - 1
      // Refused with nothing else of this pick out: back to the saved value.
      if (!ok && inFlight === 0) next.delete(option)
      else next.set(option, { ...entry, inFlight })
      return next
    })

  // Edited in place: one pick saved on its own.
  const savePick = (option: MultiPickOption<Id>, picked: boolean, save: NonNullable<typeof onPick>) => {
    setRefused((current) => without(current, option.id))
    setPending((current) => new Map(current).set(option.id, { picked, inFlight: (current.get(option.id)?.inFlight ?? 0) + 1 }))
    save(option.id, picked).then(
      () => settle(option.id, true),
      (error: unknown) => {
        settle(option.id, false)
        const reason = `Couldn't ${picked ? 'add' : 'remove'} ${option.label}: ${messageOf(error)}`
        // Closed before the answer: the reason has nowhere else to show.
        if (mounted.current) setRefused((current) => new Map(current).set(option.id, reason))
        else toast.error(reason)
      },
    )
  }

  const toggle = (option: MultiPickOption<Id>, picked: boolean) => {
    if (!onPick) {
      // In the options' order, keeping any picked id with no option.
      const known = new Set(all.map((other) => other.id))
      onValueChange?.([
        ...all.filter((other) => (other.id === option.id ? picked : isPicked(other.id))).map((other) => other.id),
        ...value.filter((other) => !known.has(other)),
      ])
      return
    }
    savePick(option, picked, onPick)
  }

  const needle = filter.trim().toLowerCase()
  const matching = needle ? all.filter((option) => option.label.toLowerCase().includes(needle)) : all
  // A long set: the first `limit`, and any picked one past them, in the options' order.
  const capped = !needle && !showAll && all.length > limit
  const visible = capped ? matching.filter((option, index) => index < limit || isPicked(option.id)) : matching
  const hidden = all.length - visible.length

  const name = filter.trim()
  const offerCreate = Boolean(onCreate) && !readOnly && !loading && (creating !== null || (name !== '' && !namesRecord(all, name)))

  const create = () => {
    if (!onCreate || creating !== null || name === '') return
    setCreating(name)
    setCreateFailed(null)
    setAnnounced('')
    // The caret back in the box once the app's form has closed, so the
    // keyboard keeps its place: the Create button is gone after a create.
    // A form's dialog hands focus back as it closes, a few frames on, so
    // this waits (up to a second) while focus is still in something else.
    // After a refusal the caret stays on Create, to try again.
    const refocus = (created: boolean, frames = 60) =>
      requestAnimationFrame(() => {
        if (!mounted.current) return
        const at = document.activeElement
        if (at === null || at === document.body || (created && at === createButton.current)) filterBox.current?.focus()
        else if (!root.current?.contains(at) && frames > 0) refocus(created, frames - 1)
      })
    onCreate(name).then(
      (option) => {
        if (!mounted.current) {
          // Closed meanwhile: in place, the pick still saves.
          if (option && onPick) void onPick(option.id, true).catch((error: unknown) => toast.error(`Couldn't add ${option.label}: ${messageOf(error)}`))
          return
        }
        setCreating(null)
        if (option) {
          setCreated((current) => [...current.filter((made) => made.id !== option.id), option])
          setFilter('')
          setAnnounced(`${option.label} created and picked.`)
          const { value: now, pending: out } = latest.current
          if (!(out.get(option.id)?.picked ?? now.includes(option.id))) {
            if (onPick) savePick(option, true, onPick)
            else onValueChange?.([...now, option.id])
          }
        }
        refocus(option !== null)
      },
      (error: unknown) => {
        const reason = `Couldn't create "${name}": ${messageOf(error)}`
        if (!mounted.current) {
          toast.error(reason)
          return
        }
        setCreating(null)
        setCreateFailed(reason)
        refocus(false)
      },
    )
  }

  // Down from the box: into the chips, at the one the group would tab to
  // (Create, with no chips). Enter, when nothing matches, creates.
  const onFilterKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && offerCreate && visible.length === 0) {
      event.preventDefault()
      create()
      return
    }
    if (event.key !== 'ArrowDown') return
    const items = [...(chips.current?.querySelectorAll<HTMLElement>('[data-slot="toggle-group-item"]') ?? [])]
    const target = items.find((item) => item.tabIndex === 0) ?? items[0] ?? createButton.current
    if (!target) return
    event.preventDefault()
    target.focus()
  }
  const onChipsKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowUp') return
    event.preventDefault()
    filterBox.current?.focus()
  }

  const errorId = (option: Id) => `${key}-refused-${String(option)}`
  const createErrorId = `${key}-create-failed`

  return (
    <div
      ref={root}
      data-slot="multi-pick"
      // An edit in place holding this stays open while the app's create form is.
      data-edit-hold={creating !== null ? '' : undefined}
      className={cn('flex w-full min-w-0 flex-col gap-2', className)}
    >
      <Input
        ref={filterBox}
        id={id}
        type="search"
        value={filter}
        onChange={(event) => {
          setFilter(event.target.value)
          setCreateFailed(null)
        }}
        onKeyDown={onFilterKeyDown}
        placeholder={placeholder}
        aria-label={`Filter ${label}`}
        aria-describedby={describedBy}
        autoComplete="off"
        readOnly={readOnly || creating !== null}
        className="max-w-xs"
      />
      {loading ? (
        <p role="status" className="type-caption text-muted-foreground">
          Loading…
        </p>
      ) : visible.length === 0 ? (
        <p className="type-caption text-muted-foreground">{all.length === 0 && !needle ? emptyText : 'No matches.'}</p>
      ) : (
        <ToggleGroup
          ref={chips}
          multiple
          variant="outline"
          size="sm"
          spacing={1.5}
          value={shown.map(String)}
          disabled={readOnly}
          onKeyDown={onChipsKeyDown}
          aria-label={label}
          aria-describedby={describedBy}
          // Wraps at every width; a chip longer than the row ends in "…".
          className="w-full max-w-full min-w-0 flex-wrap"
        >
          {visible.map((option) => {
            const picked = isPicked(option.id)
            const saving = (pending.get(option.id)?.inFlight ?? 0) > 0
            return (
              <ToggleGroupItem
                key={option.id}
                value={String(option.id)}
                onPressedChange={(next) => toggle(option, next)}
                aria-busy={saving || undefined}
                aria-describedby={refused.has(option.id) ? errorId(option.id) : undefined}
                title={option.label}
                className="max-w-full min-w-0"
              >
                {option.icon && (
                  <span aria-hidden="true" className="inline-flex shrink-0">
                    {option.icon}
                  </span>
                )}
                <span className="min-w-0 truncate">{option.label}</span>
                {/* Always there, so nothing moves: saving, or picked. */}
                <span aria-hidden="true" className="inline-flex size-3.5 shrink-0 items-center justify-center">
                  {saving ? (
                    <Spinner className="size-3.5 text-muted-foreground" />
                  ) : (
                    picked && <CheckIcon className="size-3.5" />
                  )}
                </span>
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
      )}
      {!loading && capped && hidden > 0 && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto w-fit p-0"
          aria-label={`Show All ${all.length} ${label}`}
          onClick={() => setShowAll(true)}
        >
          Show All {all.length}
        </Button>
      )}
      {offerCreate && (
        <Button
          ref={createButton}
          type="button"
          variant="outline"
          size="sm"
          data-create=""
          // Not `disabled` while it's out, so the caret stays on it.
          aria-disabled={creating !== null || undefined}
          aria-busy={creating !== null || undefined}
          aria-describedby={createFailed ? createErrorId : undefined}
          onClick={create}
          className="w-fit max-w-full min-w-0"
        >
          {creating !== null && <Spinner aria-hidden="true" className="size-3.5" />}
          <span className="min-w-0 truncate">{creating !== null ? `Creating "${creating}"…` : `Create "${name}"`}</span>
        </Button>
      )}
      {/* Always there, so a screen reader hears the new pick arrive. */}
      <span role="status" className="sr-only">
        {announced}
      </span>
      {(refused.size > 0 || createFailed) && (
        <FieldError className="type-caption flex flex-col gap-0.5">
          {[...refused].map(([option, reason]) => (
            <span key={String(option)} id={errorId(option)}>
              {reason}
            </span>
          ))}
          {createFailed && <span id={createErrorId}>{createFailed}</span>}
        </FieldError>
      )}
    </div>
  )
}

function without<K, V>(map: ReadonlyMap<K, V>, key: K): ReadonlyMap<K, V> {
  if (!map.has(key)) return map
  const next = new Map(map)
  next.delete(key)
  return next
}
