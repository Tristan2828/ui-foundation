// useWidgetLayout's rules (#263): the saved order merged with the page's
// ids (removed ones drop out, new ones fall in at their default place),
// a move one place either way, and the store keeping a layout where
// storage refuses it and handing back the same object until it changes.
import { describe, expect, it } from 'vitest'
import { createWidgetLayoutStore, mergeWidgetLayout, moveWidget } from '../src/hooks/use-widget-layout'

const IDS = ['ready', 'waiting', 'links', 'notes'] as const

describe('mergeWidgetLayout', () => {
  it('is the default order, nothing hidden, when nothing is saved', () => {
    expect(mergeWidgetLayout(IDS, null)).toEqual({ order: [...IDS], hidden: [] })
  })

  it("keeps the saved order and hidden ids", () => {
    const saved = { order: ['links', 'ready', 'notes', 'waiting'], hidden: ['notes'] }
    expect(mergeWidgetLayout(IDS, saved)).toEqual(saved)
  })

  it('drops ids the page no longer has, and duplicates', () => {
    const saved = { order: ['links', 'gone', 'ready', 'links', 'notes', 'waiting'], hidden: ['gone', 'waiting'] }
    expect(mergeWidgetLayout(IDS, saved)).toEqual({ order: ['links', 'ready', 'notes', 'waiting'], hidden: ['waiting'] })
  })

  it('puts a new id after the card before it in the default order', () => {
    // `waiting` is new: it follows `ready`, wherever the person put that.
    expect(mergeWidgetLayout(IDS, { order: ['links', 'notes', 'ready'], hidden: [] }).order).toEqual([
      'links',
      'notes',
      'ready',
      'waiting',
    ])
  })

  it('puts a new first id first, and several new ids in their default order', () => {
    expect(mergeWidgetLayout(IDS, { order: ['links'], hidden: ['links'] })).toEqual({
      order: ['ready', 'waiting', 'links', 'notes'],
      hidden: ['links'],
    })
    expect(mergeWidgetLayout(IDS, { order: [], hidden: [] }).order).toEqual([...IDS])
  })
})

describe('moveWidget', () => {
  it('swaps a card with its neighbour up or down', () => {
    expect(moveWidget(IDS, 'waiting', -1)).toEqual(['waiting', 'ready', 'links', 'notes'])
    expect(moveWidget(IDS, 'waiting', 1)).toEqual(['ready', 'links', 'waiting', 'notes'])
  })

  it('leaves the order alone at either end, or for an unknown id', () => {
    expect(moveWidget(IDS, 'ready', -1)).toEqual([...IDS])
    expect(moveWidget(IDS, 'notes', 1)).toEqual([...IDS])
    expect(moveWidget(IDS, 'gone', 1)).toEqual([...IDS])
  })
})

function fakeStorage() {
  const held = new Map<string, string>()
  return {
    held,
    storage: {
      getItem: (key: string) => held.get(key) ?? null,
      setItem: (key: string, value: string) => void held.set(key, value),
      removeItem: (key: string) => void held.delete(key),
    },
  }
}

describe('createWidgetLayoutStore', () => {
  it('writes JSON under the key, tells its listeners, and forgets on a reset', () => {
    const { held, storage } = fakeStorage()
    const store = createWidgetLayoutStore(() => storage)
    let told = 0
    store.subscribe('app:hub:widgets', () => told++)
    expect(store.get('app:hub:widgets')).toBeNull()
    store.set('app:hub:widgets', { order: ['links', 'ready'], hidden: ['ready'] })
    expect(JSON.parse(held.get('app:hub:widgets')!)).toEqual({ order: ['links', 'ready'], hidden: ['ready'] })
    expect(store.get('app:hub:widgets')).toEqual({ order: ['links', 'ready'], hidden: ['ready'] })
    store.set('app:hub:widgets', null)
    expect(held.has('app:hub:widgets')).toBe(false)
    expect(store.get('app:hub:widgets')).toBeNull()
    expect(told).toBe(2)
  })

  it('reads what another visit saved, the same object each time, and ignores what it cannot parse', () => {
    const { held, storage } = fakeStorage()
    held.set('a', JSON.stringify({ order: ['links', 3], hidden: 'no' }))
    held.set('b', '{not json')
    const store = createWidgetLayoutStore(() => storage)
    const first = store.get('a')
    expect(first).toEqual({ order: ['links'], hidden: [] })
    expect(store.get('a')).toBe(first)
    expect(store.get('b')).toBeNull()
  })

  it('keeps the layout for the page where storage throws', () => {
    const refuse = () => {
      throw new Error('blocked')
    }
    const store = createWidgetLayoutStore(() => ({ getItem: refuse, setItem: refuse, removeItem: refuse }))
    expect(store.get('k')).toBeNull()
    store.set('k', { order: ['links'], hidden: [] })
    expect(store.get('k')).toEqual({ order: ['links'], hidden: [] })
  })
})
