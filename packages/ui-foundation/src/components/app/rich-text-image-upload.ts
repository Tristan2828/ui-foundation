// Images uploaded into the rich-text editor: pasted, dropped, or picked
// from the toolbar's Image button, each sent through the app's `upload`
// and inserted as `![](url)` where it was put. Only with `upload` given
// (RichTextEditor's prop): without it, the editor handles none of this.
//
// While a file uploads, a placeholder ("Uploading photo.jpg…") shows where
// it will go. The placeholder is a decoration, not part of the document:
// nothing is saved for it, and an autosave mid-upload saves the text as
// it is. It moves with the text around it, and what's typed at the caret
// meanwhile goes after it, as if the image were already there; when the
// upload resolves, the image goes in where it is now and the placeholder
// goes. If the upload fails, the placeholder goes and `onError` gets the
// reason; if the text around it was deleted meanwhile, the image is
// dropped.
//
// Several files upload at once and go in in the order they came, each
// waiting for the one before it to land or fail.
//
// React-free and DOM-free (but the placeholder's element, made only when
// the view draws it), so its rules are unit tested in node
// (tests/rich-text-image-upload.test.ts).
import { Fragment, Slice, type Node as ProseNode } from '@milkdown/kit/prose/model'
import { Plugin, PluginKey, type EditorState, type Transaction } from '@milkdown/kit/prose/state'
import { dropPoint } from '@milkdown/kit/prose/transform'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import { imageRefusal, uploadFailure, type ImageFileRules, type ImageUpload } from '@/lib/image-file'

type PlaceholderSpec = { id: number; name: string }
// Placeholders added; one taken away (a failure); or one replaced by its
// image, at `at` before the image went in, the ones still waiting there
// moved to `after` it, so the images stay in the order the files came.
type UploadAction =
  | { add: (PlaceholderSpec & { pos: number })[] }
  | { remove: number }
  | { land: number; at: number; after: number }

const uploadKey = new PluginKey<DecorationSet>('rich-text-image-upload')

// The placeholder's element: a muted chip with a spinner, never editable.
function placeholderElement(name: string): HTMLElement {
  const chip = document.createElement('span')
  chip.contentEditable = 'false'
  chip.dataset.slot = 'rich-text-image-upload'
  chip.className =
    'mx-0.5 inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 align-middle type-caption text-foreground'
  const spinner = document.createElement('span')
  spinner.setAttribute('aria-hidden', 'true')
  spinner.className = 'inline-block size-3 animate-spin rounded-full border-2 border-current border-r-transparent'
  chip.append(spinner, `Uploading ${name}…`)
  return chip
}

// A placeholder's decoration. `side: -1`: text typed at its spot goes
// after it, where the image will be.
function placeholder({ id, name, pos }: PlaceholderSpec & { pos: number }): Decoration {
  return Decoration.widget(pos, () => placeholderElement(name), { id, name, key: `upload-${id}`, side: -1 })
}

/** The plugin that holds and draws the placeholders. */
export function imageUploadPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: uploadKey,
    state: {
      init: () => DecorationSet.empty,
      apply: (tr, set) => {
        const mapped = set.map(tr.mapping, tr.doc)
        const action = tr.getMeta(uploadKey) as UploadAction | undefined
        if (!action) return mapped
        if ('add' in action) return mapped.add(tr.doc, action.add.map(placeholder))
        const id = 'remove' in action ? action.remove : action.land
        const rest = mapped.remove(mapped.find(undefined, undefined, (spec: PlaceholderSpec) => spec.id === id))
        if ('remove' in action) return rest
        const at = tr.mapping.map(action.at, -1)
        const waiting = rest.find(at, at).filter((decoration) => decoration.from === at)
        // Made before `remove`, which empties the array it's given.
        const moved = waiting.map((decoration) => placeholder({ ...(decoration.spec as PlaceholderSpec), pos: action.after }))
        return rest.remove(waiting).add(tr.doc, moved)
      },
    },
    props: {
      decorations: (state) => uploadKey.getState(state),
    },
  })
}

/** The uploads in flight: each placeholder's file name and where it is now, in document order. */
export function uploadPlaceholders(state: EditorState): { id: number; name: string; pos: number }[] {
  const set = uploadKey.getState(state)
  if (!set) return []
  return set
    .find()
    .map((decoration) => ({ id: (decoration.spec as PlaceholderSpec).id, name: (decoration.spec as PlaceholderSpec).name, pos: decoration.from }))
    .sort((a, b) => a.pos - b.pos)
}

function placeholderAt(state: EditorState, id: number): number | null {
  return uploadPlaceholders(state).find((placeholder) => placeholder.id === id)?.pos ?? null
}

function imageNode(state: EditorState, src: string): ProseNode {
  return state.schema.nodes.image.create({ src, alt: '', title: '' })
}

// Where an image put at `pos` can go: `pos` itself in text, else the
// nearest place that takes inline content (between two blocks, a new
// paragraph there).
function insertPoint(doc: ProseNode, pos: number, image: ProseNode): number {
  return dropPoint(doc, pos, new Slice(Fragment.from(image), 0, 0)) ?? pos
}

// What the files are uploaded into: the editor's view, or a stand-in in
// a test.
export type UploadTarget = {
  readonly state: EditorState
  dispatch: (tr: Transaction) => void
  readonly isDestroyed?: boolean
}

export type ImageUploadOptions = ImageFileRules & {
  upload: ImageUpload
  /** A file refused before upload (its type, its size), or an upload that failed: why. */
  onError: (message: string) => void
}

let nextId = 0

/**
 * Uploads `files` and inserts each as an image: at `at` (a drop's
 * position), or with `at` null in place of the selection (a paste, the
 * toolbar's button). A file refused by type or size never starts; each
 * refusal's reason goes to `onError`. Returns whether any upload started.
 */
export function uploadImages(target: UploadTarget, files: readonly File[], at: number | null, options: ImageUploadOptions): boolean {
  const accepted: File[] = []
  for (const file of files) {
    const refusal = imageRefusal(file, options)
    if (refusal) options.onError(refusal)
    else accepted.push(file)
  }
  if (accepted.length === 0) return false

  const tr = target.state.tr
  if (at === null && !tr.selection.empty) tr.deleteSelection()
  const pos = insertPoint(tr.doc, at ?? tr.selection.from, imageNode(target.state, ''))
  const uploads = accepted.map((file) => ({ id: ++nextId, file }))
  target.dispatch(tr.setMeta(uploadKey, { add: uploads.map(({ id, file }) => ({ id, name: file.name || 'image', pos })) } satisfies UploadAction))

  type Outcome = { src: string } | { error: unknown }
  const settle = (id: number, outcome: Outcome) => {
    if (target.isDestroyed) return
    const placeholder = placeholderAt(target.state, id)
    if (placeholder === null) return
    const next = target.state.tr
    if ('src' in outcome) {
      const image = imageNode(target.state, outcome.src)
      const where = insertPoint(next.doc, placeholder, image)
      next.replaceWith(where, where, image)
      next.setMeta(uploadKey, { land: id, at: placeholder, after: next.mapping.map(where, -1) + image.nodeSize } satisfies UploadAction)
    } else {
      next.setMeta(uploadKey, { remove: id } satisfies UploadAction)
      options.onError(uploadFailure(outcome.error))
    }
    target.dispatch(next)
  }

  // Every upload starts now; each lands after the one before it.
  let previous = Promise.resolve()
  for (const { id, file } of uploads) {
    const outcome = new Promise<Outcome>((resolve) => resolve(options.upload(file).then((result) => ({ src: result.url ?? result.thumbUrl })))).catch(
      (error: unknown): Outcome => ({ error }),
    )
    previous = previous.then(() => outcome).then((result) => settle(id, result))
  }
  return true
}

type TransferLike = { files?: ArrayLike<File> | null; getData?: (type: string) => string } | null

// Whether pasted HTML has words in it, not just an image. Style and
// script blocks and comments aren't words.
function htmlHasText(html: string): boolean {
  const text = html
    .replace(/<(style|script)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;/g, ' ')
  return text.trim().length > 0
}

/**
 * The files a paste uploads: its files, unless it also carries HTML with
 * words in it. An office app copies a picture of the selection along with
 * its text, and that paste is the text. A screenshot, or an image copied
 * from a page (its HTML just the `<img>`), uploads.
 */
export function pastedImages(data: TransferLike): File[] {
  const files = Array.from(data?.files ?? [])
  if (files.length === 0) return []
  const html = data?.getData?.('text/html') ?? ''
  return html && htmlHasText(html) ? [] : files
}

/** The files a drop uploads: every file dropped from outside the editor. */
export function droppedFiles(data: TransferLike): File[] {
  return Array.from(data?.files ?? [])
}
