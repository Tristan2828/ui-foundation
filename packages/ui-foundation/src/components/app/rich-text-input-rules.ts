// The rich-text editor's typed Markdown: Milkdown's input rules, three of
// them swapped for the editor's own (4.126, the RichTextEditor review's
// F15, F16 and F22).
// - `---` (or `***`, `___` and a space) on an empty line puts in a divider
//   the way the Divider button does: a line under it, the caret there.
//   Milkdown's left the rule selected, and the next key replaced it.
// - `*words*` and `**words**` need a non-space after the opening marks and
//   before the closing ones, as CommonMark (and Notion) do: `5 * 3 * 2`
//   stays as typed. Milkdown's took any text between two stars.
// - `==words==` highlights as typed (`=={green}words==` in that colour),
//   as the other marks do; before, it became a highlight only on a reload.
// Every other rule is Milkdown's own, in its order.
import { emphasisStarInputRule, inputRules, insertHrInputRule, markInputRules, strongInputRule } from '@milkdown/kit/preset/commonmark'
import type { MilkdownPlugin } from '@milkdown/kit/ctx'
import { schemaCtx } from '@milkdown/kit/core'
import { markRule } from '@milkdown/kit/prose'
import { InputRule } from '@milkdown/kit/prose/inputrules'
import type { Transaction } from '@milkdown/kit/prose/state'
import { $inputRule } from '@milkdown/kit/utils'
import { DEFAULT_HIGHLIGHT, isHighlightColor } from '@/lib/markdown-highlight'
import { toggleFormat } from './rich-text-formats'

// The opening `*` follows anything but a star (so it isn't half of `**`)
// and is followed by a non-space; the closing one, being typed, follows a
// non-space. The group is the words.
export const EMPHASIS_STAR = /(?:^|[^*])\*([^\s*](?:[^*]*[^\s*])?)\*$/

// As Milkdown's: not next to a letter, a colon or a slash (a path, a URL,
// `a**b**c`), and now the words start and end with a non-space.
export const STRONG = /(?<![\w:/])(?:\*\*|__)([^\s*_](?:[^*_]*?[^\s*_])?)(?:\*\*|__)(?![\w/])$/

// `==words==` or `=={colour}words==`, the way markdown-highlight.ts reads
// it: the opening marks follow anything but `=`, the words start and end
// with a non-space (and don't start with a brace, which is a colour's).
export const HIGHLIGHT = /(?:^|[^=])==(?:\{([a-z]+)\})?([^\s={](?:[^=]*[^\s=])?)==$/

// Milkdown's divider rule's text: `---`, or `***` / `___` and a space.
export const DIVIDER = /^(?:---|___\s|\*\*\*\s)$/

const emphasisStar = $inputRule((ctx) =>
  markRule(EMPHASIS_STAR, ctx.get(schemaCtx).marks.emphasis, {
    getAttr: () => ({ marker: '*' }),
    // The character before the star is matched, not marked.
    updateCaptured: ({ fullMatch, start }) => (!fullMatch.startsWith('*') ? { fullMatch: fullMatch.slice(1), start: start + 1 } : {}),
  }),
)

const strong = $inputRule((ctx) =>
  markRule(STRONG, ctx.get(schemaCtx).marks.strong, {
    getAttr: (match) => ({ marker: match[0].startsWith('*') ? '*' : '_' }),
  }),
)

// Its own handler rather than markRule, which finds the words by their
// text and so would find "green" in the colour of `=={green}green==`.
// The closing `=` being typed is never put in.
const highlight = $inputRule((ctx) => {
  const type = ctx.get(schemaCtx).marks.highlight
  return new InputRule(HIGHLIGHT, (state, match, start, end) => {
    const [whole, colour, words] = match
    const open = start + (whole.startsWith('=') ? 0 : 1)
    const textStart = open + 2 + (colour ? colour.length + 2 : 0)
    const textEnd = textStart + words.length
    const tr = state.tr.delete(textEnd, end).delete(open, textStart)
    tr.addMark(open, open + words.length, type.create({ color: isHighlightColor(colour) ? colour : DEFAULT_HIGHLIGHT }))
    // What's typed next isn't highlighted.
    return tr.removeStoredMark(type)
  })
})

// The Divider button's insert (rich-text-formats.ts insertBlock), on the
// line the marks were typed on, once they're gone: one step to undo, which
// brings the marks back. Nothing when the line holds more than the marks.
const divider = $inputRule(
  () =>
    new InputRule(DIVIDER, (state, _match, start, end) => {
      const tr = state.tr.delete(start, end)
      if (tr.doc.resolve(start).parent.content.size > 0) return null
      let made: Transaction | null = null
      if (!toggleFormat(state.apply(tr), (next) => (made = next), 'divider')) return null
      const done = made as Transaction | null
      if (!done) return null
      for (const step of done.steps) tr.step(step)
      return tr.setSelection(done.selection.getBookmark().resolve(tr.doc)).scrollIntoView()
    }),
)

const REPLACED: readonly MilkdownPlugin[] = [insertHrInputRule, emphasisStarInputRule, strongInputRule]

/** The editor's input rules: Milkdown's blocks' and marks', with the divider, emphasis and strong rules its own, and the highlight's. */
export const typedInputRules: MilkdownPlugin[] = [
  ...inputRules.filter((rule) => !REPLACED.includes(rule)),
  divider,
  ...markInputRules.filter((rule) => !REPLACED.includes(rule)),
  emphasisStar,
  strong,
  highlight,
]
