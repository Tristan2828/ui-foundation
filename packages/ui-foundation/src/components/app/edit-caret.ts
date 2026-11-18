// Where the caret is in a block of text, kept across the control starting
// over (editable-value.tsx): a value saved elsewhere reloading under the
// caret (F4), and a click-to-open note opening where it was clicked (F8),
// the read view's text becoming the editor's.
//
// A spot is the innermost block holding the caret (a paragraph, a list
// item's text, a heading, a cell), told apart by its text and which of
// the blocks with that text it is, and the caret's offset in its text.
// Matching by text, not position, survives the read view and the editor
// nesting blocks differently (a tight list's item is a paragraph in the
// editor); the block's place among all blocks is the fallback when its
// text changed (the reload changed that block).

const BLOCKS = 'p, li, h1, h2, h3, h4, h5, h6, pre, blockquote, td, th, dt, dd, summary'

export type CaretSpot = {
  /** The block's text. */
  text: string
  /** Which of the blocks with that text it is (0 for the first). */
  nth: number
  /** Its place among all the blocks: the fallback when no block has its text. */
  index: number
  /** The caret's offset in the block's text. */
  offset: number
}

// The blocks that hold no other block: the ones text is typed into.
function leafBlocks(root: Element): Element[] {
  return [...root.querySelectorAll(BLOCKS)].filter((block) => !block.querySelector(BLOCKS))
}

function spotIn(root: Element, node: Node, offset: number): CaretSpot | null {
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
  const blocks = leafBlocks(root)
  const block = blocks.find((candidate) => candidate.contains(element))
  if (!block) return null
  const text = block.textContent ?? ''
  const range = document.createRange()
  range.setStart(block, 0)
  range.setEnd(node, offset)
  return {
    text,
    nth: blocks.filter((candidate) => (candidate.textContent ?? '') === text).indexOf(block),
    index: blocks.indexOf(block),
    offset: range.toString().length,
  }
}

/** The caret's spot in `root`, or null when it isn't in a block there. */
export function caretSpot(root: Element): CaretSpot | null {
  const selection = document.getSelection()
  if (!selection?.anchorNode || !root.contains(selection.anchorNode)) return null
  return spotIn(root, selection.anchorNode, selection.anchorOffset)
}

/** The spot a click at (x, y) points at in `root` (the read view). */
export function spotAtPoint(root: Element, x: number, y: number): CaretSpot | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  const position = doc.caretPositionFromPoint?.(x, y)
  if (position) return root.contains(position.offsetNode) ? spotIn(root, position.offsetNode, position.offset) : null
  const range = doc.caretRangeFromPoint?.(x, y)
  if (range) return root.contains(range.startContainer) ? spotIn(root, range.startContainer, range.startOffset) : null
  return null
}

/**
 * Puts the caret at `spot` in an editable `root` and brings its block into
 * view if it isn't (no jump when it is). False when `root` has no blocks yet.
 */
export function placeCaret(root: HTMLElement, spot: CaretSpot): boolean {
  const blocks = leafBlocks(root)
  if (blocks.length === 0) return false
  const same = blocks.filter((block) => (block.textContent ?? '') === spot.text)
  const block = same[Math.min(spot.nth, same.length - 1)] ?? blocks[Math.min(spot.index, blocks.length - 1)]
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
  let left = Math.min(spot.offset, (block.textContent ?? '').length)
  let node: Node | null = walker.nextNode()
  let target: { node: Node; offset: number } = { node: block, offset: 0 }
  while (node) {
    const length = node.textContent?.length ?? 0
    if (left <= length) {
      target = { node, offset: left }
      break
    }
    left -= length
    const next = walker.nextNode()
    if (!next) target = { node, offset: length }
    node = next
  }
  if (document.activeElement !== root) root.focus({ preventScroll: true })
  document.getSelection()?.collapse(target.node, target.offset)
  const box = block.getBoundingClientRect()
  if (box.bottom < 0 || box.top > window.innerHeight) block.scrollIntoView({ block: 'center' })
  return true
}

/**
 * Puts the caret at `spot` once the editor in `container` has drawn its
 * text (a rich-text editor builds itself a moment after it mounts), then
 * once more in the frame after, past the editor's own first focus.
 */
export function placeCaretWhenReady(container: () => Element | null, spot: CaretSpot, frames = 60): () => void {
  let left = frames
  let placed = false
  let handle = 0
  const step = () => {
    const editable = container()?.querySelector<HTMLElement>('[contenteditable="true"]')
    if (editable && placeCaret(editable, spot)) {
      if (placed) return
      placed = true
    }
    if (--left > 0) handle = requestAnimationFrame(step)
  }
  handle = requestAnimationFrame(step)
  return () => cancelAnimationFrame(handle)
}
