// A long note, for the typing-lag budgets (F6 of the 2026-11-17 review):
// about 5,000 words in what real notes hold (headings, paragraphs with
// marks and links, nested and task lists, quotes, code, 13 tables).
// The same every time (no randomness), so a budget measures the same
// work on every run. Used by tests/markdown-merge-budget.test.ts and the
// LongNote story (e2e/rich-text-perf.spec.ts). Not shipped: the build
// leaves *.fixtures.ts out.

const WORDS = (
  'the plan for each part keeps a short list of steps with notes on what ' +
  'to check before moving on and what changed since the last time someone ' +
  'looked at it with care so that nothing gets lost between one pass and ' +
  'the next while the work goes on at its own pace over weeks'
).split(' ')

// Words from the list, starting at `seed`, `count` of them.
function words(seed: number, count: number): string {
  const out: string[] = []
  for (let i = 0; i < count; i++) out.push(WORDS[(seed * 7 + i * 3) % WORDS.length])
  return out.join(' ')
}

function sentence(seed: number, count: number): string {
  const text = words(seed, count)
  return text[0].toUpperCase() + text.slice(1) + '.'
}

function paragraph(seed: number): string {
  // About 60 words, one bold run, one italic run and, every third one, a link.
  const parts = [sentence(seed, 14), `**${words(seed + 1, 3)}**`, sentence(seed + 2, 16), `*${words(seed + 3, 2)}*`, sentence(seed + 4, 18)]
  if (seed % 3 === 0) parts.push(`See [${words(seed + 5, 2)}](https://example.com/notes/${seed}).`)
  return parts.join(' ')
}

function table(seed: number): string {
  const rows = [`| Step | Count | Note |`, `| :--- | ---: | :--- |`]
  for (let r = 0; r < 5; r++) rows.push(`| ${words(seed + r, 2)} | ${(seed * 3 + r) % 17} | ${words(seed + r + 9, 4)} |`)
  return rows.join('\n')
}

/** The long note's Markdown: `sections` sections of about 380 words (13 → about 5,000). */
export function longNote(sections = 13): string {
  const blocks: string[] = ['# Working notes', paragraph(0)]
  for (let s = 1; s <= sections; s++) {
    const seed = s * 11
    blocks.push(`## Part ${s}`)
    blocks.push(paragraph(seed), paragraph(seed + 1))
    blocks.push(`- ${sentence(seed + 2, 8)}\n- ${sentence(seed + 3, 9)}\n  - ${sentence(seed + 4, 7)}\n- ${sentence(seed + 5, 8)}`)
    blocks.push(paragraph(seed + 6))
    blocks.push(table(seed))
    blocks.push(`### Checks`)
    blocks.push(`- [ ] ${sentence(seed + 7, 6)}\n- [x] ${sentence(seed + 8, 6)}`)
    blocks.push(`> ${sentence(seed + 9, 20)}`)
    blocks.push(paragraph(seed + 10))
    if (s % 4 === 0) blocks.push('```ts\nconst step = next(plan)\n```')
    blocks.push(paragraph(seed + 12))
  }
  return blocks.join('\n\n') + '\n'
}

/** The words in a note's text (what a person would count), for checking the fixture's size. */
export function wordCount(markdown: string): number {
  return markdown.split(/\s+/).filter((word) => /[a-z]/i.test(word)).length
}
