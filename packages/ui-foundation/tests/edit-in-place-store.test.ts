// The rules of editing in place (src/components/app/edit-in-place-store.ts):
// nothing typed is ever lost. A field's save is a promise the test settles
// by hand, like a server that answers when told.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { AppError } from '../src/api/contracts'
import { CONFLICT_MESSAGE, EditInPlaceStore, type EditFieldConfig } from '../src/components/app/edit-in-place-store'

function deferredSave() {
  const calls: { value: unknown; resolve: () => void; reject: (error: unknown) => void }[] = []
  const save = vi.fn(
    (value: unknown) =>
      new Promise<unknown>((resolve, reject) => {
        calls.push({ value, resolve: () => resolve(undefined), reject })
      }),
  )
  return { save, calls }
}

function field(store: EditInPlaceStore, key: string, config: Partial<EditFieldConfig> & Pick<EditFieldConfig, 'value'>) {
  const save = deferredSave()
  store.register(key, () => ({ save: save.save, ...config }))
  return save
}

const NAME_SCHEMA = z.string().trim().min(1, 'Name is required')
const UNPROCESSABLE: AppError = {
  kind: 'validation',
  message: 'Validation failed',
  fieldErrors: { name: ['A widget with this name already exists'] },
}

describe('editing in place', () => {
  it('an unchanged value closes with no request', async () => {
    const store = new EditInPlaceStore()
    const name = field(store, 'name', { value: 'Mouse', schema: NAME_SCHEMA })
    await store.start('name')
    store.change('name', 'Mouse!')
    store.change('name', 'Mouse')
    expect(await store.commit('name')).toBe(true)
    expect(name.save).not.toHaveBeenCalled()
    expect(store.state('name').status).toBe('closed')
  })

  it('saves the schema output, stays open read-only while saving, closes when the server agrees', async () => {
    const store = new EditInPlaceStore()
    const name = field(store, 'name', { value: 'Mouse', schema: NAME_SCHEMA })
    await store.start('name')
    store.change('name', '  Mouse Pro  ')
    const result = store.commit('name')
    expect(store.state('name')).toMatchObject({ status: 'saving', draft: '  Mouse Pro  ' })
    // Read-only while saving: typing doesn't reach the draft.
    store.change('name', 'something else')
    expect(store.state('name')).toMatchObject({ draft: '  Mouse Pro  ' })
    expect(name.calls[0].value).toBe('Mouse Pro')
    expect(store.dirty).toBe(true)

    name.calls[0].resolve()
    expect(await result).toBe(true)
    expect(store.state('name').status).toBe('closed')
    expect(store.dirty).toBe(false)
  })

  it('a failed save keeps the field open with exactly the draft and the reason, and retries', async () => {
    const store = new EditInPlaceStore()
    const name = field(store, 'name', { value: 'Mouse', schema: NAME_SCHEMA })
    await store.start('name')
    store.change('name', 'Keyboard')
    const first = store.commit('name')
    name.calls[0].reject(UNPROCESSABLE)
    expect(await first).toBe(false)
    expect(store.state('name')).toEqual({
      status: 'open',
      draft: 'Keyboard',
      initial: 'Mouse',
      error: 'A widget with this name already exists',
      problem: null,
    })
    expect(store.dirty).toBe(true)

    // Leaving again retries the same draft.
    const second = store.commit('name')
    expect(name.calls[1].value).toBe('Keyboard')
    name.calls[1].resolve()
    expect(await second).toBe(true)
  })

  it('a server error or no answer at all keeps the draft the same way', async () => {
    const store = new EditInPlaceStore()
    const name = field(store, 'name', { value: 'Mouse' })
    await store.start('name')
    store.change('name', 'Keyboard')
    const result = store.commit('name')
    name.calls[0].reject({ kind: 'network', message: 'Network error — check your connection and try again.' })
    expect(await result).toBe(false)
    expect(store.state('name')).toMatchObject({
      status: 'open',
      draft: 'Keyboard',
      error: 'Network error — check your connection and try again.',
    })
  })

  it("a value the schema rejects never leaves the browser, and shows the schema's message", async () => {
    const store = new EditInPlaceStore()
    const name = field(store, 'name', { value: 'Mouse', schema: NAME_SCHEMA })
    await store.start('name')
    store.change('name', '   ')
    expect(await store.commit('name')).toBe(false)
    expect(name.save).not.toHaveBeenCalled()
    expect(store.state('name')).toMatchObject({ status: 'open', draft: '   ', error: 'Name is required' })
  })

  it('Esc puts the saved value back, and does nothing while saving', async () => {
    const store = new EditInPlaceStore()
    const name = field(store, 'name', { value: 'Mouse' })
    await store.start('name')
    store.change('name', 'Keyboard')
    store.cancel('name')
    expect(store.state('name').status).toBe('closed')
    expect(name.save).not.toHaveBeenCalled()

    // Reopened, it starts from the saved value, not the dropped draft.
    await store.start('name')
    expect(store.state('name')).toMatchObject({ draft: 'Mouse' })
    store.change('name', 'Keyboard')
    const saving = store.commit('name')
    store.cancel('name')
    expect(store.state('name').status).toBe('saving')
    name.calls[0].resolve()
    await saving
  })

  it('opening a second field saves the first; if that save fails, the first stays open and the second does not open', async () => {
    const store = new EditInPlaceStore()
    const name = field(store, 'name', { value: 'Mouse' })
    const price = field(store, 'price', { value: '24.99' })
    await store.start('name')
    store.change('name', 'Keyboard')

    const opening = store.start('price')
    expect(store.state('name').status).toBe('saving')
    name.calls[0].reject(UNPROCESSABLE)
    expect(await opening).toBe(false)
    expect(store.open).toBe('name')
    expect(store.state('name')).toMatchObject({ status: 'open', draft: 'Keyboard' })
    expect(store.state('price').status).toBe('closed')
    expect(price.save).not.toHaveBeenCalled()
  })

  it('opening a second field once the first saves opens it', async () => {
    const store = new EditInPlaceStore()
    const name = field(store, 'name', { value: 'Mouse' })
    field(store, 'price', { value: '24.99' })
    await store.start('name')
    store.change('name', 'Keyboard')
    const opening = store.start('price')
    name.calls[0].resolve()
    expect(await opening).toBe(true)
    expect(store.open).toBe('price')
    expect(store.state('name').status).toBe('closed')
  })

  it('opening a second field closes an unchanged first with no request', async () => {
    const store = new EditInPlaceStore()
    const name = field(store, 'name', { value: 'Mouse' })
    field(store, 'price', { value: '24.99' })
    await store.start('name')
    expect(await store.start('price')).toBe(true)
    expect(name.save).not.toHaveBeenCalled()
    expect(store.state('name').status).toBe('closed')
  })

  it('a choice saves the value it was picked with', async () => {
    const store = new EditInPlaceStore()
    const status = field(store, 'status', { value: 'draft' })
    await store.start('status')
    const result = store.commit('status', 'active')
    expect(status.calls[0].value).toBe('active')
    status.calls[0].resolve()
    expect(await result).toBe(true)
  })

  it("a problem the control reports blocks the save and shows its message, and the draft stays", async () => {
    const store = new EditInPlaceStore()
    const notes = field(store, 'notes', { value: '# Notes' })
    await store.start('notes')
    store.change('notes', '# Notes\n\nMore')
    store.report('notes', "This text can't be saved without changing parts you didn't edit.")
    expect(await store.commit('notes')).toBe(false)
    expect(notes.save).not.toHaveBeenCalled()
    expect(store.state('notes')).toMatchObject({ draft: '# Notes\n\nMore', error: expect.stringContaining("can't be saved") })
  })

  it('leaving the page would lose an open, changed draft (dirty), not an unchanged one', async () => {
    const store = new EditInPlaceStore()
    field(store, 'name', { value: 'Mouse' })
    await store.start('name')
    expect(store.dirty).toBe(false)
    store.change('name', 'Keyboard')
    expect(store.dirty).toBe(true)
    store.discard()
    expect(store.dirty).toBe(false)
    expect(store.state('name').status).toBe('closed')
  })
})

// Autosave (long text, Notion-style): saved a pause after typing stops,
// editable all the while, one save at a time, the latest draft always.
describe('editing in place with autosave', () => {
  const PAUSE = 1000

  async function autosaving(config: Partial<EditFieldConfig> = {}) {
    vi.useFakeTimers()
    const store = new EditInPlaceStore({ autosaveDelay: PAUSE })
    const notes = field(store, 'notes', { value: 'One', autosave: true, ...config })
    await store.start('notes')
    return { store, notes }
  }

  // Lets settled saves' callbacks run.
  const settle = () => vi.advanceTimersByTimeAsync(0)

  afterEach(() => {
    vi.useRealTimers()
  })

  it('saves once, the last draft, a pause after typing stops, and stays open', async () => {
    const { store, notes } = await autosaving()
    store.change('notes', 'One t')
    await vi.advanceTimersByTimeAsync(PAUSE - 1)
    store.change('notes', 'One two')
    await vi.advanceTimersByTimeAsync(PAUSE - 1)
    expect(notes.save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(notes.save).toHaveBeenCalledTimes(1)
    expect(notes.calls[0].value).toBe('One two')
    expect(store.state('notes')).toMatchObject({ status: 'open', autosave: 'saving' })

    notes.calls[0].resolve()
    await settle()
    expect(store.state('notes')).toMatchObject({ status: 'open', draft: 'One two', initial: 'One two', autosave: 'saved' })
    expect(store.open).toBe('notes')
    expect(store.dirty).toBe(false)
  })

  it('stays editable while a save is in flight; the next save waits behind it and sends the latest draft', async () => {
    const { store, notes } = await autosaving()
    store.change('notes', 'One two')
    await vi.advanceTimersByTimeAsync(PAUSE)
    // Not read-only: typing reaches the draft mid-save.
    store.change('notes', 'One two three')
    expect(store.state('notes')).toMatchObject({ status: 'open', draft: 'One two three', autosave: 'saving' })
    store.change('notes', 'One two three four')
    await vi.advanceTimersByTimeAsync(PAUSE)
    // Queued, not sent alongside.
    expect(notes.save).toHaveBeenCalledTimes(1)
    store.change('notes', 'One two three four five')
    await vi.advanceTimersByTimeAsync(PAUSE)
    expect(notes.save).toHaveBeenCalledTimes(1)

    notes.calls[0].resolve()
    await settle()
    // One more save, of the draft as it is now.
    expect(notes.save).toHaveBeenCalledTimes(2)
    expect(notes.calls[1].value).toBe('One two three four five')
    expect(store.state('notes')).toMatchObject({ initial: 'One two', autosave: 'saving' })
    expect(store.dirty).toBe(true)
    notes.calls[1].resolve()
    await settle()
    expect(store.state('notes')).toMatchObject({ initial: 'One two three four five', autosave: 'saved' })
    expect(store.dirty).toBe(false)
  })

  it('latest wins: changes made while saving go out as one save, never an older draft after a newer one', async () => {
    const { store, notes } = await autosaving()
    store.change('notes', 'A')
    await vi.advanceTimersByTimeAsync(PAUSE)
    for (const draft of ['AB', 'ABC', 'ABCD']) {
      store.change('notes', draft)
      await vi.advanceTimersByTimeAsync(PAUSE)
    }
    notes.calls[0].resolve()
    await settle()
    expect(notes.calls.map((call) => call.value)).toEqual(['A', 'ABCD'])
  })

  it('a failed save keeps exactly what was typed and the reason; typing again retries after the pause', async () => {
    const { store, notes } = await autosaving()
    store.change('notes', 'One two')
    await vi.advanceTimersByTimeAsync(PAUSE)
    notes.calls[0].reject({ kind: 'network', message: 'Network error — check your connection and try again.' })
    await settle()
    expect(store.state('notes')).toEqual({
      status: 'open',
      draft: 'One two',
      initial: 'One',
      error: 'Network error — check your connection and try again.',
      problem: null,
      autosave: undefined,
    })
    expect(store.dirty).toBe(true)

    store.change('notes', 'One two!')
    await vi.advanceTimersByTimeAsync(PAUSE)
    expect(notes.calls[1].value).toBe('One two!')
    notes.calls[1].resolve()
    await settle()
    expect(store.state('notes')).toMatchObject({ error: null, autosave: 'saved' })
  })

  it('a save queued behind one that fails sends only something new, never the refused draft again', async () => {
    const { store, notes } = await autosaving()
    store.change('notes', 'One two')
    await vi.advanceTimersByTimeAsync(PAUSE)
    // Leaving mid-save queues a save behind it, with nothing new typed.
    const leaving = store.commit('notes')
    notes.calls[0].reject(UNPROCESSABLE)
    expect(await leaving).toBe(false)
    expect(notes.save).toHaveBeenCalledTimes(1)
    expect(store.state('notes')).toMatchObject({ status: 'open', draft: 'One two', error: 'A widget with this name already exists' })
  })

  it('leaving saves what is left at once, then closes; nothing reverts', async () => {
    const { store, notes } = await autosaving()
    store.change('notes', 'One two')
    const leaving = store.commit('notes')
    expect(notes.calls[0].value).toBe('One two')
    notes.calls[0].resolve()
    expect(await leaving).toBe(true)
    expect(store.state('notes').status).toBe('closed')
    // The pause that was running sends nothing more.
    await vi.advanceTimersByTimeAsync(PAUSE)
    expect(notes.save).toHaveBeenCalledTimes(1)
  })

  it('opening another field saves the autosaving one first, waiting out a save in flight', async () => {
    const { store, notes } = await autosaving()
    field(store, 'name', { value: 'Mouse' })
    store.change('notes', 'One two')
    await vi.advanceTimersByTimeAsync(PAUSE)
    store.change('notes', 'One two three')
    const opening = store.start('name')
    notes.calls[0].resolve()
    await settle()
    expect(notes.calls[1].value).toBe('One two three')
    notes.calls[1].resolve()
    expect(await opening).toBe(true)
    expect(store.open).toBe('name')
    expect(store.state('notes').status).toBe('closed')
  })

  it('a problem the control reports: nothing is saved, and its message shows after the pause', async () => {
    const { store, notes } = await autosaving()
    store.change('notes', 'One two')
    store.report('notes', "This text can't be saved without changing parts you didn't edit.")
    // Unsaved at once, not only after the pause, and leaving asks rather than saving (F5).
    expect(store.dirty).toBe(true)
    expect(store.savesOnLeave).toBe(false)
    await vi.advanceTimersByTimeAsync(PAUSE)
    expect(notes.save).not.toHaveBeenCalled()
    expect(store.state('notes')).toMatchObject({ draft: 'One two', error: expect.stringContaining("can't be saved") })
    expect(await store.commit('notes')).toBe(false)
    expect(notes.save).not.toHaveBeenCalled()

    // Once it can save again, the latest draft does, after the pause.
    store.report('notes', null)
    await vi.advanceTimersByTimeAsync(PAUSE)
    expect(notes.calls[0].value).toBe('One two')
  })

  it('a value the schema rejects is never sent, and says why after the pause', async () => {
    const { store, notes } = await autosaving({ schema: z.string().refine((value) => value.trim() !== '', 'Notes are required') })
    store.change('notes', '  ')
    await vi.advanceTimersByTimeAsync(PAUSE)
    expect(notes.save).not.toHaveBeenCalled()
    expect(store.state('notes')).toMatchObject({ error: 'Notes are required' })
  })

  it('dirty while a save waits for the pause or is in flight, clean once saved', async () => {
    const { store, notes } = await autosaving()
    store.change('notes', 'One two')
    expect(store.dirty).toBe(true)
    expect(store.savesOnLeave).toBe(true)
    await vi.advanceTimersByTimeAsync(PAUSE)
    // The draft is the one being sent, but it isn't saved until the server agrees.
    expect(store.dirty).toBe(true)
    notes.calls[0].resolve()
    await settle()
    expect(store.dirty).toBe(false)
  })

  it('leaving the page saves every autosaving field now; a field that does not autosave still asks', async () => {
    const { store, notes } = await autosaving()
    store.change('notes', 'One two')
    const saving = store.saveAll()
    expect(notes.calls[0].value).toBe('One two')
    notes.calls[0].resolve()
    expect(await saving).toBe(true)
    expect(store.dirty).toBe(false)

    field(store, 'name', { value: 'Mouse' })
    await store.start('name')
    store.change('name', 'Keyboard')
    expect(store.savesOnLeave).toBe(false)
  })

  it('discarding sends nothing that was waiting for the pause', async () => {
    const { store, notes } = await autosaving()
    store.change('notes', 'One two')
    store.discard()
    await vi.advanceTimersByTimeAsync(PAUSE)
    expect(notes.save).not.toHaveBeenCalled()
    expect(store.dirty).toBe(false)
  })

  it('a problem reported with nothing typed still counts as unsaved at once (negative control: none, clean)', async () => {
    const { store } = await autosaving()
    expect(store.dirty).toBe(false)
    store.report('notes', "This text can't be saved without changing parts you didn't edit.")
    expect(store.dirty).toBe(true)
    store.report('notes', null)
    expect(store.dirty).toBe(false)
  })

  it('a field leaving mid-save still sends what was typed after that save started (F3)', async () => {
    vi.useFakeTimers()
    const store = new EditInPlaceStore({ autosaveDelay: PAUSE })
    const save = deferredSave()
    const unregister = store.register('notes', () => ({ value: 'Start.', autosave: true, save: save.save }))
    await store.start('notes')
    store.change('notes', 'Start. A')
    await vi.advanceTimersByTimeAsync(PAUSE)
    expect(save.calls).toHaveLength(1)
    store.change('notes', 'Start. A B-typed-during-save')
    unregister()
    // Leaving the view doesn't end the job: it's still unsaved until sent.
    expect(store.dirty).toBe(true)
    save.calls[0].resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(save.calls).toHaveLength(2)
    expect(save.calls[1].value).toBe('Start. A B-typed-during-save')
    save.calls[1].resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(store.dirty).toBe(false)
  })

  it('a field leaving mid-save with nothing typed since sends nothing more (negative control)', async () => {
    vi.useFakeTimers()
    const store = new EditInPlaceStore({ autosaveDelay: PAUSE })
    const save = deferredSave()
    const unregister = store.register('notes', () => ({ value: 'Start.', autosave: true, save: save.save }))
    await store.start('notes')
    store.change('notes', 'Start. A')
    await vi.advanceTimersByTimeAsync(PAUSE)
    unregister()
    save.calls[0].resolve()
    await vi.advanceTimersByTimeAsync(PAUSE)
    expect(save.calls).toHaveLength(1)
  })

  it('a field leaving the page with a save waiting for the pause sends it at once', async () => {
    vi.useFakeTimers()
    const store = new EditInPlaceStore({ autosaveDelay: PAUSE })
    const save = deferredSave()
    const unregister = store.register('notes', () => ({ value: 'One', autosave: true, save: save.save }))
    await store.start('notes')
    store.change('notes', 'One two')
    unregister()
    expect(save.calls[0].value).toBe('One two')
  })
})

describe('an always-editable field', () => {
  const PAUSE = 1000

  afterEach(() => {
    vi.useRealTimers()
  })

  function always(store: EditInPlaceStore, value = 'One') {
    const save = deferredSave()
    let current = value
    const unregister = store.register('notes', () => ({ value: current, alwaysEditable: true, save: save.save }))
    return { ...save, unregister, setValue: (next: string) => (current = next) }
  }

  it('is open from the start, without being the open field, and autosaves', async () => {
    vi.useFakeTimers()
    const store = new EditInPlaceStore({ autosaveDelay: PAUSE })
    const notes = always(store)
    expect(store.state('notes')).toMatchObject({ status: 'open', draft: 'One', initial: 'One' })
    expect(store.open).toBeNull()
    expect(store.editing).toBe(true)
    store.change('notes', 'One two')
    await vi.advanceTimersByTimeAsync(PAUSE)
    expect(notes.calls[0].value).toBe('One two')
    notes.calls[0].resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(store.state('notes')).toMatchObject({ status: 'open', autosave: 'saved' })
  })

  it('never closes: leaving it saves and it stays; Esc does nothing; other fields open beside it', async () => {
    const store = new EditInPlaceStore({ autosaveDelay: PAUSE })
    const notes = always(store)
    field(store, 'name', { value: 'Mouse' })
    store.change('notes', 'One two')
    const leaving = store.commit('notes')
    notes.calls[0].resolve()
    expect(await leaving).toBe(true)
    expect(store.state('notes').status).toBe('open')
    store.cancel('notes')
    expect(store.state('notes').status).toBe('open')

    expect(await store.start('name')).toBe(true)
    expect(store.open).toBe('name')
    expect(store.state('notes').status).toBe('open')
  })

  it('counts toward leaving the page while unsaved', () => {
    const store = new EditInPlaceStore({ autosaveDelay: PAUSE })
    always(store)
    expect(store.dirty).toBe(false)
    store.change('notes', 'One two')
    expect(store.dirty).toBe(true)
    expect(store.savesOnLeave).toBe(true)
    store.discard()
    expect(store.dirty).toBe(false)
  })

  it('shows a value saved elsewhere at once while nothing of its own is unsaved', async () => {
    const store = new EditInPlaceStore({ autosaveDelay: PAUSE })
    const notes = always(store)
    store.change('notes', 'One two')
    const saved = store.commit('notes')
    notes.calls[0].resolve()
    await saved
    // Its own save, echoed back, isn't a change.
    notes.setValue('One two')
    expect(store.refresh('notes')).toBe(false)
    expect(store.state('notes')).not.toHaveProperty('revision')
    notes.setValue('Changed elsewhere')
    expect(store.refresh('notes')).toBe(true)
    expect(store.state('notes')).toMatchObject({ draft: 'Changed elsewhere', initial: 'Changed elsewhere', revision: 1 })
  })

  it('a value saved elsewhere under unsaved typing is a conflict: nothing saves until the person picks (F4)', async () => {
    vi.useFakeTimers()
    const store = new EditInPlaceStore({ autosaveDelay: PAUSE })
    const notes = always(store, 'Para one.\n\nPara two.')
    store.change('notes', 'Para one. edit in A\n\nPara two.')
    notes.setValue('Para one.\n\nPara two.\n\nPara three ADDED IN TAB B.')
    expect(store.refresh('notes')).toBe(false)
    expect(store.state('notes')).toMatchObject({ conflict: true, error: CONFLICT_MESSAGE, draft: 'Para one. edit in A\n\nPara two.' })
    // The pause, leaving the field, leaving the page: none of them saves over it.
    await vi.advanceTimersByTimeAsync(PAUSE)
    expect(await store.commit('notes')).toBe(false)
    expect(await store.saveAll()).toBe(false)
    expect(notes.save).not.toHaveBeenCalled()
    expect(store.dirty).toBe(true)
    expect(store.savesOnLeave).toBe(false)

    // "Keep mine" saves what's typed over it.
    const kept = store.keepMine('notes')
    expect(notes.calls[0].value).toBe('Para one. edit in A\n\nPara two.')
    notes.calls[0].resolve()
    expect(await kept).toBe(true)
    expect(store.state('notes')).toMatchObject({ conflict: false, error: null })
  })

  it('a conflict answered "show the saved one" starts over from it and sends nothing', async () => {
    const store = new EditInPlaceStore({ autosaveDelay: PAUSE })
    const notes = always(store)
    store.change('notes', 'One mine')
    notes.setValue('One theirs')
    store.refresh('notes')
    store.takeSaved('notes')
    expect(store.state('notes')).toMatchObject({ draft: 'One theirs', initial: 'One theirs', revision: 1 })
    expect(store.state('notes')).not.toHaveProperty('conflict')
    expect(store.dirty).toBe(false)
    expect(notes.save).not.toHaveBeenCalled()
  })

  it('the saved value changing to what this field already holds is no conflict (negative control)', () => {
    const store = new EditInPlaceStore({ autosaveDelay: PAUSE })
    const notes = always(store)
    store.change('notes', 'One two')
    notes.setValue('One')
    expect(store.refresh('notes')).toBe(false)
    expect(store.state('notes')).toMatchObject({ draft: 'One two', error: null })
    expect(store.state('notes')).not.toMatchObject({ conflict: true })
  })

  it("the server trimming the text it was sent is its own echo: no start over, no conflict (F25)", async () => {
    const store = new EditInPlaceStore({ autosaveDelay: PAUSE })
    const notes = always(store)
    store.change('notes', 'One two  \n\n')
    const saved = store.commit('notes')
    notes.calls[0].resolve()
    await saved
    notes.setValue('One two')
    expect(store.refresh('notes')).toBe(false)
    expect(store.state('notes')).toMatchObject({ error: null })
    expect(store.state('notes')).not.toHaveProperty('revision')
    expect(store.dirty).toBe(false)
    // Negative control: a real change after that still starts it over.
    notes.setValue('One two three')
    expect(store.refresh('notes')).toBe(true)
  })

  it('a hidden page saves at once rather than after the pause (F13)', async () => {
    vi.useFakeTimers()
    const store = new EditInPlaceStore({ autosaveDelay: PAUSE })
    const notes = always(store)
    store.change('notes', 'One two')
    store.hurry(true)
    expect(notes.calls[0].value).toBe('One two')
    notes.calls[0].resolve()
    await vi.advanceTimersByTimeAsync(0)
    store.change('notes', 'One two three')
    await vi.advanceTimersByTimeAsync(0)
    expect(notes.calls[1].value).toBe('One two three')
    store.hurry(false)
    notes.calls[1].resolve()
    await vi.advanceTimersByTimeAsync(0)
    store.change('notes', 'One two three four')
    await vi.advanceTimersByTimeAsync(PAUSE - 1)
    expect(notes.calls).toHaveLength(2)
  })

  it('stops counting once it leaves the view', () => {
    const store = new EditInPlaceStore()
    const notes = always(store)
    notes.unregister()
    expect(store.editing).toBe(false)
  })
})

describe('leaving the page while autosaving', () => {
  it('a hold keeps the view editing (the leave prompt mounted) after the save closes the field', async () => {
    const store = new EditInPlaceStore()
    const notes = field(store, 'notes', { value: 'One', autosave: true })
    await store.start('notes')
    store.change('notes', 'One two')
    const release = store.hold()
    const saving = store.saveAll()
    // Leaving the field (the click on the link) closes it once saved.
    const leaving = store.commit('notes')
    notes.calls[0].resolve()
    expect(await saving).toBe(true)
    await leaving
    expect(store.open).toBeNull()
    expect(store.editing).toBe(true)
    release()
    expect(store.editing).toBe(false)
  })
})
