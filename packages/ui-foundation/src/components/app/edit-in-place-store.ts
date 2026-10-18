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
//   nothing is saved; its message shows after the pause.
// A field marked `alwaysEditable` is also open from the moment it joins:
// it's the value itself, never "the open field", so it never closes and
// opening another field leaves it alone.
import type { AppError } from '@/api/contracts'
import { refusalReason } from '@/hooks/use-record-update'

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
  /**
   * An autosaving field's save: in flight (the control stays editable),
   * or done with nothing typed since. Absent otherwise.
   */
  autosave?: 'saving' | 'saved'
  /** Counts the times an always-editable field started over from a value saved elsewhere (`refresh`). */
  revision?: number
}

/** How long typing has to stop before an autosaving field saves. */
export const AUTOSAVE_DELAY_MS = 1000

export type EditInPlaceStoreOptions = {
  /** The pause before an autosave, in ms. Defaults to AUTOSAVE_DELAY_MS. */
  autosaveDelay?: number
}

const CLOSED: EditFieldState = { status: 'closed' }

const sameAsJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Why a save failed, in words to show beside what was being saved. */
export function messageOf(error: unknown): string {
  if (error && typeof error === 'object' && 'kind' in error) return refusalReason(error as AppError)
  if (error instanceof Error) return error.message
  return 'The save failed. Try again.'
}

type InFlight = { promise: Promise<boolean>; draft: unknown }

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
    if (alwaysEditable) {
      this.always.add(key)
      this.set(key, { status: 'open', draft: value, initial: value, error: null, problem: null })
    }
    return () => {
      // A save still waiting for the pause goes now: the field is leaving,
      // not giving up what was typed.
      if (this.timers.has(key)) void this.flush(key)
      this.configs.delete(key)
      this.states.delete(key)
      if (this.openKey === key) this.openKey = null
      if (this.always.delete(key)) this.emit()
    }
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
    return this.openKey !== null || this.always.size > 0 || this.holds > 0
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
    return this.unsaved().length > 0
  }

  /** Whether everything unsaved saves on its own, so leaving can save it first rather than ask. */
  get savesOnLeave(): boolean {
    return this.unsaved().every((key) => this.autosaves(key))
  }

  private unsaved(): string[] {
    const keys = new Set(this.always)
    if (this.openKey !== null) keys.add(this.openKey)
    return [...keys].filter((key) => {
      const state = this.state(key)
      if (state.status === 'closed') return false
      if (state.status === 'saving' || this.autosaving.has(key) || state.error !== null) return true
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

    if (open.problem) {
      this.set(key, { ...open, error: open.problem })
      return Promise.resolve(false)
    }
    const isEqual = config.isEqual ?? sameAsJson
    if (isEqual(open.draft, open.initial)) {
      this.set(key, CLOSED)
      return Promise.resolve(true)
    }
    const parsed = config.schema ? config.schema.safeParse(open.draft) : { success: true as const, data: open.draft }
    if (!parsed.success) {
      this.set(key, { ...open, error: parsed.error.issues[0]?.message ?? 'Check this value.' })
      return Promise.resolve(false)
    }

    this.set(key, { ...open, status: 'saving', error: null })
    const save = config
      .save(parsed.data)
      .then(
        () => {
          this.set(key, CLOSED)
          return true
        },
        (error: unknown) => {
          this.set(key, { ...open, status: 'open', error: messageOf(error) })
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
      setTimeout(() => {
        this.timers.delete(key)
        void this.flush(key)
      }, this.autosaveDelay),
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
    if (state.problem) {
      this.set(key, { ...state, error: state.problem })
      return Promise.resolve(false)
    }
    const isEqual = config.isEqual ?? sameAsJson
    if (isEqual(state.draft, state.initial)) {
      if (state.error !== null) this.set(key, { ...state, error: null })
      return Promise.resolve(true)
    }
    const parsed = config.schema ? config.schema.safeParse(state.draft) : { success: true as const, data: state.draft }
    if (!parsed.success) {
      this.set(key, { ...state, error: parsed.error.issues[0]?.message ?? 'Check this value.' })
      return Promise.resolve(false)
    }

    const sent = state.draft
    this.set(key, { ...state, error: null, autosave: 'saving' })
    const promise = config
      .save(parsed.data)
      .then(
        () => {
          const now = this.state(key)
          if (now.status === 'open') {
            const status = isEqual(now.draft, sent) ? 'saved' : this.queued.has(key) ? 'saving' : undefined
            this.set(key, { ...now, initial: sent, error: null, autosave: status })
          }
          return true
        },
        (error: unknown) => {
          const now = this.state(key)
          if (now.status === 'open') this.set(key, { ...now, error: messageOf(error), autosave: undefined })
          return false
        },
      )
      .finally(() => this.autosaving.delete(key))
    this.autosaving.set(key, { promise, draft: sent })
    return promise
  }

  /**
   * Saves every autosaving field that holds something unsaved, now
   * (leaving the page). Resolves true once nothing unsaved is left.
   */
  async saveAll(): Promise<boolean> {
    const keys = this.unsaved().filter((key) => this.autosaves(key))
    const results = await Promise.all(keys.map((key) => this.flush(key)))
    return results.every(Boolean) && !this.dirty
  }

  /**
   * An always-editable field shows the saved value again when it changed
   * elsewhere (another tab, the form), but only while nothing of its own
   * is unsaved or saving. True when it did: the control starts over.
   */
  refresh(key: string): boolean {
    const state = this.state(key)
    const config = this.configs.get(key)?.()
    if (!this.always.has(key) || state.status !== 'open' || !config) return false
    if (this.timers.has(key) || this.autosaving.has(key) || state.error !== null) return false
    const isEqual = config.isEqual ?? sameAsJson
    if (!isEqual(state.draft, state.initial) || isEqual(config.value, state.initial)) return false
    const revision = (state.revision ?? 0) + 1
    this.set(key, { status: 'open', draft: config.value, initial: config.value, error: null, problem: null, revision })
    return true
  }

  /**
   * Esc: closes and shows the saved value again. Not while a save is in
   * flight, and never for an always-editable field.
   */
  cancel(key: string) {
    const state = this.state(key)
    if (state.status !== 'open' || this.always.has(key) || this.autosaving.has(key)) return
    this.clearTimer(key)
    this.set(key, CLOSED)
  }

  /** Leaving the page anyway: whatever is open is dropped, and nothing waiting to autosave is sent. */
  discard() {
    for (const key of [...this.timers.keys()]) this.clearTimer(key)
    if (this.openKey !== null) {
      if (this.autosaving.has(this.openKey)) this.set(this.openKey, CLOSED)
      else this.cancel(this.openKey)
    }
    for (const key of this.always) {
      const state = this.state(key)
      if (state.status === 'open') this.set(key, { ...state, draft: state.initial, error: null, autosave: undefined })
    }
  }
}
