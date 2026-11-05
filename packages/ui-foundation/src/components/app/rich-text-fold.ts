// Folding in the rich-text editor (`foldKey`): the same sections as
// <Markdown>'s (src/lib/markdown-fold.ts), hidden with decorations, so
// the document, and the Markdown saved, never change.
//
// - Each top-level heading's node view has a fold button before it
//   (headingView in milkdown-editor.tsx); a node decoration tells it its
//   fold id and state.
// - The blocks a folded heading covers get `hidden`.
// - The caret put inside a folded section (an undo there, a jump) opens
//   it: what's being edited always shows. The arrow keys pass over a
//   folded section, as the browser passes over hidden text.
// - Ctrl/Cmd+Alt+[ folds the section the caret is in, the caret going to
//   the end of its heading; Ctrl/Cmd+Alt+] opens the heading the caret is
//   on. NotesOutline does the rest from the keyboard.
//
// What's folded lives outside the editor (src/hooks/fold-store.ts, shared
// with NotesOutline and <Markdown>): a change there comes in as a
// transaction with this plugin's meta, and every change made here goes
// out through `onChange`.
import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import { Plugin, PluginKey, TextSelection, type EditorState } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet, type EditorView } from '@milkdown/kit/prose/view'
import { foldPlan, openAt, toggleFold, type FoldHeadingInput, type FoldPlan } from '@/lib/markdown-fold'

/** What a heading's node view hears of its fold, through its node decoration's spec. */
export type FoldSpec = { id: string; label: string; foldable: boolean; folded: boolean }

type FoldState = { folded: ReadonlySet<string>; plan: FoldPlan; decorations: DecorationSet }

export const foldPluginKey = new PluginKey<FoldState>('fold')

/** The fold plan of a document's top-level blocks. */
export function docFoldPlan(doc: ProseNode, folded?: ReadonlySet<string>): FoldPlan {
  const blocks: (FoldHeadingInput | null)[] = []
  doc.forEach((node) => blocks.push(node.type.name === 'heading' ? { level: Number(node.attrs.level), text: node.textContent } : null))
  return foldPlan(blocks, folded)
}

function build(doc: ProseNode, folded: ReadonlySet<string>): FoldState {
  const plan = docFoldPlan(doc, folded)
  const headings = new Map(plan.headings.map((heading) => [heading.index, heading]))
  const decorations: Decoration[] = []
  doc.forEach((node, offset, index) => {
    const heading = headings.get(index)
    const attrs: Record<string, string> = {}
    if (plan.hidden.has(index)) attrs.hidden = ''
    if (heading) {
      const spec: FoldSpec = {
        id: heading.id,
        label: heading.text,
        foldable: heading.foldable,
        folded: heading.foldable && folded.has(heading.id),
      }
      decorations.push(Decoration.node(offset, offset + node.nodeSize, attrs, { fold: spec }))
    } else if (attrs.hidden !== undefined) {
      decorations.push(Decoration.node(offset, offset + node.nodeSize, attrs))
    }
  })
  return { folded, plan, decorations: DecorationSet.create(doc, decorations) }
}

/** A heading node view's fold, from the decorations ProseMirror gives it. */
export function foldSpecOf(decorations: readonly Decoration[]): FoldSpec | null {
  for (const decoration of decorations) {
    const spec = (decoration.spec as { fold?: FoldSpec }).fold
    if (spec) return spec
  }
  return null
}

/** A transaction that sets what's folded, from outside the editor. */
export function setFolds(state: EditorState, folded: ReadonlySet<string>) {
  return state.tr.setMeta(foldPluginKey, folded).setMeta('addToHistory', false)
}

// The innermost foldable heading whose section (or heading) holds the
// top-level block at `index`.
function headingAround(plan: FoldPlan, index: number) {
  let found: FoldPlan['headings'][number] | undefined
  for (const heading of plan.headings) {
    if (heading.foldable && heading.index <= index && index < heading.end) found = heading
  }
  return found
}

// The caret at the end of the top-level block at `index` (a heading).
function caretToEnd(state: EditorState, index: number) {
  let end = 0
  state.doc.forEach((node, offset, at) => {
    if (at === index) end = offset + node.nodeSize - 1
  })
  return state.tr.setSelection(TextSelection.create(state.doc, end)).scrollIntoView()
}

export function foldPlugin(options: { initial: ReadonlySet<string>; onChange: (folded: ReadonlySet<string>) => void }) {
  return new Plugin<FoldState>({
    key: foldPluginKey,
    state: {
      init: (_config, state) => build(state.doc, options.initial),
      apply: (tr, value, _old, state) => {
        const next = tr.getMeta(foldPluginKey) as ReadonlySet<string> | undefined
        if (!next && !tr.docChanged) return value
        return build(state.doc, next ?? value.folded)
      },
    },
    props: {
      decorations: (state) => foldPluginKey.getState(state)?.decorations,
      handleKeyDown: (view, event) => {
        const mod = event.metaKey || event.ctrlKey
        if (!mod || !event.altKey || event.shiftKey) return false
        if (event.code !== 'BracketLeft' && event.code !== 'BracketRight') return false
        const fold = foldPluginKey.getState(view.state)
        if (!fold) return false
        const index = view.state.selection.$from.index(0)
        event.preventDefault()
        if (event.code === 'BracketLeft') {
          const heading = headingAround(fold.plan, index)
          if (!heading || fold.folded.has(heading.id)) return true
          // The caret to the end of the heading, which stays in sight.
          view.dispatch(caretToEnd(view.state, heading.index))
          options.onChange(toggleFold(fold.folded, heading.id))
          return true
        }
        const heading = fold.plan.headings.find((one) => one.index === index)
        if (heading && fold.folded.has(heading.id)) options.onChange(toggleFold(fold.folded, heading.id))
        return true
      },
    },
    view: () => ({
      update: (view: EditorView, previous: EditorState) => {
        const fold = foldPluginKey.getState(view.state)
        if (!fold) return
        const index = view.state.selection.$from.index(0)
        if (!fold.plan.hidden.has(index)) return
        // Folded around the caret (a fold button, the outline): the caret
        // goes to the end of the heading that folded, which shows.
        if (fold.folded !== foldPluginKey.getState(previous)?.folded && view.state.selection.eq(previous.selection)) {
          const outer = fold.plan.headings.find(
            (heading) => fold.folded.has(heading.id) && heading.foldable && heading.index < index && index < heading.end,
          )
          if (outer) queueMicrotask(() => view.dispatch(caretToEnd(view.state, outer.index)))
          return
        }
        // The caret put in a folded section: open it (after this update,
        // as the change comes back in a transaction of its own).
        const opened = openAt(fold.plan, fold.folded, index)
        queueMicrotask(() => options.onChange(opened))
      },
    }),
  })
}
