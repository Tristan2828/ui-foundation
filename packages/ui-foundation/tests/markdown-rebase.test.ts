// rebaseMarkdown (src/lib/markdown-merge.ts): "Keep Mine" after a note
// changed elsewhere lays this tab's edits onto the latest text, block by
// block, and gives up (null) rather than drop either side's change.
import { describe, expect, it } from 'vitest'
import { rebaseMarkdown } from '../src/lib/markdown-merge'

const BASE = 'Para one.\n\nPara two.\n'

describe('rebaseMarkdown', () => {
  it("keeps both: mine edited one paragraph, theirs added another (the review's F4 repro)", () => {
    const mine = 'Para one. edit in A\n\nPara two.\n'
    const theirs = 'Para one.\n\nPara two.\n\nPara three ADDED IN TAB B.\n'
    expect(rebaseMarkdown(BASE, mine, theirs)).toBe('Para one. edit in A\n\nPara two.\n\nPara three ADDED IN TAB B.\n')
  })

  it('keeps both when each side edited a different paragraph', () => {
    const mine = 'Para one, mine.\n\nPara two.\n'
    const theirs = 'Para one.\n\nPara two, theirs.\n'
    expect(rebaseMarkdown(BASE, mine, theirs)).toBe('Para one, mine.\n\nPara two, theirs.\n')
  })

  it('keeps a paragraph mine deleted deleted, and what theirs added', () => {
    const mine = 'Para two.\n'
    const theirs = 'Para one.\n\nPara two.\n\nPara three.\n'
    expect(rebaseMarkdown(BASE, mine, theirs)).toBe('Para two.\n\nPara three.\n')
  })

  it("writes untouched blocks in theirs's own bytes (a bullet style the editor would change)", () => {
    const base = '* a\n* b\n\nTail.\n'
    const theirs = '* a\n* b\n\nTail.\n\nNew from the chat.\n'
    const mine = '* a\n* b\n\nTail, mine.\n'
    expect(rebaseMarkdown(base, mine, theirs)).toBe('* a\n* b\n\nTail, mine.\n\nNew from the chat.\n')
  })

  it("writes mine's blocks in theirs's line endings (CRLF)", () => {
    const base = 'One.\r\n\r\nTwo.\r\n'
    const theirs = 'One.\r\n\r\nTwo.\r\n\r\nThree.\r\n'
    const mine = 'One, mine.\n\nTwo.\n'
    expect(rebaseMarkdown(base, mine, theirs)).toBe('One, mine.\r\n\r\nTwo.\r\n\r\nThree.\r\n')
  })

  it('both changed the same paragraph: null, so the person picks (negative control)', () => {
    expect(rebaseMarkdown(BASE, 'Para one, mine.\n\nPara two.\n', 'Para one, theirs.\n\nPara two.\n')).toBeNull()
  })

  it('both added text at the same place: null (which goes first is the person\'s call)', () => {
    expect(rebaseMarkdown(BASE, `${BASE}\nMine at the end.\n`, `${BASE}\nTheirs at the end.\n`)).toBeNull()
  })

  it('one side unchanged, or both the same: that one', () => {
    expect(rebaseMarkdown(BASE, BASE, 'Theirs.\n')).toBe('Theirs.\n')
    expect(rebaseMarkdown(BASE, 'Mine.\n', BASE)).toBe('Mine.\n')
    expect(rebaseMarkdown(BASE, 'Same.\n', 'Same.\n')).toBe('Same.\n')
  })

  it('from an empty note: whichever side wrote, or null when both did', () => {
    expect(rebaseMarkdown('', '', 'Theirs.\n')).toBe('Theirs.\n')
    expect(rebaseMarkdown('', 'Mine.\n', '')).toBe('Mine.\n')
    expect(rebaseMarkdown('', 'Mine.\n', 'Theirs.\n')).toBeNull()
  })
})
