// What a paste into the rich-text editor arrives as (milkdown-editor.tsx
// wires each piece in):
//
// - pasteHtml, before ProseMirror reads a paste's HTML: Word's list
//   paragraphs (`mso-list`) become list items, a Notion or GitHub to-do a
//   task item with its tick, and `language-*` on code a code block's
//   language.
// - cleanPasted, on what ProseMirror read from the HTML: raw HTML chips
//   become their text; a link whose address linkHref refuses
//   (`javascript:`) keeps its words, not the link; an image whose address
//   is refused is dropped, and one carried in the HTML as `data:` is taken
//   out to be uploaded (with `upload`) or said no to; and in a table cell,
//   the blocks join with spaces, as a GFM cell is one line.
// - pastePlainText, for a paste with no HTML: read as Markdown (still no
//   HTML), its single line breaks kept as hard breaks (an address pasted
//   as three lines stays three lines); a web or email address alone
//   becomes a link, or links the words selected; text into a table cell
//   joins its lines with spaces.
//
// React-free; the DOM only through DOMParser and File. Its rules are unit
// tested in a browser by e2e/rich-text-editor.spec.ts "paste".
import { Fragment, Slice, type Node as ProseNode, type Schema } from '@milkdown/kit/prose/model'
import type { EditorView } from '@milkdown/kit/prose/view'
import { linkHref } from '@/lib/link-href'

/** What a paste says when it carries images the field can't take. */
export const NO_IMAGES_HERE = "Images can't be added here."

// A web or email address and nothing else (spaces at its ends aside):
// `https://…`, `http://…`, `www.…`, `name@example.com`, or `mailto:`.
const WEB = /^(?:https?:\/\/[^\s<>]+\.?[^\s<>]*|www\.[^\s<>.]+\.[^\s<>]+)$/i
const EMAIL = /^(?:mailto:)?[^\s@<>()[\]]+@[^\s@<>()[\]]+\.[a-z]{2,}$/i

/** The address `text` is, when it is one web or email address alone; else `null`. */
export function addressOf(text: string): string | null {
  const value = text.trim()
  if (!WEB.test(value) && !EMAIL.test(value)) return null
  if (/^https?:\/\/$/i.test(value)) return null
  const href = linkHref(value)
  return href ? href : null
}

/** Whether the caret (or the selection's start) is in a table cell. */
function inTableCell(view: EditorView): boolean {
  const { $from } = view.state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    const role = $from.node(depth).type.spec.tableRole
    if (role === 'cell' || role === 'header_cell') return true
  }
  return false
}

function inCode(view: EditorView): boolean {
  const { $from, from, to } = view.state.selection
  if ($from.parent.type.spec.code) return true
  let code = false
  view.state.doc.nodesBetween(from, Math.max(to, from + 1), (node) => {
    if (node.marks.some((mark) => mark.type.spec.code)) code = true
  })
  return code || $from.marks().some((mark) => mark.type.spec.code)
}

// ---------------------------------------------------------------- HTML

const MSO_LEVEL = /mso-list:\s*\S+\s+level(\d+)/i

// Word's list marker, for whether its list is numbered: `1.`, `a)`, `iv.`.
function wordMarkerOrdered(marker: string): boolean {
  return /^\(?[0-9a-z]{1,4}[.)]$/i.test(marker.replace(/\s+/g, ''))
}

// Word writes a list as paragraphs, each with its level in its style and
// its marker (`·` and spaces, or `1.`) in a span it hides from itself.
// Each run of them becomes a list, nested by level.
function wordLists(doc: Document) {
  const paragraphs = Array.from(doc.querySelectorAll('p')).filter((p) => MSO_LEVEL.test(p.getAttribute('style') ?? ''))
  const done = new Set<Element>()
  for (const first of paragraphs) {
    if (done.has(first)) continue
    const run: Element[] = []
    let next: Element | null = first
    while (next && next.tagName === 'P' && MSO_LEVEL.test(next.getAttribute('style') ?? '')) {
      run.push(next)
      done.add(next)
      next = next.nextElementSibling
    }
    const root = doc.createElement('div')
    first.before(root)
    // The open lists, one per level.
    const stack: { level: number; list: HTMLElement }[] = []
    for (const paragraph of run) {
      const level = Number(MSO_LEVEL.exec(paragraph.getAttribute('style') ?? '')![1])
      const ignored = Array.from(paragraph.querySelectorAll('span')).filter((span) =>
        /mso-list:\s*ignore/i.test(span.getAttribute('style') ?? ''),
      )
      const marker = ignored.map((span) => span.textContent ?? '').join('').trim()
      ignored.forEach((span) => span.remove())
      const tag = wordMarkerOrdered(marker) ? 'ol' : 'ul'
      while (stack.length > 0 && stack[stack.length - 1].level > level) stack.pop()
      let top = stack[stack.length - 1]
      if (!top || top.level < level || top.list.tagName.toLowerCase() !== tag) {
        if (top && top.level === level) stack.pop()
        const list = doc.createElement(tag)
        const parentItem = stack.length > 0 ? stack[stack.length - 1].list.lastElementChild : null
        ;(parentItem ?? root).append(list)
        top = { level, list }
        stack.push(top)
      }
      const item = doc.createElement('li')
      const words = doc.createElement('p')
      words.append(...Array.from(paragraph.childNodes))
      item.append(words)
      top.list.append(item)
      paragraph.remove()
    }
    root.replaceWith(...Array.from(root.childNodes))
  }
}

// A to-do: Notion's (`ul.to-do-list`, its box a `div.checkbox`, ticked
// `checkbox-on`) or a page's own (`li` holding a checkbox input, as
// GitHub's). Each becomes the task item Milkdown reads, its box gone.
function toDos(doc: Document) {
  for (const item of Array.from(doc.querySelectorAll('li'))) {
    const notionBox = item.querySelector(':scope > .checkbox, :scope > div > .checkbox')
    const input = item.querySelector<HTMLInputElement>(':scope > input[type=checkbox], :scope > p > input[type=checkbox]')
    const notion = item.closest('ul.to-do-list') !== null || notionBox !== null
    if (!notion && !input) continue
    const checked = input
      ? input.checked || input.hasAttribute('checked')
      : Boolean(notionBox?.classList.contains('checkbox-on') || item.querySelector('.to-do-children-checked'))
    notionBox?.remove()
    input?.remove()
    item.setAttribute('data-item-type', 'task')
    item.setAttribute('data-checked', String(checked))
  }
}

// `<pre><code class="language-js">`: the language onto the code block
// (Milkdown reads `pre[data-language]`).
function codeLanguages(doc: Document) {
  for (const pre of Array.from(doc.querySelectorAll('pre'))) {
    if (pre.dataset.language) continue
    const named = [pre, ...Array.from(pre.querySelectorAll('code'))]
      .flatMap((element) => Array.from(element.classList))
      .find((name) => /^(language|lang)-/.test(name))
    const language = named?.replace(/^(language|lang)-/, '').toLowerCase()
    if (language) pre.dataset.language = language
  }
}

/** A paste's HTML, before ProseMirror reads it: Word's lists, to-dos and code languages made readable. */
export function pasteHtml(html: string): string {
  if (typeof DOMParser === 'undefined') return html
  if (!/mso-list|checkbox|to-do|language-|lang-/i.test(html)) return html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  wordLists(doc)
  toDos(doc)
  codeLanguages(doc)
  return doc.body.innerHTML
}

// ---------------------------------------------------------------- slices

// A `data:` image's bytes, as a file to upload; `null` when it isn't an
// image in base64.
function dataImageFile(src: string, index: number): File | null {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]*)$/i.exec(src)
  if (!match) return null
  try {
    const binary = atob(match[2].replace(/\s+/g, ''))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const extension = match[1].split('/')[1].replace(/\+.*$/, '')
    return new File([bytes], `pasted-${index + 1}.${extension}`, { type: match[1] })
  } catch {
    return null
  }
}

type Cleaned = { content: Fragment; images: File[]; droppedImages: number }

function clean(fragment: Fragment, found: Cleaned): Fragment {
  const nodes: ProseNode[] = []
  fragment.forEach((node) => {
    const schema = node.type.schema
    if (node.type.name === 'html') {
      // Raw HTML as Milkdown's chip becomes the text it shows.
      const value = String(node.attrs.value ?? '')
      if (value) nodes.push(schema.text(value, node.marks))
      return
    }
    if (node.type.name === 'image') {
      const src = String(node.attrs.src ?? '')
      if (/^data:/i.test(src)) {
        const file = dataImageFile(src, found.images.length)
        if (file) found.images.push(file)
        else found.droppedImages++
        return
      }
      if (!src || linkHref(src) === null) {
        found.droppedImages++
        return
      }
    }
    // A link linkHref refuses keeps its words.
    const link = schema.marks.link
    const refused = link ? node.marks.find((mark) => mark.type === link && linkHref(String(mark.attrs.href ?? '')) === null) : undefined
    const marks = refused ? refused.removeFromSet(node.marks) : node.marks
    if (node.isText) nodes.push(schema.text(node.text ?? '', marks))
    else nodes.push(node.type.create(node.attrs, clean(node.content, found), marks))
  })
  return Fragment.fromArray(nodes)
}

// What a cell can hold of a paste: every block's words, joined by spaces
// (a hard break is a space too). A pasted table is left alone: the
// table's own paste puts its cells in place.
function forCell(slice: Slice, schema: Schema): Slice {
  let hasTable = false
  let blocks = 0
  slice.content.descendants((node) => {
    if (node.type.spec.tableRole) hasTable = true
    if (node.isTextblock) blocks++
    return !hasTable
  })
  const onlyParagraph = slice.content.childCount === 1 && slice.content.firstChild?.type === schema.nodes.paragraph
  if (hasTable || (blocks <= 1 && (onlyParagraph || slice.content.firstChild?.isInline))) return slice
  const inline: ProseNode[] = []
  slice.content.descendants((node) => {
    if (!node.isTextblock) return true
    if (node.content.size === 0) return false
    if (inline.length > 0) inline.push(schema.text(' '))
    node.content.forEach((child) => inline.push(child.type.spec.linebreak || child.type.name === 'hardbreak' ? schema.text(' ') : child))
    return false
  })
  if (inline.length === 0) return Slice.empty
  return new Slice(Fragment.from(schema.nodes.paragraph.create(null, inline)), 1, 1)
}

export type PasteImages = {
  /** Images carried in the HTML as `data:`, to upload (none when the field has no `upload`). */
  images: File[]
  /** How many images were left out (no `upload`, or an address that's refused). */
  dropped: number
}

/**
 * A paste, as ProseMirror read it, made safe to save: see the file's
 * opening. `uploads`: whether the field takes images; without it a
 * `data:` image is dropped and counted.
 */
export function cleanPasted(view: EditorView, slice: Slice, uploads: boolean): { slice: Slice } & PasteImages {
  const found: Cleaned = { content: Fragment.empty, images: [], droppedImages: 0 }
  const content = clean(slice.content, found)
  let next = new Slice(content, slice.openStart, slice.openEnd)
  if (inTableCell(view)) next = forCell(next, view.state.schema)
  const images = uploads ? found.images : []
  const dropped = found.droppedImages + (uploads ? 0 : found.images.length)
  return { slice: next, images, dropped }
}

// ---------------------------------------------------------------- plain text

// A paste's soft line breaks (a newline inside a paragraph) as hard
// breaks, so lines pasted as lines stay lines.
function hardBreaks(fragment: Fragment, schema: Schema): Fragment {
  const hard = schema.nodes.hardbreak
  if (!hard) return fragment
  const nodes: ProseNode[] = []
  fragment.forEach((node) => {
    if (node.isText && node.text?.includes('\n')) {
      node.text.split('\n').forEach((part, index) => {
        if (index > 0) nodes.push(hard.create(null, undefined, node.marks.filter((mark) => mark.type.name !== 'link')))
        if (part) nodes.push(schema.text(part, node.marks))
      })
      return
    }
    // Milkdown reads a soft break as an inline hard break, drawn and
    // written as a space and a newline: made a real one.
    if (node.type === hard && node.attrs.isInline) {
      nodes.push(hard.create({ ...node.attrs, isInline: false }, undefined, node.marks))
      return
    }
    if (node.isText || node.isLeaf || node.type.spec.code) nodes.push(node)
    else nodes.push(node.copy(hardBreaks(node.content, schema)))
  })
  return Fragment.fromArray(nodes)
}

/**
 * Lines of plain text pasted into a table cell, joined with spaces (a GFM
 * cell is one line). Called before the table's own paste, which would
 * spread them over the row. Returns whether it was this paste.
 */
export function pasteLinesIntoCell(view: EditorView, text: string): boolean {
  if (!inTableCell(view) || inCode(view) || !/\n/.test(text.trim())) return false
  const line = text.replace(/\s*\r?\n\s*/g, ' ').trimEnd()
  view.dispatch(view.state.tr.insertText(line).scrollIntoView())
  return true
}

export type PlainPaste = {
  /** The editor's Markdown parser. */
  parse: (markdown: string) => ProseNode | string | null | undefined
  /** The clipboard has HTML too: only an address over selected words is this paste's. */
  hasHtml: boolean
  /** Whether the field takes images (`upload`). */
  uploads: boolean
  /** Images the Markdown carried as `data:`, after the paste went in (cleanPasted). */
  onImages: (images: PasteImages) => void
}

/**
 * The paste of `text` (the clipboard's plain text). Returns whether it was
 * handled; else ProseMirror's own paste goes on.
 */
export function pastePlainText(view: EditorView, text: string, { parse, hasHtml, uploads, onImages }: PlainPaste): boolean {
  const { state } = view
  const { selection, schema } = state
  if (!text || inCode(view)) return false
  const address = addressOf(text)
  const link = schema.marks.link

  // An address pasted over selected words links them, the words kept.
  if (address && link && !selection.empty && selection.$from.sameParent(selection.$to) && selection.$from.parent.isTextblock) {
    view.dispatch(state.tr.removeMark(selection.from, selection.to, link).addMark(selection.from, selection.to, link.create({ href: address })).scrollIntoView())
    return true
  }
  if (hasHtml) return false

  // An address alone: a link, its words as pasted.
  if (address && link) {
    const words = text.trim()
    const tr = state.tr.replaceSelectionWith(schema.text(words, [link.create({ href: address })]), false)
    tr.removeStoredMark(link)
    view.dispatch(tr.scrollIntoView())
    return true
  }

  if (pasteLinesIntoCell(view, text)) return true

  const parsed = parse(text.replace(/\r\n?/g, '\n'))
  if (!parsed || typeof parsed === 'string') return false
  // Text with no Markdown in it (one plain line) goes in exactly as typed,
  // spaces at its ends kept.
  const only = parsed.childCount === 1 ? parsed.firstChild : null
  const plainLine =
    only?.type.name === 'paragraph' &&
    only.childCount === 1 &&
    only.firstChild!.isText &&
    only.firstChild!.marks.length === 0 &&
    !text.trim().includes('\n') &&
    only.textContent === text.trim()
  if (plainLine) {
    view.dispatch(state.tr.insertText(text).scrollIntoView())
    return true
  }
  const content = hardBreaks(parsed.content, schema)
  const { slice, images, dropped } = cleanPasted(view, Slice.maxOpen(content), uploads)
  view.dispatch(state.tr.replaceSelection(slice).scrollIntoView())
  if (images.length > 0 || dropped > 0) onImages({ images, dropped })
  return true
}
