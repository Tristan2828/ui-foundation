// The rich-text editor's image upload (rich-text-image-upload.ts): which
// pastes and drops upload, the placeholder while a file uploads, the image
// that replaces it, and a failure taking it away with its reason. In node,
// on a schema with the editor's node names, through a stand-in view.
import { Schema } from '@milkdown/kit/prose/model'
import { EditorState, TextSelection, type Transaction } from '@milkdown/kit/prose/state'
import { describe, expect, it } from 'vitest'
import { droppedFiles, imageUploadPlugin, pastedImages, uploadImages, uploadPlaceholders } from '../src/components/app/rich-text-image-upload'
import type { ImageUploadResult } from '../src/lib/image-file'

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    code_block: { group: 'block', content: 'text*', marks: '', code: true },
    text: { group: 'inline' },
    image: { group: 'inline', inline: true, atom: true, attrs: { src: { default: '' }, alt: { default: '' }, title: { default: '' } } },
  },
})

function paragraph(text: string) {
  return schema.node('paragraph', null, text ? [schema.text(text)] : [])
}

// A view's state and dispatch, nothing else: what uploadImages needs.
function view(...texts: string[]) {
  const target = {
    state: EditorState.create({ doc: schema.node('doc', null, texts.map(paragraph)), plugins: [imageUploadPlugin()] }),
    dispatch(tr: Transaction) {
      target.state = target.state.apply(tr)
    },
    isDestroyed: false,
  }
  return target
}

function caret(target: ReturnType<typeof view>, pos: number) {
  target.dispatch(target.state.tr.setSelection(TextSelection.create(target.state.doc, pos)))
}

// A promise to settle from the test.
function deferred() {
  let resolve!: (value: ImageUploadResult) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<ImageUploadResult>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const settled = () => new Promise((resolve) => setTimeout(resolve, 0))

function file(name: string, type = 'image/png', size = 1000) {
  return new File([new Uint8Array(size)], name, { type })
}

// The images in the document, in order, as their src.
function images(target: ReturnType<typeof view>) {
  const found: string[] = []
  target.state.doc.descendants((node) => {
    if (node.type.name === 'image') found.push(String(node.attrs.src))
  })
  return found
}

describe('uploadImages', () => {
  it('shows a placeholder at the caret, leaves the document alone, then puts the image there', async () => {
    const target = view('Before after')
    caret(target, 7) // after "Before"
    const upload = deferred()
    const before = target.state.doc
    expect(uploadImages(target, [file('photo.png')], null, { upload: () => upload.promise, onError: () => {} })).toBe(true)

    expect(uploadPlaceholders(target.state)).toEqual([{ id: expect.any(Number), name: 'photo.png', pos: 7 }])
    // Nothing for the placeholder in the document: an autosave now saves the text as it was.
    expect(target.state.doc.eq(before)).toBe(true)

    upload.resolve({ id: 'f1', thumbUrl: '/thumb/f1', url: '/files/f1' })
    await settled()
    expect(uploadPlaceholders(target.state)).toEqual([])
    expect(images(target)).toEqual(['/files/f1'])
    expect(target.state.doc.firstChild!.child(0).text).toBe('Before')
    expect(target.state.doc.firstChild!.child(1).type.name).toBe('image')
  })

  it('inserts the thumbnail when the result has no full-size url', async () => {
    const target = view('Text')
    caret(target, 5)
    uploadImages(target, [file('a.png')], null, { upload: async () => ({ id: 'f2', thumbUrl: '/thumb/f2' }), onError: () => {} })
    await settled()
    expect(images(target)).toEqual(['/thumb/f2'])
  })

  it('a failed upload takes the placeholder away, adds nothing, and says why', async () => {
    const target = view('Text')
    caret(target, 5)
    const errors: string[] = []
    const upload = deferred()
    const before = target.state.doc
    uploadImages(target, [file('a.png')], null, { upload: () => upload.promise, onError: (message) => errors.push(message) })
    upload.reject({ kind: 'server', message: 'Storage is full.' })
    await settled()
    expect(uploadPlaceholders(target.state)).toEqual([])
    expect(target.state.doc.eq(before)).toBe(true)
    expect(errors).toEqual(['Storage is full.'])
  })

  it('a rejection with no message gets a sentence of its own', async () => {
    const target = view('Text')
    const errors: string[] = []
    uploadImages(target, [file('a.png')], null, { upload: () => Promise.reject(new Error('')), onError: (message) => errors.push(message) })
    await settled()
    expect(errors).toEqual(["The image couldn't be uploaded. Try again."])
  })

  it('an upload that throws before returning a promise is a failure, not a crash', async () => {
    const target = view('Text')
    const errors: string[] = []
    uploadImages(target, [file('a.png')], null, {
      upload: () => {
        throw new Error('No storage configured.')
      },
      onError: (message) => errors.push(message),
    })
    await settled()
    expect(errors).toEqual(['No storage configured.'])
    expect(uploadPlaceholders(target.state)).toEqual([])
  })

  it('the placeholder moves with text typed before it, and the image lands where it moved to', async () => {
    const target = view('Hello')
    caret(target, 6) // the end
    const upload = deferred()
    uploadImages(target, [file('a.png')], null, { upload: () => upload.promise, onError: () => {} })
    target.dispatch(target.state.tr.insertText('Oh, ', 1))
    expect(uploadPlaceholders(target.state)[0].pos).toBe(10)
    upload.resolve({ id: 'f', thumbUrl: '/t' })
    await settled()
    expect(target.state.doc.firstChild!.child(0).text).toBe('Oh, Hello')
    expect(target.state.doc.firstChild!.lastChild!.type.name).toBe('image')
  })

  it('what is typed at the caret meanwhile goes after the image, as if it were already there', async () => {
    const target = view('Hello')
    caret(target, 6)
    const upload = deferred()
    uploadImages(target, [file('a.png')], null, { upload: () => upload.promise, onError: () => {} })
    target.dispatch(target.state.tr.insertText(' world'))
    expect(uploadPlaceholders(target.state)[0].pos).toBe(6)
    upload.resolve({ id: 'f', thumbUrl: '/t' })
    await settled()
    const line = target.state.doc.firstChild!
    expect([line.child(0).text, line.child(1).type.name, line.child(2).text]).toEqual(['Hello', 'image', ' world'])
  })

  it('drops the image when the text around its placeholder was deleted', async () => {
    const target = view('First', 'Second')
    caret(target, 3) // inside "First"
    const upload = deferred()
    uploadImages(target, [file('a.png')], null, { upload: () => upload.promise, onError: () => {} })
    target.dispatch(target.state.tr.delete(0, target.state.doc.firstChild!.nodeSize))
    expect(uploadPlaceholders(target.state)).toEqual([])
    upload.resolve({ id: 'f', thumbUrl: '/t' })
    await settled()
    expect(images(target)).toEqual([])
  })

  it('ignores a result that arrives after the editor is gone', async () => {
    const target = view('Text')
    const upload = deferred()
    uploadImages(target, [file('a.png')], null, { upload: () => upload.promise, onError: () => {} })
    target.isDestroyed = true
    upload.resolve({ id: 'f', thumbUrl: '/t' })
    await settled()
    expect(images(target)).toEqual([])
  })

  it('a paste over selected words replaces them', async () => {
    const target = view('Keep this word')
    target.dispatch(target.state.tr.setSelection(TextSelection.create(target.state.doc, 11, 15))) // "word"
    uploadImages(target, [file('a.png')], null, { upload: async () => ({ id: 'f', thumbUrl: '/t' }), onError: () => {} })
    await settled()
    expect(target.state.doc.firstChild!.textContent).toBe('Keep this ')
    expect(images(target)).toEqual(['/t'])
  })

  it('a drop puts the image where it was dropped, not at the caret', async () => {
    const target = view('One', 'Two')
    caret(target, 1)
    uploadImages(target, [file('a.png')], 9, { upload: async () => ({ id: 'f', thumbUrl: '/t' }), onError: () => {} }) // end of "Two"
    await settled()
    expect(target.state.doc.child(1).lastChild!.type.name).toBe('image')
    expect(target.state.doc.child(0).childCount).toBe(1)
  })

  it('a drop between two blocks puts the image in a paragraph of its own there', async () => {
    const target = view('One', 'Two')
    uploadImages(target, [file('a.png')], 5, { upload: async () => ({ id: 'f', thumbUrl: '/t' }), onError: () => {} }) // between the paragraphs
    await settled()
    expect(images(target)).toEqual(['/t'])
    expect(target.state.doc.child(0).textContent).toBe('One')
    target.state.doc.forEach((block) => expect(block.type.name).toBe('paragraph'))
  })

  it('several files go in in the order they came, whichever upload finishes first', async () => {
    const target = view('Text')
    caret(target, 5)
    const first = deferred()
    const second = deferred()
    const pending = [first, second]
    uploadImages(target, [file('1.png'), file('2.png')], null, { upload: () => pending.shift()!.promise, onError: () => {} })
    expect(uploadPlaceholders(target.state).map((placeholder) => placeholder.name)).toEqual(['1.png', '2.png'])
    second.resolve({ id: '2', thumbUrl: '/2' })
    await settled()
    // The second waits for the first.
    expect(images(target)).toEqual([])
    first.resolve({ id: '1', thumbUrl: '/1' })
    await settled()
    expect(images(target)).toEqual(['/1', '/2'])
    expect(uploadPlaceholders(target.state)).toEqual([])
  })

  it('one failure among several leaves the rest to land', async () => {
    const target = view('Text')
    caret(target, 5)
    const errors: string[] = []
    const results = [Promise.reject(new Error('Too big for storage.')), Promise.resolve({ id: '2', thumbUrl: '/2' })]
    uploadImages(target, [file('1.png'), file('2.png')], null, { upload: () => results.shift()!, onError: (message) => errors.push(message) })
    await settled()
    expect(images(target)).toEqual(['/2'])
    expect(errors).toEqual(['Too big for storage.'])
  })

  it('refuses a file of a type not accepted, or over the size limit, before it uploads', () => {
    const target = view('Text')
    const errors: string[] = []
    let calls = 0
    const started = uploadImages(target, [file('a.gif', 'image/gif'), file('b.png', 'image/png', 3 * 1024 * 1024)], null, {
      upload: async () => {
        calls++
        return { id: 'x', thumbUrl: '/x' }
      },
      onError: (message) => errors.push(message),
      maxSize: 2 * 1024 * 1024,
    })
    expect(started).toBe(false)
    expect(calls).toBe(0)
    expect(uploadPlaceholders(target.state)).toEqual([])
    expect(errors).toEqual(['That file is a GIF. Choose a JPEG, PNG or WebP image.', 'That image is 3 MB. The limit is 2 MB.'])
  })

  it('uploads the accepted files of a mixed drop and refuses the rest', async () => {
    const target = view('Text')
    const errors: string[] = []
    uploadImages(target, [file('notes.pdf', 'application/pdf'), file('b.png')], 5, {
      upload: async () => ({ id: 'b', thumbUrl: '/b' }),
      onError: (message) => errors.push(message),
    })
    await settled()
    expect(images(target)).toEqual(['/b'])
    expect(errors).toEqual(['That file is a PDF. Choose a JPEG, PNG or WebP image.'])
  })

  it('takes the types a field accepts', async () => {
    const target = view('Text')
    const errors: string[] = []
    uploadImages(target, [file('a.gif', 'image/gif')], null, {
      upload: async () => ({ id: 'g', thumbUrl: '/g' }),
      onError: (message) => errors.push(message),
      accept: ['image/*'],
    })
    await settled()
    expect(errors).toEqual([])
    expect(images(target)).toEqual(['/g'])
  })
})

describe('pastedImages and droppedFiles', () => {
  const transfer = (files: File[], data: Record<string, string> = {}) => ({ files, getData: (type: string) => data[type] ?? '' })

  it('a paste of files alone (a screenshot) uploads them', () => {
    const shot = file('image.png')
    expect(pastedImages(transfer([shot]))).toEqual([shot])
  })

  it("an image copied from a page (its HTML only the <img>) uploads the image's file", () => {
    const copied = file('image.png')
    expect(pastedImages(transfer([copied], { 'text/html': '<meta charset="utf-8"><img src="https://example.com/a.png" alt="">' }))).toEqual([copied])
  })

  it("an office app's copy (HTML with words, and a picture of them) is the words, not an upload", () => {
    const html = '<html><head><style>p { margin: 0 }</style></head><body><!--StartFragment--><p>Quarterly&nbsp;numbers</p></body></html>'
    expect(pastedImages(transfer([file('image.png')], { 'text/html': html }))).toEqual([])
  })

  it('a paste with no files is never an upload', () => {
    expect(pastedImages(transfer([], { 'text/plain': 'words' }))).toEqual([])
    expect(pastedImages(null)).toEqual([])
  })

  it('a drop uploads every file dropped; a drop of text has none', () => {
    const a = file('a.png')
    const b = file('b.pdf', 'application/pdf')
    expect(droppedFiles(transfer([a, b]))).toEqual([a, b])
    expect(droppedFiles(transfer([], { 'text/plain': 'moved words' }))).toEqual([])
  })
})
