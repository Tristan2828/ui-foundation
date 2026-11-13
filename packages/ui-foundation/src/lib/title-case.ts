// The words a label is written in (design-language.md "Words on screen"):
// titles, buttons, menu items, tabs, column headers and field labels are
// Title Case. Messages, help text, toasts, placeholders and screen-reader
// sentences stay sentence case, so they never go through this.

/** The short words a title keeps lowercase, unless first or last. */
export const TITLE_CASE_SMALL_WORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'the',
  'and',
  'but',
  'or',
  'nor',
  'as',
  'at',
  'by',
  'for',
  'in',
  'of',
  'on',
  'per',
  'to',
  'with',
])

const upperFirst = (part: string) => part.replace(/\p{L}/u, (letter) => letter.toUpperCase())

function casePart(part: string, edge: boolean): string {
  if (!/\p{L}/u.test(part)) return part
  // A word already holding a capital ("iPhone", "URL", "McKay") is written as its owner wrote it.
  if (/\p{Lu}/u.test(part)) return part
  const bare = part.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '')
  if (!edge && TITLE_CASE_SMALL_WORDS.has(bare)) return part
  return upperFirst(part)
}

/**
 * A label in Title Case: every word capitalised but the short ones
 * (`TITLE_CASE_SMALL_WORDS`: a, an, the, and, or, of, to, in, on, for, by,
 * with, ...), which stay lowercase unless first or last, or first after a
 * colon. A word that already holds a capital is left as written, so names
 * and acronyms survive: `titleCase('rows per page')` is "Rows per Page",
 * `titleCase('move to')` is "Move To", `titleCase('open in GitHub')` is
 * "Open in GitHub". For a label built from a value (`Any ${label}`); a
 * label written in the code is written in Title Case to begin with.
 */
export function titleCase(text: string): string {
  const words = text.split(/(\s+)/)
  const real = words.map((word, index) => (index % 2 === 0 && word !== '' ? index : -1)).filter((index) => index >= 0)
  const first = real[0]
  const last = real.at(-1)
  let afterColon = false
  return words
    .map((word, index) => {
      if (index % 2 === 1 || word === '') return word
      const edge = index === first || index === last || afterColon
      afterColon = /:$/.test(word)
      return word
        .split('-')
        // Each part of a hyphenated word is a word ("Follow-Up"), small or not.
        .map((part, partIndex) => casePart(part, edge || partIndex > 0))
        .join('-')
    })
    .join('')
}
