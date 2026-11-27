// The rules of editing in place on a record's view, without React (so
// they're tested on their own, tests/edit-in-place-store.test.ts). One
// store per EntityView; each editable value is a field in it, and
// EditableValue is the React side.
//
// The rule behind every one: nothing typed is ever lost.
// - One field open at a time. Opening another saves the open one first;
//   if that save fails, it stays open and the other doesn't open.
// - Saving: an unchanged draft closes with no request. A draft the form's
//   schema rejects stays open with the schema's message, unsent. Otherwise
//   it's sent; the field stays open (read-only, "Saving…") until the
//   server agrees, then closes. Not optimistic.
// - A failed save keeps the field open with exactly the draft, and the
//   reason under it. Nothing reverts on its own; saving again retries.
// - Cancel (Esc) closes and puts the saved value back. Not while saving.
//
// A field marked `autosave` (long text, Notion-style) saves on its own:
// - About a second after typing stops (debounced), and at once on leaving
//   it. It stays open and editable while a save is in flight ("Saving…",
//   then "Saved"); the next save waits behind that one and always sends
//   the latest draft, so quick edits never cross or lose each other.
// - A failed save keeps the draft and the reason, as above; typing again
//   retries after the pause.
// - What's been saved stays saved: closing it (leaving, Esc) saves what's
//   left first. Nothing reverts.
// - A problem the control reports (rich text that can't round-trip) means
//   nothing is saved; it counts as unsaved at once (leaving asks), and its
//   message shows after the pause.
// - A field leaving the view mid-save (unmounted) still sends what was
//   typed after that save started: the last draft and its config go with
//   the save waiting behind it (`register`'s cleanup).
// - The saved value changing elsewhere (another tab, a phone, an AI chat)
//   shows at once in a field with nothing of its own unsaved, even with the
//   caret in it (`refresh`). Under unsaved typing it's a conflict: nothing
//   saves until the person picks theirs or the saved one (`keepMine`,
//   `takeSaved`). The server echoing a save back, even normalised
//   (trimmed), is not a change.
// - The server refusing a save because the record changed since the
//   version it was built on (a 409, AppError kind `conflict`: a writer this
//   tab hadn't heard from yet) is the same conflict: nothing was written,
//   and the record's query refetches (useRecordUpdate) so the latest value
//   arrives. Never a plain failure that saving again would push through.
// - "Keep mine" keeps both where it can: with a `rebase` (long text's is
//   block by block, rebaseMarkdown), what was typed is laid onto the latest
//   saved value, and the control shows the result as it saves. When both
//   changed the same part, it says so, and only a second "keep mine"
//   replaces the other one.
// A field marked `alwaysEditable` is also open from the moment it joins:
// it's the value itself, never "the open field", so it never closes and
// opening another field leaves it alone.
import { messageOf } from '@/lib/refusal'
import { flushPendingEdits } from '@/lib/pending-edits'

type SafeParse = (
  value: unknown,
) => { success: true; data: unknown } | { success: false; error: { issues: readonly { message: string }[] } }

/** What a field needs to edit in place, read fresh on every use. */
export type EditFieldConfig = {
  /** The saved value, as the control holds it (the form's value for the field). */
  value: unknown
  /** The form's zod schema for the field: a value it rejects never leaves the browser. */
  schema?: { safeParse: SafeParse }
  /** Sends the value (the schema's output). Resolves once saved; rejects with an AppError. */
  save: (value: unknown) => Promise<unknown>
  /** Whether the draft is still the saved value. Defaults to comparing as JSON. */
  isEqual?: (a: unknown, b: unknown) => boolean
  /** Saves on its own a pause after each change, staying editable while it saves. */
  autosave?: boolean
  /** Always open: the control is the value, with no click to open. Autosaves. */
  alwaysEditable?: boolean
  /**
   * Which of the value's own fields a refusal is about: given the schema's
   * error (`{ issues }`) or the save's rejection (the AppError), the
   * message for each field it names, keyed by the field's path inside the
   * value (`text`, `effort`). `null` or `{}` when it names none.
   */
  fieldErrors?: (cause: unknown) => Record<string, string> | null
  /**
   * "Keep mine" after a conflict: `mine` (what's typed, started from
   * `base`) laid onto `theirs` (the value saved elsewhere since), or null
   * when both changed the same part. Without it, "keep mine" saves what's
   * typed over theirs. Long text's default is `rebaseMarkdown`.
   */
  rebase?: ((base: unknown, mine: unknown, theirs: unknown) => unknown) | false
}

export type EditFieldState = { status: 'closed' } | OpenFieldState

export type OpenFieldState = {
  status: 'open' | 'saving'
  /** What the control shows: exactly what was typed. */
  draft: unknown
  /** The saved value when the field opened. */
  initial: unknown
  /** Why it can't save (the schema's or the server's words), shown under it. */
  error: string | null
  /** A problem the control reports itself (rich text that can't save as it stands). */
  problem: string | null
  /** The refusal's messages for the value's own fields (`fieldErrors`), shown on those fields. */
  fieldErrors?: Record<string, string> | null
  /**
   * An autosaving field's save: in flight (the control stays editable),
   * or done with nothing typed since. Absent otherwise.
   */
  autosave?: 'saving' | 'saved'
  /** Counts the times an always-editable field started over from a value saved elsewhere (`refresh`). */
  revision?: number
  /**
   * The saved value changed elsewhere while this held unsaved typing:
   * nothing saves until `keepMine` (save over it) or `takeSaved` (show it).
   * A save the server refused with a 409 (AppError kind `conflict`) sets
   * it too.
   */
  conflict?: boolean
  /**
   * "Keep mine" couldn't lay what's typed onto the value saved elsewhere:
   * both changed the same part. Another "keep mine" replaces theirs.
   */
  overlap?: boolean
}

/** How long typing has to stop before an autosaving field saves. */
export const AUTOSAVE_DELAY_MS = 1000

export type EditInPlaceStoreOptions = {
  /** The pause before an autosave, in ms. Defaults to AUTOSAVE_DELAY_MS. */
  autosaveDelay?: number
}

const CLOSED: EditFieldState = { status: 'closed' }

/** What a field shows when the saved value changed under unsaved typing. */
export const CONFLICT_MESSAGE =
  'This changed elsewhere (another tab, device or chat) since you started typing. Saving now replaces that.'

/** The conflict's message for a field that can keep both (a `rebase`): Keep Mine adds what's typed to it. */
export const CONFLICT_REBASE_MESSAGE =
  'This changed elsewhere (another tab, device or chat) since you started typing. Keep Mine adds your changes to it.'

/** "Keep mine" found both sides changed the same part. */
export const OVERLAP_MESSAGE =
  "Your changes and the ones saved elsewhere are in the same place, so both can't be kept. Keep Mine again replaces theirs; Show Saved drops yours."

function conflictMessage(config: EditFieldConfig | undefined) {
  return config?.rebase ? CONFLICT_REBASE_MESSAGE : CONFLICT_MESSAGE
}

/** Whether a save's rejection is the server's "changed since" (a 409, AppError kind `conflict`). */
export function isConflict(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { kind?: unknown }).kind === 'conflict')
}

// Line endings, trailing spaces on a line and blank lines at either end:
// what a backend commonly normalises in text it's sent.
function normalisedText(value: string) {
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim()
}

// How many of a field's last sent values still count as its own echo.
const ECHOES = 4

const sameAsJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

type InFlight = { promise: Promise<boolean>; draft: unknown }

// The refusal's messages for the value's own fields, or null for none.
function fieldErrorsOf(config: EditFieldConfig | undefined, cause: unknown): Record<string, string> | undefined {
  const found = config?.fieldErrors?.(cause)
  return found && Object.keys(found).length > 0 ? found : undefined
}

// Re-exported for the components that word a refusal beside the store's.
export { messageOf }

export class EditInPlaceStore {
  private configs = new Map<string, () => EditFieldConfig>()
  private states = new Map<string, EditFieldState>()
  private saving = new Map<string, Promise<boolean>>()
  private openKey: string | null = null
  private listeners = new Set<() => void>()
  // Autosaving fields: the pause before each save, the save in flight,
  // the one waiting behind it, and the fields that are always open.
  private readonly autosaveDelay: number
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  private autosaving = new Map<string, InFlight>()
  private queued = new Map<string, Promise<boolean>>()
  private always = new Set<string>()
  // Leaving the page, waiting for its saves: the leave prompt stays.
  private holds = 0
  // The saved value each field last saw (`refresh` tells a change from it),
  // and the values it last sent (their echo isn't a change elsewhere).
  private seen = new Map<string, unknown>()
  private sent = new Map<string, unknown[]>()
  // Saves of fields that left the view mid-save, still to send or land.
  private detached = new Set<Promise<boolean>>()
  // The page is hidden: an autosave doesn't wait for the pause.
  private hurried = false

  constructor(options: EditInPlaceStoreOptions = {}) {
    this.autosaveDelay = options.autosaveDelay ?? AUTOSAVE_DELAY_MS
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit() {
    for (const listener of this.listeners) listener()
  }

  private set(key: string, state: EditFieldState) {
    this.states.set(key, state)
    if (state.status === 'closed' && this.openKey === key) this.openKey = null
    this.emit()
  }

  /** A field joins the view. `config` is read fresh each time it's needed. */
  register(key: string, config: () => EditFieldConfig) {
    this.configs.set(key, config)
    const { alwaysEditable, value } = config()
    this.seen.set(key, value)
    if (alwaysEditable) {
      this.always.add(key)
      this.set(key, { status: 'open', draft: value, initial: value, error: null, problem: null })
    }
    return () => {
      // A rich-text editor reports its typing a pause after it stops
      // (src/lib/pending-edits.ts): asked for now, before this reads it.
      flushPendingEdits()
      const inFlight = this.autosaving.get(key)
      const state = this.state(key)
      const last = this.configs.get(key)?.()
      // With a save in flight, what was typed since goes once it lands,
      // from this draft and config: the field is gone by then.
      if (inFlight) {
        this.clearTimer(key)
        if (state.status === 'open' && last) this.sendDetached(inFlight, state, last)
      }
      // A save still waiting for the pause goes now: the field is leaving,
      // not giving up what was typed.
      else if (this.timers.has(key)) void this.flush(key)
      this.configs.delete(key)
      this.states.delete(key)
      this.seen.delete(key)
      this.sent.delete(key)
      if (this.openKey === key) this.openKey = null
      if (this.always.delete(key)) this.emit()
    }
  }

  // A field that left mid-save: once its save in flight settles, its last
  // draft is sent if it's newer than what that save held.
  private sendDetached(inFlight: InFlight, state: OpenFieldState, config: EditFieldConfig) {
    const isEqual = config.isEqual ?? sameAsJson
    const run: Promise<boolean> = inFlight.promise
      .then((saved) => {
        if (state.problem || state.conflict || isEqual(state.draft, inFlight.draft)) return saved
        const parsed = config.schema ? config.schema.safeParse(state.draft) : { success: true as const, data: state.draft }
        if (!parsed.success) return false
        return config.save(parsed.data).then(
          () => true,
          () => false,
        )
      })
      .finally(() => {
        this.detached.delete(run)
        this.emit()
      })
    this.detached.add(run)
    this.emit()
  }

  state(key: string): EditFieldState {
    return this.states.get(key) ?? CLOSED
  }

  /** The field that's open, if any. An always-editable one never counts. */
  get open(): string | null {
    return this.openKey
  }

  /**
   * Whether anything is being edited: a field open, one that always is, or
   * a move off the page waiting for its saves (`hold`).
   */
  get editing(): boolean {
    return this.openKey !== null || this.always.size > 0 || this.holds > 0 || this.detached.size > 0
  }

  /**
   * Keeps `editing` true until released: the leave prompt, saving on the
   * way out, stays mounted (and its blocked move with it) even when that
   * save closes the field.
   */
  hold(): () => void {
    this.holds += 1
    let released = false
    return () => {
      if (released) return
      released = true
      this.holds -= 1
      this.emit()
    }
  }

  /** Whether leaving the page now would lose something: a draft that isn't saved. */
  get dirty(): boolean {
    return this.unsaved().length > 0 || this.detached.size > 0
  }

  /**
   * Whether everything unsaved saves on its own, so leaving can save it
   * first rather than ask. A problem or a conflict can't: leaving asks at once.
   */
  get savesOnLeave(): boolean {
    return this.unsaved().every((key) => {
      const state = this.state(key)
      return this.autosaves(key) && !(state.status !== 'closed' && (state.problem || state.conflict))
    })
  }

  private unsaved(): string[] {
    const keys = new Set(this.always)
    if (this.openKey !== null) keys.add(this.openKey)
    return [...keys].filter((key) => {
      const state = this.state(key)
      if (state.status === 'closed') return false
      if (state.status === 'saving' || this.autosaving.has(key) || state.error !== null) return true
      // A reported problem is unsaved at once, not only after the pause.
      if (state.problem !== null || state.conflict) return true
      return !this.isEqual(key)(state.draft, state.initial)
    })
  }

  private isEqual(key: string) {
    return this.configs.get(key)?.().isEqual ?? sameAsJson
  }

  private autosaves(key: string): boolean {
    const config = this.configs.get(key)?.()
    return Boolean(config?.autosave || config?.alwaysEditable)
  }

  /**
   * Opens a field. The open one, if another, is saved first: if that
   * fails it stays open and this one doesn't, and this returns false.
   * An always-editable field is already open.
   */
  async start(key: string): Promise<boolean> {
    if (this.openKey === key || this.always.has(key)) return true
    if (this.openKey !== null) {
      const closed = await this.commit(this.openKey)
      if (!closed) return false
      // Another field may have opened while that save was in flight.
      if (this.openKey !== null && this.openKey !== key) return false
    }
    const config = this.configs.get(key)?.()
    if (!config) return false
    this.openKey = key
    this.seen.set(key, config.value)
    this.set(key, { status: 'open', draft: config.value, initial: config.value, error: null, problem: null })
    return true
  }

  /**
   * The control's value changed. Ignored while saving: the field is
   * read-only then. An autosaving field takes it even mid-save, and saves
   * once typing pauses.
   */
  change(key: string, draft: unknown) {
    const state = this.state(key)
    if (state.status !== 'open') return
    if (!this.autosaves(key)) {
      this.set(key, { ...state, draft })
      return
    }
    this.set(key, { ...state, draft, autosave: this.autosaving.has(key) ? 'saving' : undefined })
    this.schedule(key)
  }

  /** The control can't produce a value to save as it stands (`null` once it can). */
  report(key: string, problem: string | null) {
    const state = this.state(key)
    if (state.status === 'closed' || state.problem === problem) return
    this.set(key, { ...state, problem })
    // Autosaving: after the pause, the problem shows (nothing is saved),
    // or, once it's gone, the latest draft saves.
    if (state.status === 'open' && this.autosaves(key)) this.schedule(key)
  }

  /**
   * Saves the field (leaving it, Enter, a choice picked). Resolves true
   * once it's closed (saved, or unchanged), false if it stays open (the
   * schema refused it, or the save failed). `draft`, when given, is the
   * value to save (a choice saves the moment it's picked). An autosaving
   * field saves what's left at once; an always-editable one stays open,
   * and resolves true once what's on screen is saved.
   */
  commit(key: string, draft?: unknown): Promise<boolean> {
    flushPendingEdits()
    if (this.autosaves(key)) return this.commitAutosaved(key, draft)
    const inFlight = this.saving.get(key)
    if (inFlight) return inFlight
    let state = this.state(key)
    if (state.status === 'closed') return Promise.resolve(true)
    if (draft !== undefined && state.status === 'open') {
      state = { ...state, draft }
      this.set(key, state)
    }
    const open: OpenFieldState = state
    const config = this.configs.get(key)?.()
    if (!config) return Promise.resolve(false)

    if (open.problem || open.conflict) {
      this.set(key, { ...open, error: open.problem ?? open.error ?? conflictMessage(config) })
      return Promise.resolve(false)
    }
    const isEqual = config.isEqual ?? sameAsJson
    if (isEqual(open.draft, open.initial)) {
      this.set(key, CLOSED)
      return Promise.resolve(true)
    }
    const parsed = config.schema ? config.schema.safeParse(open.draft) : { success: true as const, data: open.draft }
    if (!parsed.success) {
      const fieldErrors = fieldErrorsOf(config, parsed.error)
      this.set(key, { ...open, error: parsed.error.issues[0]?.message ?? 'Check this value.', fieldErrors })
      return Promise.resolve(false)
    }

    this.set(key, { ...open, status: 'saving', error: null, fieldErrors: undefined })
    this.remember(key, open.draft)
    if (parsed.data !== open.draft) this.remember(key, parsed.data)
    const save = config
      .save(parsed.data)
      .then(
        () => {
          this.set(key, CLOSED)
          return true
        },
        (error: unknown) => {
          // Another writer saved since (a 409): nothing was written, and
          // nothing saves until the person picks.
          if (isConflict(error)) this.set(key, { ...open, status: 'open', conflict: true, error: conflictMessage(config) })
          else this.set(key, { ...open, status: 'open', error: messageOf(error), fieldErrors: fieldErrorsOf(config, error) })
          return false
        },
      )
      .finally(() => this.saving.delete(key))
    this.saving.set(key, save)
    return save
  }

  private async commitAutosaved(key: string, draft?: unknown): Promise<boolean> {
    if (this.state(key).status === 'closed') return true
    if (draft !== undefined) this.change(key, draft)
    const saved = await this.flush(key)
    const now = this.state(key)
    if (now.status === 'closed') return true
    // Typed again while that save was in flight: its own save follows.
    if (!saved || !this.isEqual(key)(now.draft, now.initial)) return false
    if (!this.always.has(key)) this.set(key, CLOSED)
    return true
  }

  private schedule(key: string) {
    this.clearTimer(key)
    this.timers.set(
      key,
      setTimeout(
        () => {
          this.timers.delete(key)
          void this.flush(key)
        },
        this.hurried ? 0 : this.autosaveDelay,
      ),
    )
  }

  /**
   * The page is hidden (another tab, a phone's home screen): while it
   * is, an autosave goes without the pause, and one waiting goes now.
   */
  hurry(hidden: boolean) {
    this.hurried = hidden
    if (hidden) for (const key of [...this.timers.keys()]) void this.flush(key)
  }

  // A value this field sent: its echo from the server isn't a change elsewhere.
  private remember(key: string, value: unknown) {
    this.sent.set(key, [...(this.sent.get(key) ?? []), value].slice(-ECHOES))
  }

  private isEcho(key: string, value: unknown, isEqual: (a: unknown, b: unknown) => boolean) {
    return (this.sent.get(key) ?? []).some(
      (sent) =>
        isEqual(value, sent) ||
        (typeof value === 'string' && typeof sent === 'string' && normalisedText(value) === normalisedText(sent)),
    )
  }

  private clearTimer(key: string) {
    clearTimeout(this.timers.get(key))
    this.timers.delete(key)
  }

  /**
   * Saves an autosaving field's latest draft now. With a save in flight,
   * it waits behind it (one save queued, however many changes), then
   * sends whatever the draft is by then. Resolves true once the draft it
   * sent is saved (or there was nothing to send).
   */
  private flush(key: string): Promise<boolean> {
    // Typing an editor holds back is reported first.
    flushPendingEdits()
    this.clearTimer(key)
    const inFlight = this.autosaving.get(key)
    if (inFlight) {
      let next = this.queued.get(key)
      if (!next) {
        next = inFlight.promise.then((saved) => {
          this.queued.delete(key)
          // A failed save isn't sent again as it was: only something new is.
          const now = this.state(key)
          if (!saved && now.status !== 'closed' && this.isEqual(key)(now.draft, inFlight.draft)) return false
          return this.flush(key)
        })
        this.queued.set(key, next)
      }
      return next
    }

    const state = this.state(key)
    if (state.status !== 'open') return Promise.resolve(state.status === 'closed')
    const config = this.configs.get(key)?.()
    if (!config) return Promise.resolve(false)
    if (state.problem || state.conflict) {
      this.set(key, { ...state, error: state.problem ?? state.error ?? conflictMessage(config) })
      return Promise.resolve(false)
    }
    const isEqual = config.isEqual ?? sameAsJson
    if (isEqual(state.draft, state.initial)) {
      if (state.error !== null) this.set(key, { ...state, error: null })
      return Promise.resolve(true)
    }
    const parsed = config.schema ? config.schema.safeParse(state.draft) : { success: true as const, data: state.draft }
    if (!parsed.success) {
      const fieldErrors = fieldErrorsOf(config, parsed.error)
      this.set(key, { ...state, error: parsed.error.issues[0]?.message ?? 'Check this value.', fieldErrors })
      return Promise.resolve(false)
    }

    const sent = state.draft
    this.remember(key, sent)
    if (parsed.data !== sent) this.remember(key, parsed.data)
    this.set(key, { ...state, error: null, fieldErrors: undefined, autosave: 'saving' })
    const promise = config
      .save(parsed.data)
      .then(
        () => {
          const now = this.state(key)
          if (now.status === 'open') {
            const status = isEqual(now.draft, sent) ? 'saved' : this.queued.has(key) ? 'saving' : undefined
            this.set(key, { ...now, initial: sent, error: null, fieldErrors: undefined, autosave: status })
          }
          return true
        },
        (error: unknown) => {
          const now = this.state(key)
          if (now.status !== 'open') return false
          // Another writer saved since (a 409): nothing was written, and
          // nothing saves until the person picks.
          if (isConflict(error)) {
            this.clearTimer(key)
            this.set(key, { ...now, conflict: true, overlap: false, error: conflictMessage(config), fieldErrors: undefined, autosave: undefined })
          } else this.set(key, { ...now, error: messageOf(error), fieldErrors: fieldErrorsOf(config, error), autosave: undefined })
          return false
        },
      )
      .finally(() => this.autosaving.delete(key))
    this.autosaving.set(key, { promise, draft: sent })
    return promise
  }

  /**
   * Saves an autosaving field's draft now, without waiting for the pause
   * (Ctrl/Cmd+S), and leaves it open. Resolves true once it's saved, or
   * there was nothing to save.
   */
  saveNow(key: string): Promise<boolean> {
    if (!this.autosaves(key)) return Promise.resolve(false)
    return this.flush(key)
  }

  /**
   * Saves every autosaving field that holds something unsaved, now
   * (leaving the page). Resolves true once nothing unsaved is left.
   */
  async saveAll(): Promise<boolean> {
    flushPendingEdits()
    const keys = this.unsaved().filter((key) => this.autosaves(key))
    const results = await Promise.all([...keys.map((key) => this.flush(key)), ...this.detached])
    return results.every(Boolean) && !this.dirty
  }

  /**
   * The field's saved value (its config's `value`) may have changed
   * elsewhere: another tab, a phone, an AI chat, the form. Call it whenever
   * the value changes. An open autosaving field with nothing of its own unsaved or
   * saving shows it, starting its control over (`revision`): true when it
   * did, so the caret can be put back. One with unsaved typing gets a
   * conflict (`conflict`, its message), and nothing saves until the person
   * picks. The field's own save coming back, as sent or as the server
   * normalised it (trimmed), is no change: the control keeps its text and
   * its undo.
   */
  refresh(key: string): boolean {
    // Typing an editor holds back counts as unsaved (a conflict, not a reload).
    flushPendingEdits()
    const state = this.state(key)
    const config = this.configs.get(key)?.()
    // Only a field that saves itself (notes): a field opened by a click
    // holds its draft until it's saved, and a control that saves each
    // pick itself (MultiPick) changes the value it shows while open.
    if (state.status === 'closed' || !config || !this.autosaves(key)) return false
    const isEqual = config.isEqual ?? sameAsJson
    const seen = this.seen.has(key) ? this.seen.get(key) : state.initial
    if (isEqual(config.value, seen)) return false
    this.seen.set(key, config.value)
    if (this.isEcho(key, config.value, isEqual) || isEqual(config.value, state.initial)) return false
    const busy = this.timers.has(key) || this.autosaving.has(key) || this.queued.has(key) || state.status === 'saving'
    const clean = !busy && state.error === null && state.problem === null && isEqual(state.draft, state.initial)
    if (!clean) {
      // Already a conflict ("keep mine" found an overlap): the new value is
      // what it's now against, and the person picks again.
      this.set(key, { ...state, conflict: true, overlap: false, error: conflictMessage(config) })
      return false
    }
    const revision = (state.revision ?? 0) + 1
    this.set(key, { status: 'open', draft: config.value, initial: config.value, error: null, problem: null, revision })
    return true
  }

  /**
   * The saved value changed under this field's unsaved typing, as a
   * server's conflict answer says. A save refused with a 409 (AppError
   * kind `conflict`) does this itself. Nothing saves until the person picks.
   */
  markConflict(key: string) {
    const state = this.state(key)
    if (state.status === 'closed') return
    this.clearTimer(key)
    this.set(key, { ...state, status: 'open', conflict: true, error: conflictMessage(this.configs.get(key)?.()), autosave: undefined })
  }

  /**
   * A conflict, answered "keep mine". With a `rebase`, what's typed is laid
   * onto the value saved elsewhere and the control starts over showing
   * both (`revision`) as it saves; if both changed the same part it stays
   * a conflict (`overlap`), and keeping mine again saves what's typed over
   * theirs. Without a `rebase`, what's typed saves over it. The save
   * carries the record's latest version, so a writer that saved again
   * meanwhile is another conflict, not an overwrite.
   */
  keepMine(key: string): Promise<boolean> {
    const state = this.state(key)
    const config = this.configs.get(key)?.()
    if (state.status !== 'open' || !state.conflict || !config) return Promise.resolve(false)
    let draft = state.draft
    let revision = state.revision
    if (config.rebase && !state.overlap) {
      const merged = config.rebase(state.initial, state.draft, config.value)
      if (merged === null || merged === undefined) {
        this.set(key, { ...state, overlap: true, error: OVERLAP_MESSAGE })
        return Promise.resolve(false)
      }
      if (!(config.isEqual ?? sameAsJson)(merged, state.draft)) {
        draft = merged
        revision = (state.revision ?? 0) + 1
      }
    }
    this.seen.set(key, config.value)
    this.set(key, { ...state, draft, revision, conflict: false, overlap: false, error: null, initial: config.value })
    return this.autosaves(key) ? this.flush(key) : this.commit(key)
  }

  /** A conflict, answered "show the saved one": what's typed goes, and the control starts over from the saved value. */
  takeSaved(key: string) {
    const state = this.state(key)
    const config = this.configs.get(key)?.()
    if (state.status !== 'open' || !state.conflict || !config) return
    this.clearTimer(key)
    const revision = (state.revision ?? 0) + 1
    this.set(key, { status: 'open', draft: config.value, initial: config.value, error: null, problem: null, revision })
  }

  /**
   * Esc: closes and shows the saved value again. Not while a save is in
   * flight, and never for an always-editable field.
   */
  cancel(key: string) {
    flushPendingEdits()
    const state = this.state(key)
    if (state.status !== 'open' || this.always.has(key) || this.autosaving.has(key)) return
    this.clearTimer(key)
    this.set(key, CLOSED)
  }

  /** Leaving the page anyway: whatever is open is dropped, and nothing waiting to autosave is sent. */
  discard() {
    // Reported now, so nothing held back lands after it's dropped.
    flushPendingEdits()
    for (const key of [...this.timers.keys()]) this.clearTimer(key)
    if (this.openKey !== null) {
      if (this.autosaving.has(this.openKey)) this.set(this.openKey, CLOSED)
      else this.cancel(this.openKey)
    }
    for (const key of this.always) {
      const state = this.state(key)
      if (state.status === 'open') this.set(key, { ...state, draft: state.initial, error: null, problem: null, conflict: false, overlap: false, autosave: undefined })
    }
  }
}
