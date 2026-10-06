// The rules of editing in place (src/components/app/edit-in-place-store.ts):
// nothing typed is ever lost. A field's save is a promise the test settles
// by hand, like a server that answers when told.
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { AppError } from '../src/api/contracts'
import { EditInPlaceStore, type EditFieldConfig } from '../src/components/app/edit-in-place-store'

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
