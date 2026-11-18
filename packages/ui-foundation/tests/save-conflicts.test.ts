// Editing in place when another writer saved first (Roadmap 405, review
// F4): a save the server refuses with a 409 (AppError kind `conflict`) is
// a conflict, never a plain failure; nothing saves until the person picks;
// "Keep Mine" lays what's typed onto the latest value where it can.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppError } from '../src/api/contracts'
import {
  CONFLICT_MESSAGE,
  CONFLICT_REBASE_MESSAGE,
  EditInPlaceStore,
  OVERLAP_MESSAGE,
  type EditFieldConfig,
} from '../src/components/app/edit-in-place-store'
import { rebaseMarkdown } from '../src/lib/markdown-merge'

const PAUSE = 50
const CONFLICT: AppError = { kind: 'conflict', message: 'This note changed since you opened it.' }
const SERVER: AppError = { kind: 'server', message: 'Something went wrong.' }

afterEach(() => {
  vi.useRealTimers()
})

// An always-editable note whose saved value the test changes (a refetch).
function note(store: EditInPlaceStore, value: string, extra: Partial<EditFieldConfig> = {}) {
  const calls: { value: unknown; resolve: () => void; reject: (error: unknown) => void }[] = []
  const save = vi.fn(
    (sent: unknown) =>
      new Promise<unknown>((resolve, reject) => {
        calls.push({ value: sent, resolve: () => resolve(undefined), reject })
      }),
  )
  let current = value
  const rebase = (base: unknown, mine: unknown, theirs: unknown) =>
    rebaseMarkdown(base as string, mine as string, theirs as string)
  store.register('notes', () => ({ value: current, alwaysEditable: true, save, rebase, ...extra }))
  return { save, calls, setValue: (next: string) => (current = next) }
}

describe('a save refused with a 409', () => {
  it('is a conflict: the draft stays, nothing saves on the pause, leaving or saveAll, until the person picks', async () => {
    vi.useFakeTimers()
    const store = new EditInPlaceStore({ autosaveDelay: PAUSE })
    const notes = note(store, 'Para one.\n\nPara two.\n')
    store.change('notes', 'Para one. edit in A\n\nPara two.\n')
    await vi.advanceTimersByTimeAsync(PAUSE)
    notes.calls[0].reject(CONFLICT)
    await vi.advanceTimersByTimeAsync(0)

    expect(store.state('notes')).toMatchObject({
      status: 'open',
      conflict: true,
      error: CONFLICT_REBASE_MESSAGE,
      draft: 'Para one. edit in A\n\nPara two.\n',
    })
    store.change('notes', 'Para one. edit in A, more\n\nPara two.\n')
    await vi.advanceTimersByTimeAsync(PAUSE * 3)
    expect(await store.saveAll()).toBe(false)
    expect(notes.save).toHaveBeenCalledTimes(1)
    expect(store.dirty).toBe(true)
    expect(store.savesOnLeave).toBe(false)
  })

  it('"Keep Mine" lays what was typed onto the refetched value and saves that, showing it (revision)', async () => {
    vi.useFakeTimers()
    const store = new EditInPlaceStore({ autosaveDelay: PAUSE })
    const notes = note(store, 'Para one.\n\nPara two.\n')
    store.change('notes', 'Para one. edit in A\n\nPara two.\n')
    await vi.advanceTimersByTimeAsync(PAUSE)
    notes.calls[0].reject(CONFLICT)
    await vi.advanceTimersByTimeAsync(0)
    // The refetch the 409 started lands: the other writer's paragraph.
    notes.setValue('Para one.\n\nPara two.\n\nPara three ADDED IN TAB B.\n')
    expect(store.refresh('notes')).toBe(false)

    const kept = store.keepMine('notes')
    const both = 'Para one. edit in A\n\nPara two.\n\nPara three ADDED IN TAB B.\n'
    expect(store.state('notes')).toMatchObject({ draft: both, revision: 1, conflict: false })
    expect(notes.calls[1].value).toBe(both)
    notes.calls[1].resolve()
    expect(await kept).toBe(true)
    expect(store.dirty).toBe(false)
  })

  it('both changed the same paragraph: says so, saves nothing; Keep Mine again replaces theirs', async () => {
    const store = new EditInPlaceStore({ autosaveDelay: PAUSE })
    const notes = note(store, 'Para one.\n')
    store.change('notes', 'Para one, mine.\n')
    const first = store.commit('notes')
    notes.calls[0].reject(CONFLICT)
    await first
    notes.setValue('Para one, theirs.\n')
    store.refresh('notes')

    expect(await store.keepMine('notes')).toBe(false)
    expect(store.state('notes')).toMatchObject({ conflict: true, overlap: true, error: OVERLAP_MESSAGE, draft: 'Para one, mine.\n' })
    expect(notes.save).toHaveBeenCalledTimes(1)

    const kept = store.keepMine('notes')
    expect(notes.calls[1].value).toBe('Para one, mine.\n')
    notes.calls[1].resolve()
    expect(await kept).toBe(true)
  })

  it('"Show Saved" after a 409 shows the refetched value and sends nothing', async () => {
    const store = new EditInPlaceStore({ autosaveDelay: PAUSE })
    const notes = note(store, 'One.\n')
    store.change('notes', 'One, mine.\n')
    const first = store.commit('notes')
    notes.calls[0].reject(CONFLICT)
    await first
    notes.setValue('One, theirs.\n')
    store.refresh('notes')
    store.takeSaved('notes')
    expect(store.state('notes')).toMatchObject({ draft: 'One, theirs.\n', initial: 'One, theirs.\n' })
    expect(store.dirty).toBe(false)
    expect(notes.save).toHaveBeenCalledTimes(1)
  })

  it('a field opened by a click (no autosave) gets the conflict too, with the plain message when it has no rebase', async () => {
    const store = new EditInPlaceStore()
    const calls: { reject: (error: unknown) => void }[] = []
    store.register('name', () => ({
      value: 'Mouse',
      save: () => new Promise((_resolve, reject) => calls.push({ reject })),
    }))
    await store.start('name')
    store.change('name', 'Mouse Pro')
    const saved = store.commit('name')
    calls[0].reject(CONFLICT)
    expect(await saved).toBe(false)
    expect(store.state('name')).toMatchObject({ status: 'open', conflict: true, error: CONFLICT_MESSAGE, draft: 'Mouse Pro' })
    // Leaving it again doesn't push it through.
    expect(await store.commit('name')).toBe(false)
    expect(calls).toHaveLength(1)
  })

  it('any other refusal is a plain failure that typing again retries (negative control)', async () => {
    vi.useFakeTimers()
    const store = new EditInPlaceStore({ autosaveDelay: PAUSE })
    const notes = note(store, 'One.\n')
    store.change('notes', 'One two.\n')
    await vi.advanceTimersByTimeAsync(PAUSE)
    notes.calls[0].reject(SERVER)
    await vi.advanceTimersByTimeAsync(0)
    expect(store.state('notes')).toMatchObject({ error: 'Something went wrong.' })
    expect(store.state('notes')).not.toMatchObject({ conflict: true })
    store.change('notes', 'One two three.\n')
    await vi.advanceTimersByTimeAsync(PAUSE)
    expect(notes.save).toHaveBeenCalledTimes(2)
  })

  it('rebase: false keeps "Keep Mine" saving what was typed over theirs', async () => {
    const store = new EditInPlaceStore({ autosaveDelay: PAUSE })
    const notes = note(store, 'Para one.\n\nPara two.\n', { rebase: false })
    store.change('notes', 'Para one. mine\n\nPara two.\n')
    const first = store.commit('notes')
    notes.calls[0].reject(CONFLICT)
    await first
    expect(store.state('notes')).toMatchObject({ error: CONFLICT_MESSAGE })
    notes.setValue('Para one.\n\nPara two.\n\nTheirs.\n')
    store.refresh('notes')
    const kept = store.keepMine('notes')
    expect(notes.calls[1].value).toBe('Para one. mine\n\nPara two.\n')
    notes.calls[1].resolve()
    expect(await kept).toBe(true)
  })
})
