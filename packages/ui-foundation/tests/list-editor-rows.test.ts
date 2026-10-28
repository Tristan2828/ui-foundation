import { describe, expect, it } from 'vitest'
import { followOpenItem, isItemOpen } from '@/components/app/list-editor-rows'

// ListEditor's summary lines (#222): the open item is held by id, follows
// moves, closes on remove, and an add or a duplicate opens what it made.
describe('followOpenItem', () => {
  it('keeps the open item open while rows move', () => {
    expect(followOpenItem({ before: ['a', 'b', 'c'], after: ['b', 'a', 'c'], open: 'a', opening: false })).toBe('a')
  })

  it('closes when the open item is removed', () => {
    expect(followOpenItem({ before: ['a', 'b', 'c'], after: ['a', 'c'], open: 'b', opening: false })).toBeNull()
  })

  it('keeps the open item when another is removed', () => {
    expect(followOpenItem({ before: ['a', 'b', 'c'], after: ['a', 'b'], open: 'b', opening: false })).toBe('b')
  })

  it('opens an item just added, closing the one that was open', () => {
    expect(followOpenItem({ before: ['a', 'b'], after: ['a', 'b', 'n'], open: 'a', opening: true })).toBe('n')
  })

  it('opens a copy inserted after its original', () => {
    expect(followOpenItem({ before: ['a', 'b', 'c'], after: ['a', 'b', 'n', 'c'], open: null, opening: true })).toBe('n')
  })

  it('opens nothing new when no add or duplicate asked for it', () => {
    expect(followOpenItem({ before: ['a', 'b'], after: ['a', 'b', 'n'], open: 'a', opening: false })).toBe('a')
  })

  it('opens nothing when the whole list is replaced (a reset)', () => {
    expect(followOpenItem({ before: ['a', 'b'], after: ['x', 'y'], open: 'a', opening: false })).toBeNull()
  })

  it('keeps the open item when an add asked but nothing new arrived', () => {
    expect(followOpenItem({ before: ['a', 'b'], after: ['b', 'a'], open: 'a', opening: true })).toBe('a')
  })
})

describe('isItemOpen', () => {
  it('is the open item', () => {
    expect(isItemOpen({ id: 'a', open: 'a', invalid: false })).toBe(true)
    expect(isItemOpen({ id: 'b', open: 'a', invalid: false })).toBe(false)
  })

  it('is any item with an error, beside the open one', () => {
    expect(isItemOpen({ id: 'b', open: 'a', invalid: true })).toBe(true)
    expect(isItemOpen({ id: 'b', open: null, invalid: true })).toBe(true)
  })
})
