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
}

const CLOSED: EditFieldState = { status: 'closed' }

const sameAsJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Why a save failed, in words to show beside what was being saved. */
export function messageOf(error: unknown): string {
  if (error && typeof error === 'object' && 'kind' in error) return refusalReason(error as AppError)
  if (error instanceof Error) return error.message
  return 'The save failed. Try again.'
}

export class EditInPlaceStore {
  private configs = new Map<string, () => EditFieldConfig>()
  private states = new Map<string, EditFieldState>()
  private saving = new Map<string, Promise<boolean>>()
  private openKey: string | null = null
  private listeners = new Set<() => void>()

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
    return () => {
      this.configs.delete(key)
      this.states.delete(key)
      if (this.openKey === key) this.openKey = null
    }
  }

  state(key: string): EditFieldState {
    return this.states.get(key) ?? CLOSED
  }

  /** The field that's open, if any. */
  get open(): string | null {
    return this.openKey
  }

  /** Whether leaving the page now would lose something: a draft that isn't saved. */
  get dirty(): boolean {
    if (this.openKey === null) return false
    const state = this.state(this.openKey)
    if (state.status === 'closed') return false
    if (state.status === 'saving' || state.error !== null) return true
    const isEqual = this.configs.get(this.openKey)?.().isEqual ?? sameAsJson
    return !isEqual(state.draft, state.initial)
  }

  /**
   * Opens a field. The open one, if another, is saved first: if that
   * fails it stays open and this one doesn't, and this returns false.
   */
  async start(key: string): Promise<boolean> {
    if (this.openKey === key) return true
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

  /** The control's value changed. Ignored while saving: the field is read-only then. */
  change(key: string, draft: unknown) {
    const state = this.state(key)
    if (state.status !== 'open') return
    this.set(key, { ...state, draft })
  }

  /** The control can't produce a value to save as it stands (`null` once it can). */
  report(key: string, problem: string | null) {
    const state = this.state(key)
    if (state.status === 'closed' || state.problem === problem) return
    this.set(key, { ...state, problem })
  }

  /**
   * Saves the field (leaving it, Enter, a choice picked). Resolves true
   * once it's closed (saved, or unchanged), false if it stays open (the
   * schema refused it, or the save failed). `draft`, when given, is the
   * value to save (a choice saves the moment it's picked).
   */
  commit(key: string, draft?: unknown): Promise<boolean> {
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

  /** Esc: closes and shows the saved value again. Not while a save is in flight. */
  cancel(key: string) {
    const state = this.state(key)
    if (state.status !== 'open') return
    this.set(key, CLOSED)
  }

  /** Leaving the page anyway: whatever is open is dropped. */
  discard() {
    if (this.openKey !== null) this.cancel(this.openKey)
  }
}
