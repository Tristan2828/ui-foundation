// The rich-text editor behind RichTextEditor, loaded only when one opens
// (rich-text-editor.tsx imports this lazily): Milkdown, a ProseMirror
// editor whose Markdown goes in and out through remark, the same parser
// <Markdown> renders with. Why Milkdown, and what it costs:
// docs/ARCHITECTURE.md "Decisions".
//
// What this file adds to Milkdown's own presets:
// - Saves go through mergeMarkdown: an untouched document, and every block
//   the person didn't change, saves back as originally written.
// - No HTML in, ever. The preset's "preserve empty line" plugin is left
//   out: it writes an empty paragraph as a raw `<br />`. Raw HTML already
//   in the text shows as its characters (an uneditable chip, Milkdown's
//   html node), and HTML pasted as such a chip becomes plain text.
// - Headings render from <h3>, like <Markdown>: the page owns <h1> and
//   <h2>. A task-list item renders a real checkbox that toggles it.
// - Edited blocks are written in the document's own bullet and rule marks.
import { useEffect, useRef } from 'react'
import {
  defaultValueCtx,
  Editor,
  editorViewCtx,
  editorViewOptionsCtx,
  remarkStringifyOptionsCtx,
  rootCtx,
} from '@milkdown/kit/core'
import type { MilkdownPlugin } from '@milkdown/kit/ctx'
import { history } from '@milkdown/kit/plugin/history'
import {
  commands,
  inputRules,
  keymap,
  markInputRules,
  plugins,
  remarkPreserveEmptyLinePlugin,
  schema,
} from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'
import { Fragment, Slice, type Node as ProseNode } from '@milkdown/kit/prose/model'
import { Plugin } from '@milkdown/kit/prose/state'
import type { EditorView, NodeView } from '@milkdown/kit/prose/view'
import { $prose, getMarkdown } from '@milkdown/kit/utils'
import { cn } from 'cn'
import { MarkdownMergeError, markdownStyle, mergeMarkdown } from '@/lib/markdown-merge'
import type { RichTextEditorProps } from './rich-text-editor'

// The commonmark preset, minus the plugin that writes `<br />`. A $remark
// plugin is a pair (its options and the plugin), spread into `plugins`.
const LEFT_OUT: readonly MilkdownPlugin[] = remarkPreserveEmptyLinePlugin
const COMMONMARK: MilkdownPlugin[] = [
  ...schema,
  ...inputRules,
  ...markInputRules,
  ...commands,
  ...keymap,
  ...plugins.filter((plugin) => !LEFT_OUT.includes(plugin)),
]

// Raw HTML pasted in as Milkdown's html chip becomes the plain text it
// shows, so a paste can never add markup to the Markdown.
function htmlToText(fragment: Fragment): Fragment {
  const nodes: ProseNode[] = []
  fragment.forEach((node) => {
    if (node.type.name === 'html') {
      const value = String(node.attrs.value ?? '')
      if (value) nodes.push(node.type.schema.text(value))
    } else {
      nodes.push(node.copy(htmlToText(node.content)))
    }
  })
  return Fragment.fromArray(nodes)
}

function headingView(node: ProseNode): NodeView {
  const dom = document.createElement(`h${Math.min(Number(node.attrs.level) + 2, 6)}`)
  return {
    dom,
    contentDOM: dom,
    update: (next) => next.type === node.type && next.attrs.level === node.attrs.level,
  }
}

// A task-list item: its checkbox toggles `checked`. Any other list item
// renders as Milkdown's own.
function taskItemView(node: ProseNode, view: EditorView, getPos: () => number | undefined): NodeView {
  const dom = document.createElement('li')
  const box = document.createElement('input')
  box.type = 'checkbox'
  box.contentEditable = 'false'
  box.tabIndex = -1
  box.setAttribute('aria-label', 'Done')
  const contentDOM = document.createElement('div')
  dom.append(box, contentDOM)
  dom.dataset.itemType = 'task'

  let current = node
  const render = () => {
    box.checked = Boolean(current.attrs.checked)
    dom.dataset.checked = String(Boolean(current.attrs.checked))
  }
  render()
  box.addEventListener('mousedown', (event) => event.preventDefault())
  // The browser's own toggle is left to happen (cancelling a checkbox's
  // click puts its old state back after this handler), and the document
  // follows it.
  box.addEventListener('click', () => {
    const pos = getPos()
    if (pos === undefined || !view.editable) return
    view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, checked: !current.attrs.checked }))
  })
  return {
    dom,
    contentDOM,
    update: (next) => {
      if (next.type !== current.type || next.attrs.checked == null) return false
      current = next
      render()
      return true
    },
    stopEvent: (event) => event.target === box,
    ignoreMutation: (mutation) => mutation.target === box,
  }
}

export default function MilkdownEditor({
  id,
  defaultValue,
  onChange,
  onProblem,
  readOnly = false,
  autoFocus = false,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
}: RichTextEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Editor | null>(null)
  // The latest props, for the editor's callbacks, which are set up once.
  const latest = useRef({ onChange, onProblem, readOnly })
  useEffect(() => {
    latest.current = { onChange, onProblem, readOnly }
  })

  const attributes: Record<string, string> = {
    'aria-multiline': 'true',
    'aria-readonly': String(readOnly),
    class: 'outline-none',
  }
  if (id) attributes.id = id
  if (ariaLabel) attributes['aria-label'] = ariaLabel
  if (ariaLabelledBy) attributes['aria-labelledby'] = ariaLabelledBy
  if (ariaDescribedBy) attributes['aria-describedby'] = ariaDescribedBy
  if (ariaInvalid) attributes['aria-invalid'] = 'true'
  const attributesKey = JSON.stringify(attributes)

  // The editor is made once, from the Markdown it opened with.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const original = defaultValue
    let baseline: string | null = null
    let cancelled = false

    const emit = () => {
      const editor = editorRef.current
      if (!editor || baseline === null) return
      const current = editor.action(getMarkdown())
      try {
        const merged = mergeMarkdown(original, baseline, current)
        latest.current.onProblem?.(null)
        latest.current.onChange(merged)
      } catch (error) {
        if (!(error instanceof MarkdownMergeError)) throw error
        latest.current.onProblem?.(error.message)
      }
    }

    const changes = $prose(
      () =>
        new Plugin({
          view: () => ({
            update: (view, previous) => {
              if (!view.state.doc.eq(previous.doc)) emit()
            },
          }),
          props: {
            transformPasted: (slice) => new Slice(htmlToText(slice.content), slice.openStart, slice.openEnd),
          },
        }),
    )

    const make = Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, original)
        ctx.update(remarkStringifyOptionsCtx, (options) => ({ ...options, ...markdownStyle(original) }))
        ctx.update(editorViewOptionsCtx, (options) => ({
          ...options,
          editable: () => !latest.current.readOnly,
          attributes,
          nodeViews: {
            heading: headingView,
            list_item: (node, view, getPos) =>
              node.attrs.checked == null ? (undefined as unknown as NodeView) : taskItemView(node, view, getPos),
          },
        }))
      })
      .use(COMMONMARK)
      .use(gfm)
      .use(history)
      .use(changes)

    void make.create().then((editor) => {
      if (cancelled) {
        void editor.destroy()
        return
      }
      editorRef.current = editor
      baseline = editor.action(getMarkdown())
      if (autoFocus) editor.action((ctx) => ctx.get(editorViewCtx).focus())
    })

    return () => {
      cancelled = true
      const editor = editorRef.current
      editorRef.current = null
      if (editor) void editor.destroy()
      root.replaceChildren()
    }
    // Made once per mount: later changes to defaultValue are ignored, as
    // with any uncontrolled input. Attributes and read-only follow below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Read-only and the ARIA attributes follow their props.
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      view.setProps({ editable: () => !readOnly, attributes: JSON.parse(attributesKey) as Record<string, string> })
    })
  }, [readOnly, attributesKey])

  return (
    <div
      ref={rootRef}
      data-slot="rich-text-editor"
      className={cn(
        'min-h-24 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 type-body text-foreground break-words transition-colors',
        'focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30',
        'has-[[aria-invalid=true]]:border-destructive has-[[aria-invalid=true]]:ring-destructive/20',
        'has-[[aria-readonly=true]]:text-muted-foreground',
        // The same type roles <Markdown> uses, so text reads the same
        // being edited as being read.
        '[&_.ProseMirror]:flex [&_.ProseMirror]:min-h-20 [&_.ProseMirror]:flex-col [&_.ProseMirror]:gap-3',
        '[&_h3]:type-section-title [&_h4]:type-section-title [&_h5]:type-label [&_h6]:type-label',
        '[&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1 [&_ul]:pl-6',
        '[&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-1 [&_ol]:pl-6',
        '[&_li[data-item-type=task]]:-ml-6 [&_li[data-item-type=task]]:flex [&_li[data-item-type=task]]:list-none [&_li[data-item-type=task]]:items-start [&_li[data-item-type=task]]:gap-2',
        '[&_li[data-item-type=task]>input]:mt-1 [&_li[data-item-type=task]>input]:size-4 [&_li[data-item-type=task]>input]:accent-primary',
        '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground',
        '[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:font-mono',
        '[&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:font-mono',
        '[&_hr]:border-border',
        '[&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:type-label',
        // Raw HTML from the text: shown as its characters, never as markup.
        '[&_span[data-type=html]]:rounded [&_span[data-type=html]]:bg-muted [&_span[data-type=html]]:px-1 [&_span[data-type=html]]:font-mono [&_span[data-type=html]]:text-foreground',
        className,
      )}
    />
  )
}
