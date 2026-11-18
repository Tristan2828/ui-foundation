// mergeMarkdown's cost on a long note (F6 of the 2026-11-17 review): an
// editor merges the same original and baseline against every edit, so
// those two are parsed once per mount, and a merge parses only the text
// now and what it would save (the guard). The time budget is generous
// (CI machines vary); the parse counts are exact.
import { beforeEach, describe, expect, it } from 'vitest'
import { longNote, wordCount } from '../src/components/app/rich-text-long-note.fixtures'
import { mergeMarkdown, mergeStats } from '../src/lib/markdown-merge'

const NOTE = longNote()

// The note with a word typed into the paragraph at the middle.
function typedInto(markdown: string, word: string) {
  const middle = markdown.indexOf('## Part 7')
  const at = markdown.indexOf('. ', middle) + 1
  return markdown.slice(0, at) + ` ${word}` + markdown.slice(at)
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

describe('mergeMarkdown on a long note', () => {
  beforeEach(() => {
    mergeStats.parses = 0
  })

  it('is about 5,000 words with 13 tables', () => {
    expect(wordCount(NOTE)).toBeGreaterThan(4800)
    expect(wordCount(NOTE)).toBeLessThan(6000)
    expect(NOTE.match(/^\| :--- /gm)).toHaveLength(13)
  })

  it('keeps every untouched block as written', () => {
    const current = typedInto(NOTE, 'hello')
    expect(mergeMarkdown(NOTE, NOTE, current)).toBe(current)
  })

  it('parses the original and the baseline once, then two texts a merge', () => {
    // The editor writes some blocks its own way (here, the title's space).
    const original = NOTE.replace('Working notes', 'Working notes once')
    const baseline = original.replace('# Working', '#  Working')
    mergeMarkdown(original, baseline, typedInto(baseline, 'one'))
    // The first merge: the original, the baseline, the text now, the guard's.
    expect(mergeStats.parses).toBe(4)
    mergeStats.parses = 0
    for (const word of ['two', 'three', 'four']) mergeMarkdown(original, baseline, typedInto(baseline, word))
    expect(mergeStats.parses).toBe(6)
  })

  it('control: a new original and baseline are parsed again', () => {
    for (const word of ['a', 'b']) {
      const original = NOTE.replace('Working notes', `Working notes ${word}`)
      const baseline = original.replace('# Working', '#  Working')
      mergeMarkdown(original, baseline, typedInto(baseline, 'x'))
    }
    // Four texts a merge: nothing was reused.
    expect(mergeStats.parses).toBe(8)
  })

  it('merges a keystroke on a 5,000-word note within budget', () => {
    mergeMarkdown(NOTE, NOTE, typedInto(NOTE, 'warm'))
    const times: number[] = []
    for (let i = 0; i < 7; i++) {
      const current = typedInto(NOTE, `word${i}`)
      const start = performance.now()
      mergeMarkdown(NOTE, NOTE, current)
      times.push(performance.now() - start)
    }
    // About 37 ms on a laptop (2026-11-18). 200 ms leaves room for a slow
    // CI runner and catches a merge that grows worse than linear; the
    // parse counts above are the exact check on the cache.
    expect(median(times)).toBeLessThan(200)
  })
})
