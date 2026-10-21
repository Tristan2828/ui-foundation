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
import { CheckIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { cn } from 'cn'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
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
  /** Shown, not changeable. */
  readOnly?: boolean
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
  readOnly = false,
  className,
}: MultiPickProps<Id>) {
  const key = useId()
  const [filter, setFilter] = useState('')
  const [pending, setPending] = useState<ReadonlyMap<Id, Pending>>(() => new Map())
  const [refused, setRefused] = useState<ReadonlyMap<Id, string>>(() => new Map())
  const filterBox = useRef<HTMLInputElement>(null)
  const chips = useRef<HTMLDivElement>(null)
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

  const isPicked = (option: Id) => pending.get(option)?.picked ?? value.includes(option)
  const shown = options.filter((option) => isPicked(option.id)).map((option) => option.id)

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

  const toggle = (option: MultiPickOption<Id>, picked: boolean) => {
    if (!onPick) {
      // In the options' order, keeping any picked id with no option.
      const known = new Set(options.map((other) => other.id))
      onValueChange?.([
        ...options.filter((other) => (other.id === option.id ? picked : isPicked(other.id))).map((other) => other.id),
        ...value.filter((other) => !known.has(other)),
      ])
      return
    }
    setRefused((current) => without(current, option.id))
    setPending((current) => new Map(current).set(option.id, { picked, inFlight: (current.get(option.id)?.inFlight ?? 0) + 1 }))
    onPick(option.id, picked).then(
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

  const needle = filter.trim().toLowerCase()
  const visible = needle ? options.filter((option) => option.label.toLowerCase().includes(needle)) : options

  // Down from the box: into the chips, at the one the group would tab to.
  const onFilterKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'ArrowDown') return
    const items = [...(chips.current?.querySelectorAll<HTMLElement>('[data-slot="toggle-group-item"]') ?? [])]
    const target = items.find((item) => item.tabIndex === 0) ?? items[0]
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

  return (
    <div data-slot="multi-pick" className={cn('flex w-full min-w-0 flex-col gap-2', className)}>
      <Input
        ref={filterBox}
        id={id}
        type="search"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        onKeyDown={onFilterKeyDown}
        placeholder={placeholder}
        aria-label={`Filter ${label}`}
        aria-describedby={describedBy}
        autoComplete="off"
        readOnly={readOnly}
        className="max-w-xs"
      />
      {visible.length === 0 ? (
        <p className="type-caption text-muted-foreground">{options.length === 0 ? emptyText : 'No matches.'}</p>
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
          className="flex-wrap"
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
              >
                {option.icon && (
                  <span aria-hidden="true" className="inline-flex shrink-0">
                    {option.icon}
                  </span>
                )}
                {option.label}
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
      {refused.size > 0 && (
        <FieldError className="type-caption flex flex-col gap-0.5">
          {[...refused].map(([option, reason]) => (
            <span key={String(option)} id={errorId(option)}>
              {reason}
            </span>
          ))}
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
