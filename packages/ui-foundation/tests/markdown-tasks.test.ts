// A Markdown text's task items (src/lib/markdown-tasks.ts): counted for a
// table's "N/M" column, and one flipped in the source for <Markdown>'s
// `onTasksChange`. Ticking in a browser is e2e/markdown-tasks.spec.ts's.
import { describe, expect, it } from 'vitest'
import { countTasks, toggleTaskAt } from '../src/lib/markdown-tasks'

describe('countTasks', () => {
  it('counts ticked and every task item, nested ones and every list marker included', () => {
    const text = '- [ ] a\n- [x] b\n  - [X] c\n  - [ ] d\n\n1. [x] e\n\n* [ ] f\n+ [x] g\n'
    expect(countTasks(text)).toEqual({ done: 4, total: 7 })
  })

  it('leaves out plain items, a code block, and a box that is not at the item start', () => {
    const text = '- plain\n- not [ ] a task\n\n```\n- [ ] code\n```\n\n    - [x] indented code\n'
    expect(countTasks(text)).toEqual({ done: 0, total: 0 })
  })

  it('counts items in a quote or callout', () => {
    expect(countTasks('> [!NOTE]\n> - [x] kept\n> - [ ] lost\n')).toEqual({ done: 1, total: 2 })
  })

  it('is zero for no text', () => {
    expect(countTasks('')).toEqual({ done: 0, total: 0 })
    expect(countTasks(null)).toEqual({ done: 0, total: 0 })
    expect(countTasks(undefined)).toEqual({ done: 0, total: 0 })
  })
})

describe('toggleTaskAt', () => {
  it('flips the box of the item that starts there, and nothing else', () => {
    const text = '- [ ] a\n- [x] b\n'
    expect(toggleTaskAt(text, 0)).toBe('- [x] a\n- [x] b\n')
    expect(toggleTaskAt(text, 8)).toBe('- [ ] a\n- [ ] b\n')
  })

  it('unticks an upper-case X, and keeps numbered and nested markers as written', () => {
    expect(toggleTaskAt('* [X] a\n', 0)).toBe('* [ ] a\n')
    expect(toggleTaskAt('10) [ ] a\n', 0)).toBe('10) [x] a\n')
    expect(toggleTaskAt('- [ ] a\n  - [ ] b\n', 10)).toBe('- [ ] a\n  - [x] b\n')
  })

  it('leaves the text alone where no task item starts', () => {
    expect(toggleTaskAt('- plain\n', 0)).toBe('- plain\n')
    expect(toggleTaskAt('- [ ] a\n', 3)).toBe('- [ ] a\n')
  })
})
