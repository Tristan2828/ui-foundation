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
// - Markdown pasted as plain text arrives formatted (still no HTML), and a
//   copy out of the editor is Markdown.
// - Ctrl/Cmd+K adds or edits a link (a box at the caret: web and email
//   addresses only); Ctrl/Cmd+Shift+Enter ticks the task item the caret is
//   in. Ctrl/Cmd+Enter stays the field's save.
// - A placeholder in an empty document, and a count of the Markdown's
//   length as it nears `maxLength`.
// - A fixed toolbar above the text (rich-text-toolbar.tsx), unless
//   `toolbar={false}`.
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  defaultValueCtx,
  Editor,
  editorViewCtx,
  editorViewOptionsCtx,
  parserCtx,
  remarkStringifyOptionsCtx,
  rootCtx,
  schemaCtx,
  serializerCtx,
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
import { Plugin, type EditorState } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet, type EditorView, type NodeView } from '@milkdown/kit/prose/view'
import { $prose, getMarkdown } from '@milkdown/kit/utils'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent } from '@/components/ui/popover'
import { linkHref } from '@/lib/link-href'
import { MarkdownMergeError, markdownStyle, mergeMarkdown } from '@/lib/markdown-merge'
import type { RichTextEditorProps } from './rich-text-editor'
import { toggleFormat, type FormatId } from './rich-text-formats'
import { RichTextToolbar } from './rich-text-toolbar'

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

// The task-list item the caret is in, ticked or unticked. False when the
// caret isn't in one.
function toggleTaskItem(view: EditorView): boolean {
  const { $from } = view.state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (node.type.name === 'list_item' && node.attrs.checked != null) {
      view.dispatch(view.state.tr.setNodeMarkup($from.before(depth), undefined, { ...node.attrs, checked: !node.attrs.checked }))
      return true
    }
  }
  return false
}

// What a link edit applies to: the selection, or with nothing selected
// the whole link the caret is in (else just the caret), and the address it
// has now (`''` when none).
type LinkTarget = { from: number; to: number; href: string }

function linkTarget(state: EditorState): LinkTarget {
  const link = state.schema.marks.link
  const { from, to, empty, $from } = state.selection
  if (!empty) {
    let href = ''
    state.doc.nodesBetween(from, to, (node) => {
      const mark = link.isInSet(node.marks)
      if (mark && !href) href = String(mark.attrs.href)
    })
    return { from, to, href }
  }
  const mark = link.isInSet($from.marks())
  if (!mark) return { from, to, href: '' }
  const start = $from.start()
  let target: LinkTarget = { from, to, href: String(mark.attrs.href) }
  let runFrom = -1
  $from.parent.forEach((child, offset) => {
    const childFrom = start + offset
    const childTo = childFrom + child.nodeSize
    if (!mark.isInSet(child.marks)) {
      runFrom = -1
      return
    }
    if (runFrom < 0) runFrom = childFrom
    if (runFrom <= from && from <= childTo) target = { from: runFrom, to: childTo, href: target.href }
  })
  return target
}

// Sets (or, with `href` empty, removes) the link on the target. With
// nothing selected and no link there, the address goes in as the link's
// own text.
function applyLink(view: EditorView, target: LinkTarget, href: string) {
  const link = view.state.schema.marks.link
  const tr = view.state.tr
  if (target.from === target.to) {
    if (!href) return
    tr.insertText(href, target.from).addMark(target.from, target.from + href.length, link.create({ href }))
  } else {
    tr.removeMark(target.from, target.to, link)
    if (href) tr.addMark(target.from, target.to, link.create({ href }))
  }
  view.dispatch(tr.scrollIntoView())
}

type LinkBox = LinkTarget & {
  anchor: { getBoundingClientRect: () => DOMRect; contextElement: Element }
}

export default function MilkdownEditor({
  id,
  defaultValue,
  onChange,
  onProblem,
  readOnly = false,
  autoFocus = false,
  placeholder,
  maxLength,
  toolbar = true,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
}: RichTextEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const [linkBox, setLinkBox] = useState<LinkBox | null>(null)
  const [length, setLength] = useState(defaultValue.length)
  // The editor's state after each change, for the toolbar's pressed buttons.
  const [editorState, setEditorState] = useState<EditorState | null>(null)
  // Opens the link box: made with the editor, used by the toolbar's Link.
  const openLinkRef = useRef<(view: EditorView) => void>(() => {})
  // The latest props, for the editor's callbacks, which are set up once.
  const latest = useRef({ onChange, onProblem, readOnly, placeholder })
  useEffect(() => {
    latest.current = { onChange, onProblem, readOnly, placeholder }
  })

  const ids = useId()
  const counterId = `${ids}-count`
  // The editable element's id: the app's, or one of its own, so the
  // toolbar can name what it controls.
  const editableId = id ?? `${ids}-text`
  // The count shows from 80% of the limit: below that it's noise.
  const showCount = maxLength !== undefined && length >= maxLength * 0.8
  const describedBy = [ariaDescribedBy, showCount ? counterId : undefined].filter(Boolean).join(' ')

  const attributes: Record<string, string> = {
    'aria-multiline': 'true',
    'aria-readonly': String(readOnly),
    class: 'outline-none',
  }
  attributes.id = editableId
  if (ariaLabel) attributes['aria-label'] = ariaLabel
  if (ariaLabelledBy) attributes['aria-labelledby'] = ariaLabelledBy
  if (describedBy) attributes['aria-describedby'] = describedBy
  if (ariaInvalid) attributes['aria-invalid'] = 'true'
  if (placeholder) attributes['aria-placeholder'] = placeholder
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
        setLength(merged.length)
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
              if (cancelled) return
              setEditorState(view.state)
              if (!view.state.doc.eq(previous.doc)) emit()
            },
          }),
          props: {
            transformPasted: (slice) => new Slice(htmlToText(slice.content), slice.openStart, slice.openEnd),
          },
        }),
    )

    // Opens the link box at the start of what the link applies to.
    const openLink = (view: EditorView) => {
      if (!view.editable) return
      const target = linkTarget(view.state)
      const point = view.coordsAtPos(target.from)
      setLinkBox({
        ...target,
        anchor: {
          getBoundingClientRect: () => new DOMRect(point.left, point.top, 0, point.bottom - point.top),
          contextElement: view.dom,
        },
      })
    }

    openLinkRef.current = openLink

    // Paste, copy, the editor's own keys and the placeholder.
    const input = $prose(
      (ctx) =>
        new Plugin({
          props: {
            // Plain text is read as Markdown, so `## Notes` or `**bold**`
            // copied from another app arrives formatted; raw HTML in it
            // still arrives as text. A paste with HTML of its own (from a
            // web page) is ProseMirror's, through transformPasted above.
            handlePaste: (view, event) => {
              const data = event.clipboardData
              if (!data || !view.editable || data.getData('text/html')) return false
              const text = data.getData('text/plain')
              if (!text || view.state.selection.$from.parent.type.spec.code) return false
              const parsed = ctx.get(parserCtx)(text)
              if (!parsed || typeof parsed === 'string') return false
              // Text with no Markdown in it (one plain paragraph) goes in
              // exactly as typed, spaces at its ends kept.
              const only = parsed.childCount === 1 ? parsed.firstChild : null
              if (only?.type.name === 'paragraph' && only.childCount === 1 && only.textContent === text.trim()) {
                view.dispatch(view.state.tr.insertText(text).scrollIntoView())
                return true
              }
              view.dispatch(view.state.tr.replaceSelection(Slice.maxOpen(htmlToText(parsed.content))).scrollIntoView())
              return true
            },
            // A copy is Markdown, so it pastes into a plain text field
            // (or another Markdown editor) as written.
            clipboardTextSerializer: (slice) => {
              const doc = slice.content.firstChild?.isBlock
                ? ctx.get(schemaCtx).topNodeType.createAndFill(undefined, slice.content)
                : null
              return doc ? ctx.get(serializerCtx)(doc) : slice.content.textBetween(0, slice.content.size, '\n\n')
            },
            handleKeyDown: (view, event) => {
              const mod = event.metaKey || event.ctrlKey
              if (mod && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'k') {
                event.preventDefault()
                openLink(view)
                return true
              }
              // Ctrl/Cmd+Shift+Enter in a task item ticks it, and goes no
              // further. Anywhere else it reaches the field, which saves.
              if (mod && event.shiftKey && event.key === 'Enter' && view.editable && toggleTaskItem(view)) {
                event.preventDefault()
                event.stopPropagation()
                return true
              }
              return false
            },
            decorations: (state) => {
              const text = latest.current.placeholder
              const only = state.doc.childCount === 1 ? state.doc.firstChild : null
              if (!text || !only || only.type.name !== 'paragraph' || only.content.size > 0) return null
              return DecorationSet.create(state.doc, [Decoration.node(0, only.nodeSize, { 'data-placeholder': text })])
            },
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
      .use(input)

    void make.create().then((editor) => {
      if (cancelled) {
        void editor.destroy()
        return
      }
      editorRef.current = editor
      baseline = editor.action(getMarkdown())
      setEditorState(editor.action((ctx) => ctx.get(editorViewCtx).state))
      if (autoFocus) editor.action((ctx) => ctx.get(editorViewCtx).focus())
    })

    return () => {
      cancelled = true
      setEditorState(null)
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

  // A toolbar button: its format on the selection, then focus back in the
  // text (Link opens the link box instead, which gives it back on close).
  const runFormat = (format: FormatId) => {
    editorRef.current?.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      if (format === 'link') {
        openLinkRef.current(view)
        return
      }
      toggleFormat(view.state, view.dispatch, format)
      view.focus()
    })
  }

  const closeLink = () => {
    setLinkBox(null)
    editorRef.current?.action((ctx) => ctx.get(editorViewCtx).focus())
  }

  return (
    <>
      <div
        data-slot="rich-text-editor"
        className={cn(
          'flex w-full min-w-0 flex-col rounded-lg border border-input bg-transparent type-body text-foreground break-words transition-[border-color,box-shadow]',
          'focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30',
          'has-[[aria-invalid=true]]:border-destructive has-[[aria-invalid=true]]:ring-destructive/20',
          className,
        )}
      >
        {toolbar && (
          <RichTextToolbar
            state={editorState}
            readOnly={readOnly}
            // Only once the editor is made: until then the editable element,
            // and its id, aren't in the page (axe: aria-valid-attr-value).
            controls={editorState ? editableId : undefined}
            onFormat={runFormat}
          />
        )}
        <div
          ref={rootRef}
          className={cn(
            'min-h-24 px-2.5 py-2',
            // Read-only text is muted; the toolbar's buttons say so by being disabled.
            'has-[[aria-readonly=true]]:text-muted-foreground',
            // The same type roles <Markdown> uses, so text reads the same
            // being edited as being read.
            '[&_.ProseMirror]:flex [&_.ProseMirror]:min-h-20 [&_.ProseMirror]:flex-col [&_.ProseMirror]:gap-3',
            // ProseMirror's own required style (prosemirror-view's CSS): spaces
            // as typed, so one at the end of a line isn't kept as &nbsp;.
            '[&_.ProseMirror]:whitespace-pre-wrap [&_.ProseMirror]:break-words',
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
            // The placeholder, in an empty document only (a decoration).
            '[&_p[data-placeholder]]:before:pointer-events-none [&_p[data-placeholder]]:before:float-left [&_p[data-placeholder]]:before:h-0 [&_p[data-placeholder]]:before:text-muted-foreground [&_p[data-placeholder]]:before:content-[attr(data-placeholder)]',
          )}
        />
      </div>
      {showCount && (
        <p
          id={counterId}
          data-slot="rich-text-editor-count"
          className={cn('text-right type-caption tabular-nums', length > maxLength ? 'text-destructive-text' : 'text-muted-foreground')}
        >
          {length > maxLength
            ? `${(length - maxLength).toLocaleString()} characters over the limit of ${maxLength.toLocaleString()}`
            : `${length.toLocaleString()} of ${maxLength.toLocaleString()} characters`}
        </p>
      )}
      <Popover open={linkBox !== null} onOpenChange={(open) => !open && closeLink()}>
        {linkBox && (
          <LinkForm
            box={linkBox}
            onApply={(href) => {
              const editor = editorRef.current
              editor?.action((ctx) => applyLink(ctx.get(editorViewCtx), linkBox, href))
              closeLink()
            }}
          />
        )}
      </Popover>
    </>
  )
}

// The link box: the address, Apply, and Remove link for an existing one.
// Enter (Ctrl/Cmd+Enter too) applies the link and stays its own: editing
// in place listens for Ctrl/Cmd+Enter through the portal, and would save
// the field without it. Esc is the popover's: it closes the box only.
function LinkForm({ box, onApply }: { box: LinkBox; onApply: (href: string) => void }) {
  const [typed, setTyped] = useState(box.href)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const errorId = `${inputId}-error`

  const apply = () => {
    const href = linkHref(typed)
    if (href === null) {
      setError('Enter a web or email address, like https://example.com.')
      return
    }
    onApply(href)
  }

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === 'Enter' && event.target === inputRef.current) {
      event.preventDefault()
      event.stopPropagation()
      apply()
    }
  }

  return (
    <PopoverContent
      anchor={box.anchor}
      align="start"
      aria-label={box.href ? 'Edit link' : 'Add link'}
      initialFocus={inputRef}
      finalFocus={false}
      className="w-80"
      onKeyDown={onKeyDown}
    >
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor={inputId}>Link address</FieldLabel>
        <Input
          ref={inputRef}
          id={inputId}
          value={typed}
          placeholder="https://"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setTyped(event.target.value)
            setError(null)
          }}
        />
        {error && <FieldError id={errorId}>{error}</FieldError>}
      </Field>
      <div className="flex gap-2">
        <Button size="sm" onClick={apply}>
          Apply
        </Button>
        {box.href && (
          <Button size="sm" variant="outline" onClick={() => onApply('')}>
            Remove link
          </Button>
        )}
      </div>
    </PopoverContent>
  )
}
