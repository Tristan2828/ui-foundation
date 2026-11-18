// The rich-text editor behind RichTextEditor, loaded only when one opens
// (rich-text-editor.tsx imports this lazily): Milkdown, a ProseMirror
// editor whose Markdown goes in and out through remark, the same parser
// <Markdown> renders with. Why Milkdown, and what it costs:
// docs/ARCHITECTURE.md "Decisions".
//
// What this file (the wiring) and the rich-text-* files beside it add to
// Milkdown's own presets:
// - Saves go through mergeMarkdown: an untouched document, and every block
//   the person didn't change, saves back as originally written.
// - No HTML in, ever. The preset's "preserve empty line" plugin is left
//   out: it writes an empty paragraph as a raw `<br />`. Raw HTML already
//   in the text shows as its characters (an uneditable chip, Milkdown's
//   html node), and HTML pasted as such a chip becomes plain text. The
//   one thing it writes is the comment after a table that keeps its column
//   widths (src/lib/markdown-table-widths.ts).
// - Headings render from <h3>, like <Markdown>: the page owns <h1> and
//   <h2>. `headingLevel` moves them to where the field sits in the page's
//   outline, as it does <Markdown>'s; only the element moves, never the
//   level the Markdown is saved with (a node view draws it, from the
//   node's own level: rich-text-heading-view.ts). They look like
//   <Markdown>'s (prose-look.ts). A task-list item renders a real checkbox
//   that toggles it (rich-text-task-item-view.ts).
// - Callouts (`> [!NOTE]`, src/lib/markdown-callout.ts): a node of their
//   own, drawn as <Markdown> draws them, the icon a menu of kinds.
// - Tables whose columns fit their words, in a box that scrolls sideways
//   (a tab stop the arrow keys scroll while it does: rich-text-node-views.ts),
//   in one of two looks (`tableLook`: styles/index.css "Tables in written
//   text"). Notion's "add a row" and "add a column" bars, and its grips: one
//   on the column and one on the row the pointer or the caret is in, each
//   a menu to insert, move, delete, align, sort and colour
//   (rich-text-table-grips.tsx); right-click or Shift+F10 in a cell opens
//   the cell's. A column's right edge drags to a width (double-click:
//   back to fit its words), and the menus hold Narrower, Wider and Fit to
//   content; none of that on a phone, which fits columns to their words.
//   Tab in the last cell adds a row and Enter goes down a
//   column (rich-text-table.ts). Colours and a header column are kept as
//   Markdown writes them (src/lib/markdown-table.ts).
// - Edited blocks are written in the document's own bullet and rule marks.
// - Markdown pasted as plain text arrives formatted (still no HTML), and a
//   copy out of the editor is Markdown. A paste keeps its lines, Word's
//   and Notion's lists and to-dos, and code's language; an address pasted
//   or typed becomes a link; a paste can't bring in a link that runs code
//   or an image as `data:` (rich-text-paste.ts, rich-text-autolink.ts).
// - An edit the merge refuses is never saved quietly: the field is marked
//   invalid, and says why in itself when the app gives no `onProblem`
//   (with one, the app shows it: a form's field error, editing in
//   place's line).
// - Full screen holds focus: the page behind it is inert until it ends
//   (rich-text-full-screen.ts).
// - A click on a link opens it in a new tab, as the read view's links do,
//   so notes that are always the editor still follow their links
//   (followLink, rich-text-links.ts). Ctrl/Cmd+K adds or edits a link (a
//   box at the caret, rich-text-link-box.tsx: web
//   and email addresses only); Ctrl/Cmd+Shift+Enter ticks the task item the caret is
//   in. `[] ` at a line's start makes a task item, and Enter in one the
//   next, unticked (rich-text-tasks.ts). Ctrl/Cmd+Enter stays the field's
//   save, in a table too. Notion's block keys (Ctrl+Shift+1 for a
//   heading, +5 for bullets, …: rich-text-shortcuts.ts).
// - A placeholder in an empty document, and a count of the Markdown's
//   length as it nears `maxLength`.
// - A fixed toolbar above the text (rich-text-toolbar.tsx), and a
//   floating one over selected words (rich-text-floating-toolbar.tsx),
//   unless `toolbar={false}`; `toolbar="floating"` leaves out the fixed
//   one. Alt+F10 reaches the floating one when it shows, else the fixed one.
// - A slash menu (rich-text-slash.ts, rich-text-slash-menu.tsx): "/" at a
//   line's start lists the blocks it can become, also unless
//   `toolbar={false}`.
// - `inline`: the field drawn as the text it edits (no border, no box),
//   for notes that are always editable where they're read.
// - Images in the text show (`![alt](url)`), at most the field's width.
//   With `upload`, an image pasted, dropped or picked with the toolbar's
//   Image button is uploaded through it and goes in as `![](url)`
//   (rich-text-image-upload.ts); a refusal or a failed upload is a toast.
// - Toggle headings (`## Safety {toggle="true"}`, rich-text-toggle-heading.ts):
//   a heading's `toggle` attribute, typed as `>## `, picked from the slash
//   menu or the toolbar. A plain heading is the default.
// - `foldKey`: the text folds by its toggle headings, as <Markdown> does
//   (rich-text-fold.ts), remembered on this device and shared with
//   NotesOutline; the document never changes.
// - `pageLink`: links the app marks as its pages drawn as page links
//   (rich-text-page-links.ts), opened in this tab; `onCreatePage`: "/page"
//   and Turn into page make one through the app and link it (a title box,
//   rich-text-page-box.tsx). The Markdown stays a plain link.
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useInRouterContext, useNavigate } from 'react-router'
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
  headingSchema,
  paragraphSchema,
  keymap,
  plugins,
  remarkPreserveEmptyLinePlugin,
  schema,
} from '@milkdown/kit/preset/commonmark'
import type { NodeParserSpec } from '@milkdown/kit/transformer'
import { gfm, tableCellSchema, tableHeaderSchema, tableSchema } from '@milkdown/kit/preset/gfm'
import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import { NodeSelection, Plugin, TextSelection, type EditorState } from '@milkdown/kit/prose/state'
import { isInTable, selectedRect, TableMap } from '@milkdown/kit/prose/tables'
import { Decoration, DecorationSet, type EditorView, type NodeView } from '@milkdown/kit/prose/view'
import { $markSchema, $nodeSchema, $prose, $remark, getMarkdown } from '@milkdown/kit/utils'
import { cn } from 'cn'
import { toast } from 'sonner'
import { Popover } from '@/components/ui/popover'
import { acceptAttribute } from '@/lib/image-file'
import { linkHref } from '@/lib/link-href'
import { messageOf } from '@/lib/refusal'
import { restorePage } from './page-restore'
import {
  insertPageLink,
  pageLinksPlugin,
  pendingPagePlugin,
  refreshPageLinks,
  setPendingPage,
  type PageSpan,
} from './rich-text-page-links'
import { passEscapeThrough } from './escape-passthrough'
import { calloutHandler, remarkCalloutNodes, type CalloutKind } from '@/lib/markdown-callout'
import { formatTableWidths, remarkTableWidths } from '@/lib/markdown-table-widths'
import { DEFAULT_HIGHLIGHT, highlightHandler, isHighlightColor, remarkHighlightNodes, type HighlightColor } from '@/lib/markdown-highlight'
import { textTopHeading } from '@/lib/markdown-top-heading'
import { MarkdownMergeError, markdownStyle, mergeMarkdown } from '@/lib/markdown-merge'
import { holdPendingEdit } from '@/lib/pending-edits'
import { foldStore, listenForOtherTabs } from '@/hooks/fold-store'
import { toggleFold } from '@/lib/markdown-fold'
import { DEFAULT_HEADING_LEVEL } from './prose-look'
import { foldPlugin, setFolds } from './rich-text-fold'
import type { RichTextEditorProps } from './rich-text-editor'
import { headingView } from './rich-text-heading-view'
import { taskItemView, toggleTaskItem } from './rich-text-task-item-view'
import { applyLink, followLink, linkTarget } from './rich-text-links'
import { anchorAt } from './rich-text-box-anchor'
import { LinkForm, type LinkBox } from './rich-text-link-box'
import { PageForm, type PageBox } from './rich-text-page-box'
import { RichTextFloatingToolbar } from './rich-text-floating-toolbar'
import { formatOn, tableAt, toggleFormat, type FormatId } from './rich-text-formats'
import { CALLOUT_VARIANTS, FORMAT_GROUPS, HIGHLIGHT_VARIANTS, TOGGLE_HEADING_VARIANTS } from './rich-text-format-items'
import { calloutKind, calloutView, tableView, type Widget, type WidgetRegistry } from './rich-text-node-views'
import { droppedFiles, imageUploadPlugin, pastedImages, uploadImages, uploadPlaceholders } from './rich-text-image-upload'
import { handleShortcut } from './rich-text-shortcuts'
import { splitTaskItem, taskInputRule } from './rich-text-tasks'
import { typedInputRules } from './rich-text-input-rules'
import { edges } from './rich-text-edges'
import { withEmptyParagraphChildren } from './rich-text-empty-paragraph'
import { toggleHeadingInputRule, toggleHeadingRemark, withToggle } from './rich-text-toggle-heading'
import { addRowAtEnd, colorTableCells, fitAllColumns, handleTableKey, previewColumnWidth, runTableAction, setColumnWidth, tableLook as tableLookPlugin, tableWidthsOf, type TableAction, type TableColorScope } from './rich-text-table'
import { TABLE_MENU_EVENT, TableGrips, type TableCell } from './rich-text-table-grips'
import {
  applySlash,
  clearSlash,
  closeSlash,
  slashItems,
  slashOptionId,
  slashPlugin,
  slashQuery,
  type SlashItem,
  type SlashQuery,
} from './rich-text-slash'
import { RichTextSlashMenu } from './rich-text-slash-menu'
import { RichTextToolbar } from './rich-text-toolbar'
import { RichTextToolsBar } from './rich-text-tools-bar'
import { RichTextKeyboardBar } from './rich-text-keyboard-bar'
import { useCoarsePointer } from './rich-text-touch'
import { autolinkPlugin, linkWordBefore } from './rich-text-autolink'
import { useHoldFocus } from './rich-text-full-screen'
import { cleanPasted, NO_IMAGES_HERE, pasteHtml, pasteLinesIntoCell, pastePlainText, type PasteImages } from './rich-text-paste'
import { CalloutKindMenu, TableBar } from './rich-text-widgets'

// The commonmark preset, minus the plugin that writes `<br />`. A $remark
// plugin is a pair (its options and the plugin), spread into `plugins`.
const LEFT_OUT: readonly MilkdownPlugin[] = remarkPreserveEmptyLinePlugin
const COMMONMARK: MilkdownPlugin[] = [
  ...schema,
  ...typedInputRules,
  ...commands,
  ...keymap,
  ...plugins.filter((plugin) => !LEFT_OUT.includes(plugin)),
]

// Callouts: a node of their own, read from the quote remarkCalloutNodes
// marks and written back as one with its marker (calloutHandler).
const calloutRemark = $remark('remarkCalloutNodes', () => remarkCalloutNodes)
const calloutSchema = $nodeSchema('callout', () => ({
  content: 'block+',
  group: 'block',
  defining: true,
  attrs: { kind: { default: 'note' }, marker: { default: null } },
  parseDOM: [
    {
      tag: 'div[data-callout]',
      getAttrs: (dom) => ({ kind: calloutKind((dom as HTMLElement).dataset.callout) }),
    },
  ],
  toDOM: (node) => ['div', { 'data-callout': String(node.attrs.kind) }, 0],
  parseMarkdown: {
    match: (node) => node.type === 'callout',
    runner: (state, node, type) => {
      state.openNode(type, { kind: calloutKind(node.kind), marker: node.marker ?? null }).next(node.children).closeNode()
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'callout',
    runner: (state, node) => {
      state.openNode('callout', undefined, { kind: node.attrs.kind, marker: node.attrs.marker }).next(node.content).closeNode()
    },
  },
}))

// Highlighted words (`==words==`, `=={green}words==`: src/lib/markdown-highlight.ts):
// a mark of their own, its colour an attribute.
const highlightRemark = $remark('remarkHighlightNodes', () => remarkHighlightNodes)
const highlightSchema = $markSchema('highlight', () => ({
  attrs: { color: { default: DEFAULT_HIGHLIGHT } },
  parseDOM: [
    {
      tag: 'mark[data-color]',
      getAttrs: (dom) => {
        const color = (dom as HTMLElement).dataset.color
        return { color: isHighlightColor(color) ? color : DEFAULT_HIGHLIGHT }
      },
    },
  ],
  toDOM: (mark) => ['mark', { 'data-color': String(mark.attrs.color) }, 0],
  parseMarkdown: {
    match: (node) => node.type === 'highlight',
    runner: (state, node, type) => {
      state.openMark(type, { color: isHighlightColor(node.color) ? node.color : DEFAULT_HIGHLIGHT })
      state.next(node.children)
      state.closeMark(type)
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'highlight',
    runner: (state, mark) => {
      state.withMark(mark, 'highlight', undefined, { color: mark.attrs.color })
    },
  },
}))

// A table's cell colours and header column, drawn from the Markdown that
// keeps them (rich-text-table.ts tableLook).
const tableDecorations = $prose(() => tableLookPlugin())

// A table's column widths: read from the comment after it onto its cells
// (remarkTableWidths), and written back as that comment after the table,
// the one piece of HTML the editor writes (src/lib/markdown-table-widths.ts).
const tableWidthsRemark = $remark('remarkTableWidths', () => remarkTableWidths)
const tableWithWidths = tableSchema.extendSchema((previous) => (ctx) => {
  const base = previous(ctx)
  return {
    ...base,
    toMarkdown: {
      match: base.toMarkdown.match,
      runner: (state, node) => {
        base.toMarkdown.runner(state, node)
        const { headers, widths } = tableWidthsOf(node)
        const comment = formatTableWidths(headers, widths)
        if (comment) state.addNode('html', undefined, comment)
      },
    },
  }
})
// Milkdown's own cell reader, with the width the comment put on the cell.
const readCell: NodeParserSpec['runner'] = (state, node, type) => {
  const attrs = { alignment: node.align as string, colwidth: typeof node.columnWidth === 'number' ? [node.columnWidth] : null }
  state.openNode(type, attrs).openNode(state.schema.nodes.paragraph).next(node.children).closeNode().closeNode()
}
const cellWithWidth = tableCellSchema.extendSchema((previous) => (ctx) => {
  const base = previous(ctx)
  return { ...base, parseMarkdown: { match: base.parseMarkdown.match, runner: readCell } }
})
const headerWithWidth = tableHeaderSchema.extendSchema((previous) => (ctx) => {
  const base = previous(ctx)
  return { ...base, parseMarkdown: { match: base.parseMarkdown.match, runner: readCell } }
})

// Milkdown's image node wants a string title, and remark reads an image
// with none (`![alt](url)`, nearly every one) as a `null` title: the node
// refused it, and the image was dropped as the text loaded. An empty
// title is written back as none.
type MdImage = { type: string; title?: string | null; children?: MdImage[] }
function emptyImageTitles(node: MdImage) {
  if (node.type === 'image' && node.title == null) node.title = ''
  node.children?.forEach(emptyImageTitles)
}
const imageTitles = $remark('imageTitles', () => () => (tree: unknown) => emptyImageTitles(tree as MdImage))

// What the field says when the merge refuses an edit (markdown-merge.ts):
// to the app's `onProblem`, and in the field itself.
// How long typing has to stop before the edit is turned back into
// Markdown (mergeMarkdown) and reported through onChange (F6).
export const MERGE_PAUSE_MS = 300

// Every format a toolbar can show as on.
const SHOWN_FORMATS: FormatId[] = [
  ...new Set([...FORMAT_GROUPS.flat(), ...TOGGLE_HEADING_VARIANTS, ...CALLOUT_VARIANTS, ...HIGHLIGHT_VARIANTS].map((item) => item.id)),
]

// What the editor's React parts draw from its state, as one string: the
// formats on, the selection (where only when there is one: a caret's
// place matters to nothing drawn but the slash menu and a table's grips),
// the slash menu's query, a table's caret cell and the uploads. A key
// that doesn't change it re-renders nothing (F6).
function shownKey(state: EditorState): string {
  const { selection } = state
  const parts: (string | number)[] = [selection.empty ? 'caret' : `${selection.from}-${selection.to}`]
  if (selection instanceof NodeSelection) parts.push('node')
  if (selection.$from.parent.type.spec.code) parts.push('code')
  if (!selection.empty && selection.$from.sameParent(selection.$to)) parts.push('one-block')
  parts.push(SHOWN_FORMATS.filter((id) => formatOn(state, id)).join(','))
  const slash = slashQuery(state)
  if (slash) parts.push(`slash:${slash.from}:${slash.to}:${slash.query}`)
  const table = tableAt(state)
  if (table && isInTable(state)) {
    const { top, left } = selectedRect(state)
    parts.push(`table:${table.pos}:${top}:${left}`)
  }
  parts.push(`uploads:${uploadPlaceholders(state).length}`)
  return parts.join('|')
}

const REFUSED_EDIT = "This change can't be saved without rewriting parts of the text you didn't edit. Undo it to go on saving."

// The router's navigate, handed to the editor's callbacks: rendered only
// inside a router, so an editor outside one still works (a page link
// then loads the page).
function NavigateBridge({ targetRef }: { targetRef: RefObject<((href: string) => void) | null> }) {
  const navigate = useNavigate()
  useEffect(() => {
    targetRef.current = (href) => void navigate(href)
    return () => {
      targetRef.current = null
    }
  }, [navigate, targetRef])
  return null
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
  inline = false,
  upload,
  imageAccept,
  imageMaxSize,
  headingLevel = DEFAULT_HEADING_LEVEL,
  headingFrom = 'hash',
  foldKey,
  tableLook = 'compact',
  pageLink,
  onCreatePage,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
}: RichTextEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const [linkBox, setLinkBox] = useState<LinkBox | null>(null)
  // The new page's title box, and whether the app is making the page.
  const [pageBox, setPageBox] = useState<PageBox | null>(null)
  const [pageBusy, setPageBusy] = useState(false)
  // Opens the title box: from the slash menu's keys (set up once) too.
  const startPageRef = useRef<(view: EditorView, span: PageSpan, title: string) => void>(() => {})
  const pickSlashImageRef = useRef<(view: EditorView, span: SlashQuery) => void>(() => {})
  // The router's navigate, for a page link's click (NavigateBridge).
  const navigateRef = useRef<((href: string) => void) | null>(null)
  const inRouter = useInRouterContext()
  const [length, setLength] = useState(defaultValue.length)
  // Why the last edit can't be saved, shown in the field (REFUSED_EDIT).
  const [refused, setRefused] = useState<string | null>(null)
  // The editor's state after each change, for the toolbar's pressed buttons.
  const [editorState, setEditorState] = useState<EditorState | null>(null)
  const [editorView, setEditorView] = useState<EditorView | null>(null)
  // For the floating toolbar: focus is in the text (or on the floating
  // toolbar), the mouse is down choosing words, and the selection Esc hid
  // it for.
  const [focused, setFocused] = useState(false)
  const [selecting, setSelectingState] = useState(false)
  // Set only when it changes: a key sets it false, and React would draw
  // the whole editor again for the first key after a click (F6).
  const selectingRef = useRef(false)
  const setSelecting = (next: boolean) => {
    if (selectingRef.current === next) return
    selectingRef.current = next
    setSelectingState(next)
  }
  const [dismissed, setDismissed] = useState<{ from: number; to: number } | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const floatingRef = useRef<HTMLDivElement>(null)
  const toolsRef = useRef<HTMLDivElement>(null)
  // The field's element, which the floating toolbar is placed against.
  const [field, setField] = useState<HTMLDivElement | null>(null)
  // Whether the floating toolbar shows, for the editor's keys (set up once).
  const floatingOpenRef = useRef(false)
  // The slash menu's highlighted item, for the query it was moved on (a
  // new query starts again from the first).
  const [slashActive, setSlashActive] = useState({ key: '', index: 0 })
  // The open slash menu, for the editor's keys (set up once).
  const slashMenuRef = useRef<{ key: string; span: SlashQuery; items: SlashItem[]; index: number } | null>(null)
  // Opens the link box: made with the editor, used by the toolbar's Link.
  const openLinkRef = useRef<(view: EditorView) => void>(() => {})
  // The node views' slots (a callout's icon, a table's bars), each
  // rendered into through a portal.
  const [widgets, setWidgets] = useState<Widget[]>([])
  // The latest props, for the editor's callbacks, which are set up once.
  const latest = useRef({ onChange, onProblem, readOnly, placeholder, upload, imageAccept, imageMaxSize, pageLink, onCreatePage })
  useEffect(() => {
    latest.current = { onChange, onProblem, readOnly, placeholder, upload, imageAccept, imageMaxSize, pageLink, onCreatePage }
  })
  // Whether focus is on the floating toolbar, or in a menu opened from it
  // (the Highlight menu's popup is in a portal).
  const inFloating = (node: Node | null) =>
    Boolean(floatingRef.current?.contains(node) || toolsRef.current?.contains(node) || (node instanceof Element && node.closest('[data-rich-text-menu]')))
  // Full screen: the field fills the window, in place (the editor stays
  // mounted, so nothing is lost).
  const [fullScreen, setFullScreen] = useState(false)
  const fullScreenRef = useRef(false)
  useEffect(() => {
    fullScreenRef.current = fullScreen
    if (!fullScreen) return
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
    }
  }, [fullScreen])
  // The page behind full screen is inert meanwhile (rich-text-full-screen.ts).
  useHoldFocus(field, fullScreen)
  // The toolbar's Image button opens this file picker.
  const imageInputRef = useRef<HTMLInputElement>(null)

  // The fixed bar above the text, and the menus over it (the floating
  // toolbar and the slash menu), which `'floating'` keeps on their own.
  // On a touch screen, the bar pinned to the keyboard in their place
  // (rich-text-keyboard-bar.tsx).
  const coarse = useCoarsePointer()
  const fixedToolbar = toolbar === true && !coarse
  const menus = toolbar !== false

  const ids = useId()
  const counterId = `${ids}-count`
  const problemId = `${ids}-problem`
  // The editable element's id: the app's, or one of its own, so the
  // toolbar can name what it controls.
  const editableId = id ?? `${ids}-text`
  // The count shows from 80% of the limit: below that it's noise.
  const showCount = maxLength !== undefined && length >= maxLength * 0.8
  // The field says it itself when the app hears of it through no
  // `onProblem` (a form that passes none would save the old text quietly).
  const ownProblem = onProblem ? null : refused
  const describedBy = [ariaDescribedBy, ownProblem ? problemId : undefined, showCount ? counterId : undefined].filter(Boolean).join(' ')

  const attributes: Record<string, string> = {
    'aria-multiline': 'true',
    'aria-readonly': String(readOnly),
    class: 'outline-none',
  }
  attributes.id = editableId
  if (ariaLabel) attributes['aria-label'] = ariaLabel
  if (ariaLabelledBy) attributes['aria-labelledby'] = ariaLabelledBy
  if (describedBy) attributes['aria-describedby'] = describedBy
  if (ariaInvalid || refused) attributes['aria-invalid'] = 'true'
  if (placeholder) attributes['aria-placeholder'] = placeholder
  if (menus) attributes['aria-keyshortcuts'] = 'Alt+F10'

  // The slash menu: open while a "/" typed at a line's start is followed
  // by something some block answers to, and the field has focus.
  const slash = menus && !readOnly && focused && editorState ? slashQuery(editorState) : null
  const slashMatches = slash ? slashItems(slash.query, { page: Boolean(onCreatePage), image: Boolean(upload), at: editorState ? { state: editorState, span: slash } : undefined }) : []
  const slashOpen = slash !== null && slashMatches.length > 0
  const slashMenuKey = slash ? `${slash.from}:${slash.query}` : ''
  const slashIndex = slashActive.key === slashMenuKey ? Math.min(slashActive.index, slashMatches.length - 1) : 0
  const slashListId = `${ids}-blocks`
  // The text is the combobox's input: it names the list and the
  // highlighted item, and focus stays in it.
  if (slashOpen) {
    attributes['aria-autocomplete'] = 'list'
    attributes['aria-controls'] = slashListId
    attributes['aria-activedescendant'] = slashOptionId(slashListId, slashIndex)
  }
  const attributesKey = JSON.stringify(attributes)


  // The editor is made once, from the Markdown it opened with.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const original = defaultValue
    // The level that takes headingLevel, read from the text it loads.
    const textTop = headingFrom === 'text' ? textTopHeading(original) : 1
    let baseline: string | null = null
    let cancelled = false
    // The last shownKey React drew.
    let shown = ''

    // The merge runs a pause after typing stops (MERGE_PAUSE_MS), not on
    // every key: its cost grows with the note (F6). Anything about to read
    // the value first asks for it (flushPendingEdits, src/lib/pending-edits.ts),
    // and leaving the text, Esc, Ctrl/Cmd+Enter, hiding the page and
    // unmounting report it at once.
    let pause: ReturnType<typeof setTimeout> | undefined
    let release: (() => void) | null = null
    const editedSoon = () => {
      clearTimeout(pause)
      pause = setTimeout(emit, MERGE_PAUSE_MS)
      if (!release) release = holdPendingEdit(emit)
    }

    const emit = () => {
      clearTimeout(pause)
      pause = undefined
      if (!release) return
      release()
      release = null
      const editor = editorRef.current
      if (!editor || baseline === null) return
      const current = editor.action(getMarkdown())
      try {
        const merged = mergeMarkdown(original, baseline, current)
        setRefused(null)
        latest.current.onProblem?.(null)
        latest.current.onChange(merged)
        setLength(merged.length)
      } catch (error) {
        if (!(error instanceof MarkdownMergeError)) throw error
        // onChange isn't called: the app keeps the last text that could
        // be saved, and the field says why it stopped.
        setRefused(REFUSED_EDIT)
        latest.current.onProblem?.(REFUSED_EDIT)
      }
    }

    const changes = $prose(
      () =>
        new Plugin({
          view: () => ({
            update: (view, previous) => {
              if (cancelled) return
              // React hears of the state only when something it draws
              // from it changed (shownKey): most keys re-render nothing.
              const key = shownKey(view.state)
              if (key !== shown) {
                shown = key
                setEditorState(view.state)
                // Esc hides the floating toolbar for one selection only.
                if (view.state.selection.empty) setDismissed(null)
              }
              if (!view.state.doc.eq(previous.doc)) editedSoon()
            },
          }),
          props: {
            // Word's lists, to-dos and code languages, before the HTML is read.
            transformPastedHTML: (html) => pasteHtml(html),
            // No HTML, no link that runs code, no image as `data:`; in a
            // cell, one line (rich-text-paste.ts).
            transformPasted: (slice, view) => {
              const { slice: cleaned, images, dropped } = cleanPasted(view, slice, Boolean(latest.current.upload))
              if (images.length > 0 || dropped > 0) setTimeout(() => pastedImagesLanded(view, { images, dropped }), 0)
              return cleaned
            },
          },
        }),
    )

    // The node views' slots, by slot; React hears of a change once per
    // task, however many node views changed in it.
    const slots = new Map<HTMLElement, Widget>()
    let syncQueued = false
    const sync = () => {
      if (syncQueued) return
      syncQueued = true
      queueMicrotask(() => {
        syncQueued = false
        if (!cancelled) setWidgets([...slots.values()])
      })
    }
    const registry: WidgetRegistry = {
      set: (widget) => {
        const before = slots.get(widget.slot)
        if (before && before.type === widget.type && (before.type !== 'callout' || before.kind === (widget as typeof before).kind)) return
        slots.set(widget.slot, widget)
        sync()
      },
      remove: (slot) => {
        if (slots.delete(slot)) sync()
      },
    }

    // Opens the link box at the start of what the link applies to.
    const openLink = (view: EditorView) => {
      if (!view.editable) return
      const target = linkTarget(view.state)
      setLinkBox({ ...target, anchor: anchorAt(view, target.from) })
    }

    openLinkRef.current = openLink

    // Folding by headings, with `foldKey` (read once, when it mounts):
    // the fold store is the state, the plugin draws it.
    const folds =
      foldKey === undefined
        ? []
        : [$prose(() => foldPlugin({ initial: foldStore.get(foldKey), onChange: (folded) => foldStore.set(foldKey, folded) }))]
    const onFold = foldKey === undefined ? undefined : (id: string) => foldStore.set(foldKey, toggleFold(foldStore.get(foldKey), id))
    let stopFolds = () => {}

    // Paste, copy, the editor's own keys and the placeholder.
    const slashing = $prose(() => slashPlugin())

    // Page links, drawn from the app's `pageLink`; and where a page being
    // made will be linked.
    const pageLinks = $prose(() =>
      pageLinksPlugin({ resolve: () => latest.current.pageLink, restore: restorePage, editable: () => !latest.current.readOnly }),
    )
    const pendingPages = $prose(() => pendingPagePlugin())
    // An address typed and ended with a space becomes a link.
    const autolink = $prose(() => autolinkPlugin())

    // Images pasted or dropped, uploaded through the app's `upload`; with
    // none given, a paste or drop is left to the handlers after this one,
    // as if this weren't here.
    const imageUploads = $prose(() => imageUploadPlugin())
    const startUploads = (view: EditorView, files: File[], at: number | null) => {
      const { upload: send, imageAccept: accept, imageMaxSize: maxSize } = latest.current
      if (!send) return false
      uploadImages(view, files, at, { upload: send, accept, maxSize, onError: (message) => toast.error(message) })
      return true
    }
    // Images a paste carried as `data:`: uploaded at the caret once the
    // paste is in, or, with no `upload`, said no to.
    const pastedImagesLanded = (view: EditorView, { images, dropped }: PasteImages) => {
      if (cancelled || view.isDestroyed) return
      if (images.length > 0) startUploads(view, images, null)
      if (dropped > 0) toast.error(NO_IMAGES_HERE)
    }
    const imageInput = $prose(
      () =>
        new Plugin({
          props: {
            // Without `upload`, an image file pasted or dropped says it
            // can't go in (any words with it still paste).
            handlePaste: (view, event) => {
              if (!view.editable) return false
              const files = pastedImages(event.clipboardData)
              if (files.length === 0) return false
              if (!latest.current.upload) {
                toast.error(NO_IMAGES_HERE)
                if (event.clipboardData?.getData('text/plain')) return false
                event.preventDefault()
                return true
              }
              event.preventDefault()
              return startUploads(view, files, null)
            },
            // Files from outside (a text or an image moved within the
            // editor carries none).
            handleDrop: (view, event, _slice, moved) => {
              if (moved || !view.editable) return false
              const files = droppedFiles(event.dataTransfer)
              if (files.length === 0) return false
              event.preventDefault()
              if (!latest.current.upload) {
                toast.error(NO_IMAGES_HERE)
                return true
              }
              const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.from
              return startUploads(view, files, at)
            },
          },
        }),
    )

    const input = $prose(
      (ctx) =>
        new Plugin({
          props: {
            // Plain text is read as Markdown, so `## Notes` or `**bold**`
            // copied from another app arrives formatted; raw HTML in it
            // still arrives as text. A paste with HTML of its own (from a
            // web page) is ProseMirror's, through transformPasted above,
            // but for an address pasted over words, which links them
            // (rich-text-paste.ts).
            handlePaste: (view, event) => {
              const data = event.clipboardData
              if (!data || !view.editable) return false
              return pastePlainText(view, data.getData('text/plain'), {
                parse: (markdown) => ctx.get(parserCtx)(markdown) as ProseNode | string | null,
                hasHtml: Boolean(data.getData('text/html')),
                uploads: Boolean(latest.current.upload),
                onImages: (images) => pastedImagesLanded(view, images),
              })
            },
            // A copy is Markdown, so it pastes into a plain text field
            // (or another Markdown editor) as written.
            clipboardTextSerializer: (slice) => {
              const doc = slice.content.firstChild?.isBlock
                ? ctx.get(schemaCtx).topNodeType.createAndFill(undefined, slice.content)
                : null
              return doc ? ctx.get(serializerCtx)(doc) : slice.content.textBetween(0, slice.content.size, '\n\n')
            },
            handleDOMEvents: {
              focus: () => {
                setFocused(true)
                return false
              },
              // Moving to the floating toolbar keeps it showing.
              // Leaving the text reports what was typed (F6).
              blur: (_view, event) => {
                emit()
                if (!inFloating(event.relatedTarget as Node | null)) setFocused(false)
                return false
              },
              // A click on a link follows it (followLink).
              click: (view, event) =>
                followLink(view, event, {
                  resolve: latest.current.pageLink,
                  open: (href) => (navigateRef.current ? navigateRef.current(href) : window.location.assign(href)),
                }),
              // The floating toolbar waits for the mouse to be up: a drag
              // is still choosing the words.
              mousedown: (_view, event) => {
                if (event.button !== 0) return false
                setDismissed(null)
                setSelecting(true)
                window.addEventListener('mouseup', () => setSelecting(false), { once: true })
                return false
              },
            },
            handleKeyDown: (view, event) => {
              setSelecting(false)
              // Esc and Ctrl/Cmd+Enter are the field's (save, close): what
              // was typed is reported before they reach it (F6).
              if (event.key === 'Escape' || (event.key === 'Enter' && (event.metaKey || event.ctrlKey))) emit()
              // Alt+F10: to the floating toolbar when it shows, else the
              // fixed one (the convention editors share).
              if (event.altKey && event.key === 'F10') {
                const bar = floatingOpenRef.current ? floatingRef.current : (toolbarRef.current ?? toolsRef.current)
                const button = bar?.querySelector<HTMLElement>('button[tabindex="0"]')
                if (!button) return false
                event.preventDefault()
                button.focus()
                return true
              }
              // Esc hides the floating toolbar first; only the next one
              // reaches the field (editing in place gives up on it).
              if (event.key === 'Escape' && floatingOpenRef.current) {
                event.preventDefault()
                const { from, to } = view.state.selection
                setDismissed({ from, to })
                return true
              }
              // Esc leaves full screen, and goes no further.
              if (event.key === 'Escape' && fullScreenRef.current) {
                event.preventDefault()
                setFullScreen(false)
                return true
              }
              // An Esc nothing over the text took: the field's to act on,
              // though ProseMirror will mark it handled.
              if (event.key === 'Escape') passEscapeThrough(event)
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
              // An empty task item the caret is in says where typing goes.
              const { $from, empty } = state.selection
              if (empty && $from.parent.type.name === 'paragraph' && $from.parent.content.size === 0 && $from.depth >= 2) {
                const item = $from.node($from.depth - 1)
                if (item.type.name === 'list_item' && item.attrs.checked != null)
                  return DecorationSet.create(state.doc, [Decoration.node($from.before(), $from.after(), { 'data-placeholder': 'To-do' })])
              }
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
        ctx.update(remarkStringifyOptionsCtx, (options) => ({
          ...options,
          ...markdownStyle(original),
          handlers: { ...options.handlers, callout: calloutHandler as never, highlight: highlightHandler as never },
        }))
        // Headings carry `toggle` (rich-text-toggle-heading.ts).
        ctx.update(headingSchema.key, withToggle)
        // An empty paragraph keeps its `children` (rich-text-empty-paragraph.ts).
        ctx.update(paragraphSchema.key, withEmptyParagraphChildren)
        ctx.update(editorViewOptionsCtx, (options) => ({
          ...options,
          editable: () => !latest.current.readOnly,
          attributes,
          // Lines pasted into a table cell: one line, before the table's
          // own paste spreads them over the row (rich-text-paste.ts).
          handlePaste: (view, event) => {
            const data = event.clipboardData
            if (!data || !view.editable || data.getData('text/html')) return false
            return pasteLinesIntoCell(view, data.getData('text/plain'))
          },
          // The slash menu's keys, the editor's own shortcuts and its table
          // keys, as view props: before Milkdown's own keymap, whose Enter
          // would split the line (or leave a table).
          handleKeyDown: (view, event) => {
            const menu = slashMenuRef.current
            const plain = !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey
            if (menu) {
              const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
              if (step && plain) {
                event.preventDefault()
                const count = menu.items.length
                setSlashActive({ key: menu.key, index: (menu.index + step + count) % count })
                return true
              }
              if ((event.key === 'Enter' || event.key === 'Tab') && plain) {
                event.preventDefault()
                const item = menu.items[menu.index]
                if (item.id === 'page') startPageRef.current(view, menu.span, '')
                else if (item.id === 'image') pickSlashImageRef.current(view, menu.span)
                else applySlash(view, menu.span, item.id)
                return true
              }
              // Esc closes the menu only: the field's own Esc (editing in
              // place gives up the edit) waits for the next one.
              if (event.key === 'Escape') {
                event.preventDefault()
                view.dispatch(closeSlash(view.state))
                return true
              }
            }
            if (!view.editable) return false
            if (handleShortcut(view.state, view.dispatch, event)) return true
            if (handleTableKey(view.state, view.dispatch, event)) return true
            // Shift+F10 or the menu key in a table: the cell's menu, from its grips.
            if (((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') && isInTable(view.state)) {
              const at = view.domAtPos(view.state.selection.from).node
              const frame = (at instanceof Element ? at : at.parentElement)?.closest('[data-slot=rich-text-table]')
              if (frame) {
                event.preventDefault()
                frame.dispatchEvent(new CustomEvent(TABLE_MENU_EVENT))
                return true
              }
            }
            // Enter after a typed address links it first (rich-text-autolink.ts).
            if (event.key === 'Enter' && !event.isComposing && !event.metaKey && !event.ctrlKey) linkWordBefore(view)
            // Enter in a task item: the next one, unticked (rich-text-tasks.ts).
            if (event.key === 'Enter' && plain && !event.isComposing && splitTaskItem(view.state, view.dispatch)) return true
            // Ctrl/Cmd+Enter in a table is the field's (a save), not
            // Milkdown's "leave the table": taken here, so its keymap never
            // sees it, and left to reach the field.
            const mod = event.metaKey || event.ctrlKey
            return mod && !event.shiftKey && !event.altKey && event.key === 'Enter' && isInTable(view.state)
          },
          nodeViews: {
            // The level when it mounts, as with defaultValue.
            heading: (node, _view, _getPos, decorations) => headingView(node, headingLevel, textTop, decorations, onFold),
            callout: (node, _view, getPos) => calloutView(node, getPos, registry),
            table: (node, view, getPos) => tableView(node, view, getPos, registry),
            list_item: (node, view, getPos) =>
              node.attrs.checked == null ? (undefined as unknown as NodeView) : taskItemView(node, view, getPos),
          },
        }))
      })
      .use(edges)
      .use(COMMONMARK)
      .use(gfm)
      .use(taskInputRule)
      .use(toggleHeadingRemark)
      .use(toggleHeadingInputRule)
      .use(calloutRemark)
      .use(calloutSchema)
      .use(highlightRemark)
      .use(highlightSchema)
      .use(tableDecorations)
      .use(tableWidthsRemark)
      .use(tableWithWidths)
      .use(cellWithWidth)
      .use(headerWithWidth)
      .use(imageTitles)
      .use(history)
      .use(changes)
      .use(slashing)
      .use(pageLinks)
      .use(pendingPages)
      .use(imageUploads)
      .use(imageInput)
      .use(input)
      .use(autolink)
      .use(folds)

    void make.create().then((editor) => {
      if (cancelled) {
        void editor.destroy()
        return
      }
      editorRef.current = editor
      baseline = editor.action(getMarkdown())
      const view = editor.action((ctx) => ctx.get(editorViewCtx))
      setEditorView(view)
      shown = shownKey(view.state)
      setEditorState(view.state)
      if (autoFocus) editor.action((ctx) => ctx.get(editorViewCtx).focus())
      if (foldKey !== undefined) {
        listenForOtherTabs()
        stopFolds = foldStore.subscribe(foldKey, () => view.dispatch(setFolds(view.state, foldStore.get(foldKey))))
      }
    })

    // Hiding the page (another tab, a phone's home screen) reports what
    // was typed: the page may not come back.
    const onHidden = () => {
      if (document.visibilityState === 'hidden') emit()
    }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', emit)

    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', emit)
      // Unmounting reports what was typed since the last pause.
      emit()
      cancelled = true
      stopFolds()
      setEditorState(null)
      setEditorView(null)
      const editor = editorRef.current
      editorRef.current = null
      if (editor) void editor.destroy()
      root.replaceChildren()
    }
    // Made once per mount. A new defaultValue the editor didn't report
    // remounts it (RichTextEditor's key), so it isn't read here.
    // Attributes and read-only follow below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The page links follow the app's answers (a page renamed, removed or
  // restored): redrawn only when those have changed.
  useEffect(() => {
    if (editorView) refreshPageLinks(editorView, pageLink, !readOnly)
  })

  // Read-only and the ARIA attributes follow their props.
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      view.setProps({ editable: () => !readOnly, attributes: JSON.parse(attributesKey) as Record<string, string> })
    })
  }, [readOnly, attributesKey])

  // The toolbar's Image button: the file picker, then each file picked
  // uploaded in place of the selection, and focus back in the text.
  const pickImages = () => imageInputRef.current?.click()
  // The slash menu's Image (4.123): the "/…" goes, then the file picker;
  // the images go in at the caret, where the "/" was.
  // A tick later: Chrome opens no picker for a click made inside the
  // editor's own keydown (Enter on the item); the key's activation lasts.
  const pickSlashImage = (view: EditorView, span: SlashQuery) => {
    clearSlash(view, span)
    setTimeout(pickImages, 0)
  }
  const imagesPicked = (files: File[]) => {
    const send = latest.current.upload
    if (!editorView || !send || files.length === 0) return
    uploadImages(editorView, files, null, {
      upload: send,
      accept: imageAccept,
      maxSize: imageMaxSize,
      onError: (message) => toast.error(message),
    })
    editorView.focus()
  }
  const uploading = editorState ? uploadPlaceholders(editorState).length : 0

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

  // The editable element: where a menu over the text gives focus back
  // (ProseMirror puts the caret back where it was as it takes it).
  const textElement = () => editorView?.dom ?? null

  // A grip's menu item, on the cell it was opened for: the caret into
  // that cell, the action, and focus back in the text.
  const caretInto = (getPos: () => number | undefined, cell: TableCell): boolean => {
    if (!editorView) return false
    const pos = getPos()
    const table = pos === undefined ? null : editorView.state.doc.nodeAt(pos)
    if (pos === undefined || table?.type.name !== 'table') return false
    const map = TableMap.get(table)
    if (cell.row >= map.height || cell.column >= map.width) return false
    const at = pos + 1 + map.map[cell.row * map.width + cell.column] + 1
    editorView.dispatch(editorView.state.tr.setSelection(TextSelection.near(editorView.state.doc.resolve(at))))
    return true
  }
  const runTableAt = (getPos: () => number | undefined, cell: TableCell, action: TableAction) => {
    if (!editorView || !caretInto(getPos, cell)) return
    runTableAction(editorView.state, editorView.dispatch, action)
    editorView.focus()
  }
  const colorTableAt = (getPos: () => number | undefined, cell: TableCell, scope: TableColorScope, color: HighlightColor | null) => {
    if (!editorView || !caretInto(getPos, cell)) return
    colorTableCells(editorView.state, editorView.dispatch, scope, color)
    editorView.focus()
  }

  // A column's width from its edge or menu (`null`: automatic), `'all'`
  // every column automatic.
  const widthTableAt = (getPos: () => number | undefined, column: number, width: number | null | 'all') => {
    const pos = getPos()
    if (!editorView || pos === undefined) return
    if (width === 'all') fitAllColumns(editorView.state, editorView.dispatch, pos)
    else setColumnWidth(editorView.state, editorView.dispatch, pos, column, width)
  }
  const previewTableWidth = (getPos: () => number | undefined, column: number, width: number | null) => {
    const tablePos = getPos()
    if (!editorView || tablePos === undefined) return
    previewColumnWidth(editorView.state, editorView.dispatch, width === null ? null : { tablePos, column, width })
  }

  // A callout's menu: its kind changed, or the callout taken away (its
  // blocks kept). The menu gives focus back to the text.
  const changeCallout = (getPos: () => number | undefined, kind: CalloutKind | null) => {
    if (!editorView) return
    const pos = getPos()
    const node = pos === undefined ? null : editorView.state.doc.nodeAt(pos)
    if (pos === undefined || node?.type.name !== 'callout') return
    const tr = editorView.state.tr
    if (kind) tr.setNodeMarkup(pos, undefined, { ...node.attrs, kind })
    else tr.replaceWith(pos, pos + node.nodeSize, node.content).setSelection(TextSelection.near(tr.doc.resolve(pos + 1)))
    editorView.dispatch(tr)
  }

  // A table's bar: the caret into its last cell, then a row at its end
  // (the caret into its first cell) or a column at its right (the caret
  // into its header).
  const addToTable = (getPos: () => number | undefined, side: 'row' | 'column') => {
    if (!editorView) return
    const pos = getPos()
    const table = pos === undefined ? null : editorView.state.doc.nodeAt(pos)
    if (pos === undefined || table?.type.name !== 'table') return
    const last = TextSelection.near(editorView.state.doc.resolve(pos + table.nodeSize - 1), -1)
    editorView.dispatch(editorView.state.tr.setSelection(last))
    if (side === 'row') addRowAtEnd(editorView.state, editorView.dispatch)
    else if (runTableAction(editorView.state, editorView.dispatch, 'columnRight')) {
      const added = editorView.state.doc.nodeAt(pos)!
      const map = TableMap.get(added)
      const header = TextSelection.near(editorView.state.doc.resolve(pos + 1 + map.map[map.width - 1] + 1))
      editorView.dispatch(editorView.state.tr.setSelection(header).scrollIntoView())
    }
    editorView.focus()
  }
  const caretTable = editorState ? tableAt(editorState)?.pos : undefined
  // The caret's cell, for its table's grips: only while the text has focus.
  const caretCell: TableCell | null = (() => {
    if (!focused || !editorState || caretTable === undefined || !isInTable(editorState)) return null
    const { top, left } = selectedRect(editorState)
    return { row: top, column: left }
  })()

  // The floating toolbar: words selected, focus in the field, the mouse up,
  // and nothing else open over the text.
  const selection = editorState?.selection
  const floatingOpen = Boolean(
    menus &&
      !coarse &&
      !readOnly &&
      editorView &&
      focused &&
      !selecting &&
      linkBox === null &&
      pageBox === null &&
      selection &&
      !selection.empty &&
      !(selection instanceof NodeSelection) &&
      !selection.$from.parent.type.spec.code &&
      !(dismissed && dismissed.from === selection.from && dismissed.to === selection.to),
  )
  useEffect(() => {
    floatingOpenRef.current = floatingOpen
  })
  const returnToText = () => editorView?.focus()
  // The tools strip of a field with only the floating toolbar.
  const toolsOpen = Boolean(toolbar === 'floating' && !coarse && editorView && (focused || fullScreen))
  const toggleFullScreen = () => {
    setFullScreen((on) => !on)
    editorView?.focus()
  }
  // Esc on the toolbar leaves full screen too (a menu's own Esc, in its
  // portal, isn't ours).
  const leaveFullScreen = (event: ReactKeyboardEvent) => {
    if (!fullScreen || event.key !== 'Escape' || event.defaultPrevented || !event.currentTarget.contains(event.target as Node)) return
    event.preventDefault()
    event.stopPropagation()
    setFullScreen(false)
    editorView?.focus()
  }

  useEffect(() => {
    slashMenuRef.current = slashOpen && slash ? { key: slashMenuKey, span: slash, items: slashMatches, index: slashIndex } : null
  })

  // The new page's title box: opened for the "/page" typed (left as it is
  // until the page is made) or the words selected, which the link will
  // replace. The span is kept in step with the text meanwhile.
  const startPage = (view: EditorView, span: PageSpan, title: string) => {
    if (!view.editable || !latest.current.onCreatePage) return
    view.dispatch(setPendingPage(closeSlash(view.state), { from: span.from, to: span.to }))
    setPageBox({ title, anchor: anchorAt(view, span.from) })
  }
  useEffect(() => {
    startPageRef.current = startPage
    pickSlashImageRef.current = pickSlashImage
  })
  // Selected words in one block (a double-click takes the space after a
  // word too: the link gets the words, the spaces stay).
  const selectionInOneBlock = Boolean(editorState && editorState.selection.$from.sameParent(editorState.selection.$to))
  const pageFromSelection = () => {
    if (!editorView) return
    const { from, to } = editorView.state.selection
    const text = editorView.state.doc.textBetween(from, to)
    const start = from + (text.length - text.trimStart().length)
    const end = Math.max(start, to - (text.length - text.trimEnd().length))
    startPage(editorView, { from: start, to: end }, text.replace(/\s+/g, ' ').trim())
  }
  // Closed without a page: the text as it was, the caret back in it.
  const closePage = () => {
    setPageBox(null)
    setPageBusy(false)
    if (editorView) {
      editorView.dispatch(setPendingPage(editorView.state.tr, null))
      editorView.focus()
    }
  }
  // The app makes the page; its link goes in once it has. A refusal is
  // the box's to show (in the gateway's words): the text isn't touched.
  const createPage = async (title: string): Promise<string | null> => {
    const create = latest.current.onCreatePage
    if (!create) return "Pages can't be made here."
    setPageBusy(true)
    let href: string | null
    try {
      href = linkHref(await create(title))
    } catch (error) {
      setPageBusy(false)
      return messageOf(error)
    }
    setPageBusy(false)
    if (!href) return "The new page's address can't be linked."
    const view = editorRef.current?.action((ctx) => ctx.get(editorViewCtx))
    if (!view || !insertPageLink(view, title, href)) {
      toast.error(`${title} was made, but its link couldn't go in here. Add it with Ctrl+K.`)
      setPageBox(null)
      return null
    }
    setPageBox(null)
    view.focus()
    return null
  }

  const closeLink = () => {
    setLinkBox(null)
    editorRef.current?.action((ctx) => ctx.get(editorViewCtx).focus())
  }

  return (
    <>
      <div
        ref={setField}
        data-slot="rich-text-editor"
        data-table-look={tableLook}
        data-full-screen={fullScreen || undefined}
        // Full screen is a dialog over the page, named as the field is.
        role={fullScreen ? 'dialog' : undefined}
        aria-modal={fullScreen || undefined}
        aria-labelledby={fullScreen ? ariaLabelledBy : undefined}
        aria-label={fullScreen && !ariaLabelledBy ? (ariaLabel ?? 'Text') : undefined}
        onKeyDown={leaveFullScreen}
        className={cn(
          fullScreen ? 'fixed inset-0 z-50 h-dvh rounded-none! border-0! bg-background! ring-0!' : 'relative',
          'flex w-full min-w-0 flex-col bg-transparent type-body text-foreground break-words',
          // Inline, it's the text itself: the caret shows where it's
          // edited, and a refusal's reason under it says what's wrong.
          !inline &&
            'rounded-lg border border-input transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30',
          !inline && 'has-[[aria-invalid=true]]:border-destructive has-[[aria-invalid=true]]:ring-destructive/20',
          className,
        )}
      >
        {fixedToolbar && (
          <RichTextToolbar
            ref={toolbarRef}
            state={editorState}
            readOnly={readOnly}
            // Only once the editor is made: until then the editable element,
            // and its id, aren't in the page (axe: aria-valid-attr-value).
            controls={editorState ? editableId : undefined}
            onFormat={runFormat}
            onImage={upload ? pickImages : undefined}
            onFullScreen={toggleFullScreen}
            fullScreen={fullScreen}
            text={textElement}
          />
        )}
        {upload && (
          <input
            ref={imageInputRef}
            type="file"
            accept={acceptAttribute(imageAccept)}
            multiple
            hidden
            tabIndex={-1}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? [])
              // Cleared, so picking the same file again still counts.
              event.target.value = ''
              imagesPicked(files)
            }}
          />
        )}
        <div
          ref={rootRef}
          data-fold-scope={foldKey}
          className={cn(
            !inline && 'min-h-24 px-2.5 py-2',
            // Full screen: the text scrolls under the toolbar, in a column to read.
            fullScreen && 'min-h-0 flex-1 overflow-y-auto px-4 py-3 md:px-8 [&_.ProseMirror]:mx-auto [&_.ProseMirror]:w-full [&_.ProseMirror]:max-w-3xl',
            // Read-only text is muted; the toolbar's buttons say so by being disabled.
            'has-[[aria-readonly=true]]:text-muted-foreground',
            // The same type roles <Markdown> uses, so text reads the same
            // being edited as being read.
            '[&_.ProseMirror]:flex [&_.ProseMirror]:flex-col [&_.ProseMirror]:gap-3',
            // PROSE_INSET, on the editable element: with a heading's band
            // in the text, the rest lines up with the words in it.
            '[&_.ProseMirror:has(>[data-band])>:not([data-band])]:mx-3',
            !inline && '[&_.ProseMirror]:min-h-20',
            // ProseMirror's own required style (prosemirror-view's CSS): spaces
            // as typed, so one at the end of a line isn't kept as &nbsp;.
            '[&_.ProseMirror]:whitespace-pre-wrap [&_.ProseMirror]:break-words',
            '[&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1 [&_ul]:pl-6',
            '[&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-1 [&_ol]:pl-6',
            '[&_li[data-item-type=task]]:-ml-6 [&_li[data-item-type=task]]:flex [&_li[data-item-type=task]]:list-none [&_li[data-item-type=task]]:items-start [&_li[data-item-type=task]]:gap-2',
            // Highlighted words: the colour's wash, the text's own colour on it.
            '[&_mark]:rounded-sm [&_mark]:text-foreground [&_mark[data-color=amber]]:bg-highlight-amber [&_mark[data-color=yellow]]:bg-highlight-yellow [&_mark[data-color=green]]:bg-highlight-green [&_mark[data-color=red]]:bg-highlight-red',
            // Headings, callouts and tables are drawn by their node views;
            // these are the elements Milkdown draws itself.
            '[&_a]:cursor-pointer [&_a]:text-link [&_a]:underline [&_a]:decoration-link/40 [&_a]:underline-offset-4',
            '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground',
            '[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:font-mono',
            '[&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:font-mono',
            '[&_hr]:my-2 [&_hr]:h-0.5 [&_hr]:rounded-full [&_hr]:border-0 [&_hr]:bg-rule',
            '[&_hr.ProseMirror-selectednode]:outline-2 [&_hr.ProseMirror-selectednode]:outline-offset-4 [&_hr.ProseMirror-selectednode]:outline-ring',
            // An image, as <Markdown> shows it: never wider than the field.
            // (ProseMirror's own separator images, around an image alone on
            // its line, are left alone.)
            '[&_img[src]]:inline-block [&_img[src]]:h-auto [&_img[src]]:max-w-full [&_img[src]]:rounded-md [&_img[src]]:align-bottom',
            '[&_img.ProseMirror-selectednode]:outline-2 [&_img.ProseMirror-selectednode]:outline-offset-2 [&_img.ProseMirror-selectednode]:outline-ring',
            // Raw HTML from the text: shown as its characters, never as markup.
            '[&_span[data-type=html]]:rounded [&_span[data-type=html]]:bg-muted [&_span[data-type=html]]:px-1 [&_span[data-type=html]]:font-mono [&_span[data-type=html]]:text-foreground',
            // The placeholder, in an empty document only (a decoration).
            '[&_p[data-placeholder]]:before:pointer-events-none [&_p[data-placeholder]]:before:float-left [&_p[data-placeholder]]:before:h-0 [&_p[data-placeholder]]:before:text-muted-foreground [&_p[data-placeholder]]:before:content-[attr(data-placeholder)]',
          )}
        />
        {ownProblem && (
          // In the field, so it's seen wherever the field is (full screen
          // too).
          <p
            id={problemId}
            role="alert"
            data-slot="rich-text-editor-problem"
            className={cn('type-caption text-destructive-text', inline ? 'pt-1' : 'border-t border-border px-2.5 py-1.5', fullScreen && 'px-4 md:px-8')}
          >
            {ownProblem}
          </p>
        )}
        {widgets.map((widget) => {
          if (widget.type === 'callout')
            return createPortal(
              <CalloutKindMenu
                kind={widget.kind}
                readOnly={readOnly}
                onPick={(kind) => changeCallout(widget.getPos, kind)}
                onRemove={() => changeCallout(widget.getPos, null)}
                text={textElement}
              />,
              widget.slot,
              widget.key,
            )
          const active = caretTable !== undefined && caretTable === widget.getPos()
          return [
            createPortal(
              <TableBar side="row" active={active} readOnly={readOnly} onAdd={() => addToTable(widget.getPos, 'row')} />,
              widget.slot,
              `${widget.key}-row`,
            ),
            createPortal(
              <TableBar side="column" active={active} readOnly={readOnly} onAdd={() => addToTable(widget.getPos, 'column')} />,
              widget.column,
              `${widget.key}-column`,
            ),
            editorView &&
              createPortal(
                <TableGrips
                  view={editorView}
                  caret={active ? caretCell : null}
                  getPos={widget.getPos}
                  frame={widget.frame}
                  box={widget.box}
                  table={widget.table}
                  readOnly={readOnly}
                  onAction={(cell, action) => runTableAt(widget.getPos, cell, action)}
                  onColor={(cell, scope, color) => colorTableAt(widget.getPos, cell, scope, color)}
                  onWidth={(column, width) => widthTableAt(widget.getPos, column, width)}
                  onPreviewWidth={(column, width) => previewTableWidth(widget.getPos, column, width)}
                  text={textElement}
                />,
                widget.grips,
                `${widget.key}-grips`,
              ),
          ]
        })}
        {slashOpen && slash && editorView && (
          <RichTextSlashMenu
            id={slashListId}
            view={editorView}
            at={slash.to}
            field={field}
            items={slashMatches}
            active={slashIndex}
            onHighlight={(index) => setSlashActive({ key: slashMenuKey, index })}
            onPick={(item) =>
              item === 'page'
                ? startPage(editorView, slash, '')
                : item === 'image'
                  ? pickSlashImage(editorView, slash)
                  : applySlash(editorView, slash, item)
            }
          />
        )}
        {coarse && menus && editorView && (focused || fullScreen) && (
          <RichTextKeyboardBar
            ref={toolbarRef}
            pressing={selecting}
            view={editorView}
            state={editorState}
            readOnly={readOnly}
            controls={editableId}
            onFormat={runFormat}
            onImage={upload ? pickImages : undefined}
            onFullScreen={toggleFullScreen}
            fullScreen={fullScreen}
            text={textElement}
            onBlur={(event) => {
              const next = event.relatedTarget as Node | null
              if (!editorView.dom.contains(next) && !inFloating(next)) setFocused(false)
            }}
          />
        )}
        {toolsOpen && (
          <RichTextToolsBar
            ref={toolsRef}
            state={editorState}
            readOnly={readOnly}
            fullScreen={fullScreen}
            controls={editableId}
            onFormat={runFormat}
            onFullScreen={toggleFullScreen}
            onReturn={returnToText}
            onBlur={(event) => {
              const next = event.relatedTarget as Node | null
              if (editorView && !editorView.dom.contains(next) && !inFloating(next)) setFocused(false)
            }}
          />
        )}
        {floatingOpen && editorView && editorState && (
          <RichTextFloatingToolbar
            ref={floatingRef}
            view={editorView}
            state={editorState}
            field={field}
            controls={editableId}
            onFormat={runFormat}
            onPage={onCreatePage && selectionInOneBlock ? pageFromSelection : undefined}
            onDismiss={() => setDismissed({ from: editorState.selection.from, to: editorState.selection.to })}
            onReturn={returnToText}
            onBlur={(event) => {
              const next = event.relatedTarget as Node | null
              if (!editorView.dom.contains(next) && !inFloating(next)) setFocused(false)
            }}
          />
        )}
      </div>
      {upload && (
        // The placeholders in the text are drawn, not read: this says
        // what's uploading.
        <p role="status" className="sr-only">
          {uploading > 0 ? `Uploading ${uploading === 1 ? 'an image' : `${uploading} images`}…` : ''}
        </p>
      )}
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
      {inRouter && <NavigateBridge targetRef={navigateRef} />}
      <Popover open={pageBox !== null} onOpenChange={(open) => !open && !pageBusy && closePage()}>
        {pageBox && <PageForm box={pageBox} busy={pageBusy} onCreate={createPage} />}
      </Popover>
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
