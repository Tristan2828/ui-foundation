// The rich-text editor's typing (the RichTextEditor review's typing
// findings), in node on a schema with the editor's node names: the typed
// marks' patterns, the block keys between a heading and a list
//, Backspace at an item's start, Tab in lists and code, and
// the slash menu's picks where it's open. The browser half is
// e2e/rich-text-editor.spec.ts "typing".
import { Schema, type Node as ProseNode } from '@milkdown/kit/prose/model'
import { history } from '@milkdown/kit/prose/history'
import { EditorState, TextSelection, type Transaction } from '@milkdown/kit/prose/state'
import { describe, expect, it } from 'vitest'
import { toggleFormat } from '../src/components/app/rich-text-formats'
import { DIVIDER, EMPHASIS_STAR, HIGHLIGHT, STRONG } from '../src/components/app/rich-text-input-rules'
import { handleEditingKey } from '../src/components/app/rich-text-shortcuts'
import { slashItems } from '../src/components/app/rich-text-slash'

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    heading: { group: 'block', content: 'inline*', attrs: { level: { default: 1 }, toggle: { default: false } } },
    code_block: { group: 'block', content: 'text*', marks: '', code: true },
    blockquote: { group: 'block', content: 'block+' },
    hr: { group: 'block' },
    bullet_list: { group: 'block', content: 'list_item+' },
    ordered_list: { group: 'block', content: 'list_item+' },
    list_item: { content: 'paragraph block*', attrs: { checked: { default: null }, listType: { default: 'bullet' } } },
    table: { group: 'block', content: 'table_row+' },
    table_header_row: { content: 'table_header+' },
    table_row: { content: 'table_cell+' },
    table_header: { content: 'paragraph', attrs: { alignment: { default: null } } },
    callout: { group: 'block', content: 'block+', attrs: { kind: { default: 'note' } } },
    table_cell: { content: 'paragraph', attrs: { alignment: { default: null } } },
    text: { group: 'inline' },
  },
  marks: { strong: {}, emphasis: {}, highlight: { attrs: { color: { default: 'amber' } } } },
})

const p = (text: string) => schema.node('paragraph', null, text ? [schema.text(text)] : [])
const item = (text: string, ...more: ProseNode[]) => schema.node('list_item', null, [p(text), ...more])
const bullets = (...items: ProseNode[]) => schema.node('bullet_list', null, items)

// A state on `blocks`, the caret `offset` into the first text that is `text`.
function at(blocks: ProseNode[], text: string, offset = 0) {
  const doc = schema.node('doc', null, blocks)
  let pos = -1
  doc.descendants((node, nodePos) => {
    if (pos < 0 && node.isText && node.text === text) pos = nodePos + offset
  })
  if (pos < 0) throw new Error(`no ${text}`)
  return EditorState.create({ doc, selection: TextSelection.create(doc, pos) })
}

// The document as its block types and text, nested lists as children.
function shape(node: ProseNode): unknown {
  if (node.isTextblock) return `${node.type.name}:${node.textContent}`
  return { [node.type.name]: node.children.map(shape) }
}

function run(state: EditorState, command: (state: EditorState, dispatch: (tr: Transaction) => void) => boolean) {
  let next = state
  const ran = command(state, (tr) => (next = state.apply(tr)))
  return { ran, state: next }
}

const key = (key: string, more: Partial<KeyboardEvent> = {}) => ({ key, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, isComposing: false, ...more }) as KeyboardEvent

describe('typed marks (F16, F22)', () => {
  it('a star needs words against it on both sides', () => {
    expect(EMPHASIS_STAR.test('Cost is 5 * 3 *')).toBe(false)
    expect(EMPHASIS_STAR.test('Cost is 5 *3 *')).toBe(false)
    expect(EMPHASIS_STAR.exec('an *idea*')?.[1]).toBe('idea')
    expect(EMPHASIS_STAR.exec('*two words*')?.[1]).toBe('two words')
    // Negative control: half of `**` never opens emphasis.
    expect(EMPHASIS_STAR.test('**bold*')).toBe(false)
  })

  it('two stars too', () => {
    expect(STRONG.test('2 ** 3 **')).toBe(false)
    expect(STRONG.exec('very **bold**')?.[1]).toBe('bold')
    expect(STRONG.test('a**b**')).toBe(false)
  })

  it('==words== and =={colour}words==, never with a space against the marks', () => {
    expect(HIGHLIGHT.exec('see ==this==')?.slice(1)).toEqual([undefined, 'this'])
    expect(HIGHLIGHT.exec('=={green}green==')?.slice(1)).toEqual(['green', 'green'])
    expect(HIGHLIGHT.test('a == b ==')).toBe(false)
    expect(HIGHLIGHT.test('x === y==')).toBe(false)
  })

  it('a divider is three marks alone on a line', () => {
    expect(DIVIDER.test('---')).toBe(true)
    expect(DIVIDER.test('*** ')).toBe(true)
    expect(DIVIDER.test('a---')).toBe(false)
  })
})

describe('the block keys between a heading and a list (F24)', () => {
  it('a heading becomes a bulleted item, in the list right under it (two lists side by side are one in Markdown)', () => {
    const heading = schema.node('heading', { level: 1 }, [schema.text('Title')])
    const { ran, state } = run(at([heading, bullets(item('item'))], 'Title'), (s, d) => toggleFormat(s, d, 'bullets'))
    expect(ran).toBe(true)
    expect(state.doc.children.map(shape)).toEqual([{ bullet_list: [{ list_item: ['paragraph:Title'] }, { list_item: ['paragraph:item'] }] }])
    // Negative control: a numbered list there is another list.
    const numbered = schema.node('ordered_list', null, [item('item')])
    const apart = run(at([heading, numbered], 'Title'), (s, d) => toggleFormat(s, d, 'bullets')).state
    expect(apart.doc.childCount).toBe(2)
  })

  it('a list item becomes a heading, out of its list', () => {
    const { ran, state } = run(at([bullets(item('one'), item('two'))], 'two'), (s, d) => toggleFormat(s, d, 'heading1'))
    expect(ran).toBe(true)
    expect(state.doc.children.map(shape)).toEqual([{ bullet_list: [{ list_item: ['paragraph:one'] }] }, 'heading:two'])
  })

  it('a nested item becomes a code block, out of both lists', () => {
    const { state } = run(at([bullets(item('one', bullets(item('two'))))], 'two'), (s, d) => toggleFormat(s, d, 'codeBlock'))
    expect(state.doc.children.map(shape)).toEqual([{ bullet_list: [{ list_item: ['paragraph:one'] }] }, 'code_block:two'])
  })
})

describe('Backspace and Tab (F17, the review’s Tab row)', () => {
  it("Backspace at an item's start lifts it out; mid-line it is the editor's", () => {
    const start = at([bullets(item('one'), item('two'))], 'two')
    const { ran, state } = run(start, (s, d) => handleEditingKey(s, d, key('Backspace')))
    expect(ran).toBe(true)
    expect(state.doc.children.map(shape)).toEqual([{ bullet_list: [{ list_item: ['paragraph:one'] }] }, 'paragraph:two'])
    // Negative controls: not at the start, and not in a list.
    expect(run(at([bullets(item('one'), item('two'))], 'two', 1), (s, d) => handleEditingKey(s, d, key('Backspace'))).ran).toBe(false)
    expect(run(at([p('one'), p('two')], 'two'), (s, d) => handleEditingKey(s, d, key('Backspace'))).ran).toBe(false)
  })

  it('Tab in a first item is taken and changes nothing; on a plain line it is the browser’s', () => {
    const start = at([bullets(item('one'), item('two'))], 'one')
    const { ran, state } = run(start, (s, d) => handleEditingKey(s, d, key('Tab')))
    expect(ran).toBe(true)
    expect(state.doc.eq(start.doc)).toBe(true)
    expect(run(at([p('plain')], 'plain'), (s, d) => handleEditingKey(s, d, key('Tab'))).ran).toBe(false)
  })

  it('Tab and Shift+Tab indent and outdent the lines of a code block', () => {
    const code = schema.node('code_block', null, [schema.text('a\nb')])
    const doc = schema.node('doc', null, [code])
    const all = EditorState.create({ doc, selection: TextSelection.create(doc, 1, 4) })
    const indented = run(all, (s, d) => handleEditingKey(s, d, key('Tab'))).state
    expect(indented.doc.textContent).toBe('  a\n  b')
    const back = run(indented, (s, d) => handleEditingKey(s, d, key('Tab', { shiftKey: true }))).state
    expect(back.doc.textContent).toBe('a\nb')
  })
})

describe('the slash menu where it is open (F18)', () => {
  const ids = (state: EditorState, from: number) => slashItems('', { at: { state, span: { from, to: from + 1, query: '' } } }).map((one) => one.id)

  it('in a list item every block that can be made there', () => {
    const doc = schema.node('doc', null, [bullets(item('one'), item('/'))])
    let from = 0
    doc.descendants((node, pos) => {
      if (node.isText && node.text === '/') from = pos
    })
    const state = EditorState.create({ doc, selection: TextSelection.create(doc, from + 1) })
    expect(ids(state, from)).toEqual(expect.arrayContaining(['heading1', 'tasks', 'codeBlock', 'quote']))
  })

  it('in a table cell only the highlights, which can go there', () => {
    const cell = (text: string) => schema.node('table_cell', null, [p(text)])
    const doc = schema.node('doc', null, [schema.node('table', null, [schema.node('table_row', null, [cell('/'), cell('b')])])])
    const from = 3
    const state = EditorState.create({ doc, selection: TextSelection.create(doc, from + 1) })
    const here = ids(state, from)
    expect(here).not.toContain('heading1')
    expect(here).not.toContain('table')
    expect(here).toContain('highlight-green')
    // Negative control: with no place given, the whole list.
    expect(slashItems('').map((one) => one.id)).toContain('heading1')
  })
})

describe('undo and redo (F21)', () => {
  it('a redo pressed once too often does nothing, and never undoes', () => {
    const doc = schema.node('doc', null, [p('one')])
    let state = EditorState.create({ doc, plugins: [history()] })
    state = state.apply(state.tr.insertText(' two', 4))
    const typed = state.doc
    const press = (event: KeyboardEvent) => (state = run(state, (s, d) => handleEditingKey(s, d, event)).state)
    press(key('z', { code: 'KeyZ', ctrlKey: true }))
    expect(state.doc.textContent).toBe('one')
    press(key('Z', { code: 'KeyZ', ctrlKey: true, shiftKey: true }))
    expect(state.doc.eq(typed)).toBe(true)
    // Nothing left to redo: the key is still taken, and the text stays.
    expect(run(state, (s, d) => handleEditingKey(s, d, key('Z', { code: 'KeyZ', ctrlKey: true, shiftKey: true }))).ran).toBe(true)
    press(key('Z', { code: 'KeyZ', ctrlKey: true, shiftKey: true }))
    expect(state.doc.eq(typed)).toBe(true)
  })
})
