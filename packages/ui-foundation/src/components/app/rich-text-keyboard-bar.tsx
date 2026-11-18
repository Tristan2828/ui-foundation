// The rich-text editor's toolbar on a touch screen (review F11, picked
// 2026-11-18 as 1A and 4A): a short row pinned to the top of the phone's
// keyboard, in place of the rows above the text, which scroll away and
// take a third of what's left of the note while the keyboard is open.
//
// - Shown while the field has focus (or is full screen), on a coarse
//   pointer only (`useCoarsePointer`); a laptop keeps the rows above the
//   text, and the floating bar over selected words.
// - Pinned to the bottom of what is visible (`visualViewport`), so it sits
//   on the keyboard and follows it as it opens, closes and resizes.
// - The row: Aa, then the list buttons used while typing (Task, Bulleted,
//   Outdent, Indent), Insert (opens the slash menu on a new line) and
//   Undo; with words selected, their formats first (Bold to Link), in
//   place of the floating bar, which would land under the system's Copy
//   bar. Hide keyboard last.
// - Aa swaps the keyboard for a panel of every format, by kind and named;
//   the keyboard button in its place brings the keyboard back. Focus stays
//   in the text the whole time (`inputmode="none"` hides the keyboard), so
//   the selection and the caret are kept.
// - Its buttons are 40px (the review's floor), on semantic tokens only.
//
// Placed inside the field's element, not in a portal, like the floating
// toolbar (rich-text-floating-toolbar.tsx says why): `position: fixed`,
// offset by its containing block's own place when an ancestor is
// transformed (a dialog), so it still meets the keyboard.
import { useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type MouseEvent, type RefObject, type Ref } from 'react'
import type { EditorState } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { undo, undoDepth } from '@milkdown/kit/prose/history'
import { TextSelection } from '@milkdown/kit/prose/state'
import { ChevronDownIcon, ImageIcon, KeyboardIcon, Maximize2Icon, Minimize2Icon, PlusIcon, Undo2Icon } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Toggle } from '@/components/ui/toggle'
import { FORMAT_GROUPS } from './rich-text-format-items'
import { formatOn, type FormatId } from './rich-text-formats'
import { FormatButtons } from './rich-text-toolbar'

// The panel's height when no keyboard has been seen yet (a phone's is
// about 260 to 330px).
const PANEL = 280

type Edge = {
  /** The visible area's bottom, in the bar's containing block. */
  bottom: number
  left: number
  width: number
  /** How much of the window the keyboard covers now. */
  keyboard: number
  /** The keyboard's height last seen open, for the panel to take its place (0 before). */
  lastKeyboard: number
}

// The visible area's bottom edge, followed as the keyboard opens, closes
// and the page zooms or scrolls under it.
function useVisibleEdge(probe: RefObject<HTMLSpanElement | null>): Edge | null {
  const [edge, setEdge] = useState<Edge | null>(null)
  useLayoutEffect(() => {
    const viewport = window.visualViewport
    const update = () => {
      // Where `position: fixed` puts 0,0: the window, or a transformed ancestor.
      const origin = probe.current?.getBoundingClientRect() ?? { top: 0, left: 0 }
      const top = viewport?.offsetTop ?? 0
      const height = viewport?.height ?? window.innerHeight
      const next: Omit<Edge, 'lastKeyboard'> = {
        bottom: top + height - origin.top,
        left: (viewport?.offsetLeft ?? 0) - origin.left,
        width: viewport?.width ?? window.innerWidth,
        keyboard: Math.max(0, window.innerHeight - height - top),
      }
      setEdge((last) => {
        const lastKeyboard = next.keyboard > 150 ? next.keyboard : (last?.lastKeyboard ?? 0)
        if (last && last.bottom === next.bottom && last.left === next.left && last.width === next.width && last.keyboard === next.keyboard && last.lastKeyboard === lastKeyboard)
          return last
        return { ...next, lastKeyboard }
      })
    }
    update()
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [probe])
  return edge
}

// The nearest ancestor that scrolls the text, or the page.
function scroller(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node
  }
  return null
}

type VirtualKeyboard = { show: () => void; hide: () => void }
const virtualKeyboard = () => (navigator as Navigator & { virtualKeyboard?: VirtualKeyboard }).virtualKeyboard

// Insert: the slash menu, on the caret's line when it's empty, else on a
// new line after it (made as Enter makes one, so a list item makes the
// next item), as a typed "/" opens it (rich-text-slash.ts).
function insertBlock(view: EditorView) {
  const { $from, empty } = view.state.selection
  if (!(empty && $from.parent.isTextblock && $from.parent.content.size === 0)) {
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, $from.end())))
    const enter = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter' })
    view.someProp('handleKeyDown', (handle) => handle(view, enter))
  }
  const at = view.state.selection.from
  const typed = view.someProp('handleTextInput', (handle) => handle(view, at, at, '/', () => view.state.tr.insertText('/', at, at)))
  if (!typed) view.dispatch(view.state.tr.insertText('/', at, at))
  view.focus()
}

// The panel's blocks: every format that isn't about selected words, named.
const WORDS: FormatId[] = ['bold', 'italic', 'strike', 'code', 'highlight', 'link']
const BLOCKS = FORMAT_GROUPS.flat().filter((item) => !WORDS.includes(item.id))
// A block's tile in the panel: its icon over its name, two lines at most.
const TILE = 'h-16 w-full flex-col gap-1 rounded-lg bg-muted px-1 text-center text-xs leading-tight font-medium whitespace-normal text-foreground [&_svg]:size-5'

export interface RichTextKeyboardBarProps {
  view: EditorView
  state: EditorState | null
  readOnly: boolean
  /** The editable element's id, for `aria-controls`. */
  controls: string
  onFormat: (id: FormatId) => void
  /** The Image button pressed (only when the editor uploads images). */
  onImage?: () => void
  onFullScreen?: () => void
  fullScreen?: boolean
  text: () => HTMLElement | null
  /** Focus leaving one of its buttons, for the editor to tell whether it left the field. */
  onBlur: (event: FocusEvent) => void
  /** A press in the text still down (the tap that focused it): the row waits for it to end. */
  pressing?: boolean
  /** Its element, for Alt+F10 to reach it from the text. */
  ref?: Ref<HTMLDivElement>
}

export function RichTextKeyboardBar({ view, state, readOnly, controls, onFormat, onImage, onFullScreen, fullScreen = false, text, onBlur, pressing = false, ref }: RichTextKeyboardBarProps) {
  const probe = useRef<HTMLSpanElement>(null)
  const row = useRef<HTMLDivElement>(null)
  const edge = useVisibleEdge(probe)
  // Shown once the tap that focused the text is over: shown at once, the
  // row would be under a finger pressing the screen's bottom line (a link
  // there), and the release would land on the row.
  const [ready, setReady] = useState(!pressing)
  useEffect(() => {
    if (ready || pressing) return
    // After the press's click, which follows its release.
    const settle = setTimeout(() => setReady(true))
    return () => clearTimeout(settle)
  }, [ready, pressing])
  const [panel, setPanel] = useState(false)
  const panelHeight = edge?.lastKeyboard || PANEL

  // The panel hides the keyboard, focus kept in the text; the keyboard
  // comes back as it closes (or the bar goes).
  useEffect(() => {
    if (!panel) return
    const dom = view.dom as HTMLElement
    dom.setAttribute('inputmode', 'none')
    virtualKeyboard()?.hide()
    return () => {
      dom.removeAttribute('inputmode')
    }
  }, [panel, view])

  // The caret stays in sight above the bar (and the panel): the browser
  // keeps it above the keyboard only.
  const selectionHead = state?.selection.head
  useLayoutEffect(() => {
    if (!edge || !ready || selectionHead === undefined || !row.current) return
    let caret: { bottom: number }
    try {
      caret = view.coordsAtPos(selectionHead)
    } catch {
      return
    }
    const limit = row.current.getBoundingClientRect().top - 8
    const over = caret.bottom - limit
    if (over <= 0) return
    const scrolling = scroller(view.dom as HTMLElement)
    if (scrolling) scrolling.scrollTop += over
    else window.scrollBy(0, over)
  }, [view, selectionHead, edge, panel, ready])

  const selection = state?.selection
  const words = Boolean(selection && !selection.empty && !selection.$from.parent.type.spec.code)
  const inCode = Boolean(selection?.$from.parent.type.spec.code)
  const canUndo = state ? undoDepth(state) > 0 : false
  // A press never takes focus from the text, so the selection stays.
  const keep = (event: MouseEvent) => event.preventDefault()
  const press = (run: () => void) => () => {
    run()
    view.focus()
  }

  const shown = edge !== null && ready
  const bottom = edge ? edge.bottom - (panel ? panelHeight : 0) : 0

  return (
    <div
      ref={ref}
      data-slot="rich-text-keyboard-bar"
      // Part of the field for the editor's blur (its menus are).
      data-rich-text-menu=""
      onBlur={onBlur}
    >
      <span ref={probe} aria-hidden="true" className="pointer-events-none fixed top-0 left-0 size-0" />
      <div
        ref={row}
        role="toolbar"
        aria-label="Formatting"
        aria-controls={controls}
        style={edge ? { top: bottom, left: edge.left, width: edge.width } : undefined}
        className={cn(
          'fixed z-50 flex h-12 -translate-y-full items-center gap-0.5 border-t border-border bg-card px-1 text-card-foreground',
          !shown && 'invisible',
        )}
      >
        <Toggle
          aria-label={panel ? 'Keyboard' : 'All Formats'}
          pressed={panel}
          disabled={readOnly}
          className="size-10 min-w-10 font-serif text-base aria-pressed:bg-muted aria-pressed:text-foreground [&_svg]:size-5"
          onMouseDown={keep}
          onPressedChange={(open) => {
            setPanel(open)
            if (!open) virtualKeyboard()?.show()
            view.focus()
          }}
        >
          {panel ? <KeyboardIcon aria-hidden="true" /> : 'Aa'}
        </Toggle>
        <Separator orientation="vertical" className="mx-1 h-6 data-vertical:self-center" />
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]">
          <FormatButtons formats={words ? 'keyboardWords' : 'keyboard'} state={state} readOnly={readOnly} onFormat={onFormat} text={text} touch />
          {!words && (
            <>
              <Button
                variant="ghost"
                size="icon-lg"
                aria-label="Insert Block"
                disabled={readOnly || inCode}
                className="[&_svg]:size-5"
                onMouseDown={keep}
                onClick={() => insertBlock(view)}
              >
                <PlusIcon aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon-lg"
                aria-label="Undo"
                disabled={readOnly || !canUndo}
                className="[&_svg]:size-5"
                onMouseDown={keep}
                onClick={press(() => undo(view.state, view.dispatch))}
              >
                <Undo2Icon aria-hidden="true" />
              </Button>
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Hide Keyboard"
          className="[&_svg]:size-5"
          onMouseDown={keep}
          onClick={() => {
            setPanel(false)
            ;(view.dom as HTMLElement).blur()
          }}
        >
          <ChevronDownIcon aria-hidden="true" />
        </Button>
      </div>
      {panel && edge && (
        <div
          role="group"
          aria-label="All Formats"
          data-slot="rich-text-keyboard-panel"
          style={{ top: edge.bottom - panelHeight, left: edge.left, width: edge.width, height: panelHeight }}
          className="fixed z-50 flex flex-col gap-3 overflow-y-auto bg-card px-3 py-3 text-card-foreground"
          onMouseDown={keep}
        >
          <p className="type-caption text-muted-foreground">Words</p>
          <div role="toolbar" aria-label="Format Words" className="flex flex-wrap items-center gap-1">
            <FormatButtons formats="selection" state={state} readOnly={readOnly} onFormat={onFormat} text={text} touch />
          </div>
          <p className="type-caption text-muted-foreground">Blocks</p>
          <div className="grid grid-cols-4 gap-1.5">
            {BLOCKS.map((item) => {
              const Icon = item.icon
              const disabled = readOnly || (item.id === 'table' && state !== null && formatOn(state, 'table'))
              const look = TILE
              if (item.action)
                return (
                  <Button key={item.id} variant="ghost" disabled={disabled} className={cn(look, 'hover:bg-muted')} onMouseDown={keep} onClick={press(() => onFormat(item.id))}>
                    <Icon aria-hidden="true" />
                    {item.label}
                  </Button>
                )
              return (
                <Toggle
                  key={item.id}
                  pressed={state ? formatOn(state, item.id) : false}
                  disabled={disabled}
                  className={cn(look, 'aria-pressed:bg-primary/15 aria-pressed:text-foreground aria-pressed:ring-1 aria-pressed:ring-primary')}
                  onMouseDown={keep}
                  onPressedChange={() => onFormat(item.id)}
                >
                  <Icon aria-hidden="true" />
                  {item.label}
                </Toggle>
              )
            })}
            {onImage && (
              <Button variant="ghost" disabled={readOnly} className={cn(TILE, 'hover:bg-muted')} onMouseDown={keep} onClick={onImage}>
                <ImageIcon aria-hidden="true" />
                Image
              </Button>
            )}
            {onFullScreen && (
              <Toggle
                pressed={fullScreen}
                className={cn(TILE, 'aria-pressed:bg-primary/15 aria-pressed:text-foreground aria-pressed:ring-1 aria-pressed:ring-primary')}
                onMouseDown={keep}
                onPressedChange={() => {
                  setPanel(false)
                  onFullScreen()
                }}
              >
                {fullScreen ? <Minimize2Icon aria-hidden="true" /> : <Maximize2Icon aria-hidden="true" />}
                {fullScreen ? 'Leave Full Screen' : 'Full Screen'}
              </Toggle>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
