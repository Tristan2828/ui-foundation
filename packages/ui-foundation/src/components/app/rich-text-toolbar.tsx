// The rich-text editor's fixed toolbar: one row of pressed/not-pressed
// buttons above the text, each a format and its keyboard shortcut, a
// Table menu (rich-text-table-menu.tsx), and, when the editor uploads
// images, an Image button (a plain button: it opens the file picker).
//
// - One tab stop (ARIA's toolbar pattern): Tab reaches the last button
//   used, the arrow keys, Home and End move along the row.
// - A press acts on the editor's selection and gives focus back to the
//   text; a mouse press never takes focus from it, so the selection stays.
// - Each button says whether its format is on where the caret is
//   (`aria-pressed`), and names its shortcut (`aria-keyshortcuts`, and the
//   tooltip).
// - Read-only (while a save is in flight), every button is disabled.
// - Alt+F10 in the text reaches it (the floating toolbar first, when it's
//   showing: rich-text-floating-toolbar.tsx).
import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type Ref } from 'react'
import type { EditorState } from '@milkdown/kit/prose/state'
import { ImageIcon, Maximize2Icon, Minimize2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Toggle } from '@/components/ui/toggle'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { FORMAT_GROUPS, FORMAT_ITEMS, type FormatItem } from './rich-text-format-items'
import { formatOn, type FormatId } from './rich-text-formats'
import { ariaKeys, isApple, shownKeys } from './rich-text-shortcuts'
import type { TableAction } from './rich-text-table'
import { RichTextHighlightMenu } from './rich-text-highlight-menu'
import { RichTextTableMenu } from './rich-text-table-menu'

// Which buttons a toolbar has: every format (the fixed one), or the ones
// that apply to selected words (the floating one).
const SELECTION: FormatId[] = ['bold', 'italic', 'strike', 'code', 'highlight', 'link']
const SETS = {
  all: FORMAT_GROUPS,
  selection: [SELECTION.slice(0, 5), SELECTION.slice(5)].map((ids) => ids.map((id) => FORMAT_ITEMS.get(id)!)),
} satisfies Record<string, FormatItem[][]>

// A touch screen or a narrow one: where the keyboard has no Tab, so the
// toolbar carries Indent and Outdent for list items.
const COMPACT = '(pointer: coarse), (max-width: 767px)'

function useCompact(): boolean {
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.matchMedia(COMPACT).matches)
  useEffect(() => {
    const query = window.matchMedia(COMPACT)
    const update = () => setCompact(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return compact
}

export type FormatButtonsProps = {
  /** Every format, or the ones for selected words. */
  formats: keyof typeof SETS
  /** The editor's state now, to show which formats are on. Null until it's made. */
  state: EditorState | null
  readOnly: boolean
  /** A button pressed: run the format on the editor and give it focus back. */
  onFormat: (id: FormatId) => void
  /** A Table menu item picked (only the fixed toolbar has the menu). */
  onTable?: (action: TableAction) => void
  /** The Image button pressed: pick images to upload. No button without it. */
  onImage?: () => void
  /** The Full screen button pressed. No button without it. */
  onFullScreen?: () => void
  /** Whether the editor is full screen now (the button's state). */
  fullScreen?: boolean
  /** The editable element, for the Table menu to give focus back to. */
  text?: () => HTMLElement | null
}

// A toolbar's row of buttons: one tab stop, the last one used (ARIA's
// toolbar pattern); the arrow keys, Home and End move along the row. The
// toolbar's element (`role="toolbar"`, its name) is the caller's.
export function FormatButtons({ formats, state, readOnly, onFormat, onTable, onImage, onFullScreen, fullScreen = false, text = () => null }: FormatButtonsProps) {
  const apple = isApple()
  const compact = useCompact()
  const groups = SETS[formats].map((group) => group.filter((item) => compact || !item.touch)).filter((group) => group.length > 0)
  const items = groups.flat()
  // The Image and Full screen buttons, last in the row, after the formats.
  const imageIndex = onImage ? items.length : -1
  const fullScreenIndex = onFullScreen ? items.length + (onImage ? 1 : 0) : -1
  const count = items.length + (onImage ? 1 : 0) + (onFullScreen ? 1 : 0)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  // The one button Tab reaches: the last one used.
  const [current, setCurrent] = useState(0)

  const move = (index: number) => {
    const next = (index + count) % count
    setCurrent(next)
    buttons.current[next]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowRight: () => move(current + 1),
      ArrowLeft: () => move(current - 1),
      Home: () => move(0),
      End: () => move(count - 1),
    }
    const action = keys[event.key]
    if (!action || event.metaKey || event.ctrlKey || event.altKey) return
    event.preventDefault()
    action()
  }

  return (
    <TooltipProvider delay={400}>
      {groups.map((group, groupIndex) => (
        <Fragment key={groupIndex}>
          {groupIndex > 0 && <Separator orientation="vertical" className="mx-1 h-5 self-center" />}
          {group.map((item) => {
            const index = items.indexOf(item)
            if (item.id === 'table')
              return (
                <RichTextTableMenu
                  key={item.id}
                  ref={(element: HTMLButtonElement | null) => {
                    buttons.current[index] = element
                  }}
                  state={state}
                  readOnly={readOnly}
                  tabIndex={index === current ? 0 : -1}
                  onFocus={() => setCurrent(index)}
                  onKeyDown={onKeyDown}
                  onInsert={() => onFormat('table')}
                  onAction={(action) => onTable?.(action)}
                  text={text}
                />
              )
            if (item.id === 'highlight')
              return (
                <RichTextHighlightMenu
                  key={item.id}
                  ref={(element: HTMLButtonElement | null) => {
                    buttons.current[index] = element
                  }}
                  state={state}
                  readOnly={readOnly}
                  tabIndex={index === current ? 0 : -1}
                  onFocus={() => setCurrent(index)}
                  onKeyDown={onKeyDown}
                  onFormat={onFormat}
                  text={text}
                />
              )
            const Icon = item.icon
            const tip = [
              item.label,
              item.keys && `(${shownKeys(item.keys, apple)})`,
              item.hint && `· ${item.hint.replace(/Mod\+Shift\+Enter/, shownKeys('Mod+Shift+Enter', apple))}`,
            ]
              .filter(Boolean)
              .join(' ')
            if (item.action)
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger
                    render={
                      <Button
                        ref={(element: HTMLButtonElement | null) => {
                          buttons.current[index] = element
                        }}
                        variant="ghost"
                        size="icon-sm"
                        aria-label={item.label}
                        disabled={readOnly}
                        tabIndex={index === current ? 0 : -1}
                        onMouseDown={(event) => event.preventDefault()}
                        onFocus={() => setCurrent(index)}
                        onKeyDown={onKeyDown}
                        onClick={() => onFormat(item.id)}
                      />
                    }
                  >
                    <Icon />
                  </TooltipTrigger>
                  <TooltipContent>{tip}</TooltipContent>
                </Tooltip>
              )
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger
                  render={
                    <Toggle
                      ref={(element: HTMLButtonElement | null) => {
                        buttons.current[index] = element
                      }}
                      size="icon-sm"
                      aria-label={item.label}
                      aria-keyshortcuts={item.keys ? ariaKeys(item.keys, apple) : undefined}
                      pressed={state ? formatOn(state, item.id) : false}
                      disabled={readOnly}
                      tabIndex={index === current ? 0 : -1}
                      className="aria-pressed:bg-muted aria-pressed:text-foreground"
                      // A mouse press keeps focus, and the selection, in the text.
                      onMouseDown={(event) => event.preventDefault()}
                      onFocus={() => setCurrent(index)}
                      onKeyDown={onKeyDown}
                      onPressedChange={() => onFormat(item.id)}
                    />
                  }
                >
                  <Icon />
                </TooltipTrigger>
                <TooltipContent>{tip}</TooltipContent>
              </Tooltip>
            )
          })}
        </Fragment>
      ))}
      {onImage && (
        <>
          <Separator orientation="vertical" className="mx-1 h-5 self-center" />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  ref={(element: HTMLButtonElement | null) => {
                    buttons.current[imageIndex] = element
                  }}
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Image"
                  disabled={readOnly}
                  tabIndex={imageIndex === current ? 0 : -1}
                  onMouseDown={(event) => event.preventDefault()}
                  onFocus={() => setCurrent(imageIndex)}
                  onKeyDown={onKeyDown}
                  onClick={onImage}
                />
              }
            >
              <ImageIcon />
            </TooltipTrigger>
            <TooltipContent>Image · or paste or drop one</TooltipContent>
          </Tooltip>
        </>
      )}
      {onFullScreen && (
        <>
          <Separator orientation="vertical" className="mx-1 h-5 self-center" />
          <Tooltip>
            <TooltipTrigger
              render={
                <Toggle
                  ref={(element: HTMLButtonElement | null) => {
                    buttons.current[fullScreenIndex] = element
                  }}
                  size="icon-sm"
                  aria-label="Full screen"
                  pressed={fullScreen}
                  tabIndex={fullScreenIndex === current ? 0 : -1}
                  className="aria-pressed:bg-muted aria-pressed:text-foreground"
                  onMouseDown={(event) => event.preventDefault()}
                  onFocus={() => setCurrent(fullScreenIndex)}
                  onKeyDown={onKeyDown}
                  onPressedChange={onFullScreen}
                />
              }
            >
              {fullScreen ? <Minimize2Icon /> : <Maximize2Icon />}
            </TooltipTrigger>
            <TooltipContent>{fullScreen ? 'Leave full screen · Esc' : 'Full screen'}</TooltipContent>
          </Tooltip>
        </>
      )}
    </TooltipProvider>
  )
}

export interface RichTextToolbarProps {
  /** The editor's state now, to show which formats are on. Null until it's made. */
  state: EditorState | null
  readOnly: boolean
  /** The editable element's id, for `aria-controls`. */
  controls?: string
  /** A button pressed: run the format on the editor and give it focus back. */
  onFormat: (id: FormatId) => void
  /** A Table menu item picked: run it on the editor and give it focus back. */
  onTable: (action: TableAction) => void
  /** The Image button pressed (only when the editor uploads images). */
  onImage?: () => void
  /** The Full screen button pressed. No button without it. */
  onFullScreen?: () => void
  /** Whether the editor is full screen now. */
  fullScreen?: boolean
  /** The editable element, for the Table menu to give focus back to. */
  text: () => HTMLElement | null
  /** The toolbar's element, for Alt+F10 to reach it from the text. */
  ref?: Ref<HTMLDivElement>
}

export function RichTextToolbar({ state, readOnly, controls, onFormat, onTable, onImage, onFullScreen, fullScreen, text, ref }: RichTextToolbarProps) {
  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Formatting"
      aria-controls={controls}
      data-slot="rich-text-toolbar"
      className="flex flex-wrap items-center gap-0.5 border-b border-input px-1 py-1"
    >
      <FormatButtons formats="all" state={state} readOnly={readOnly} onFormat={onFormat} onTable={onTable} onImage={onImage} onFullScreen={onFullScreen} fullScreen={fullScreen} text={text} />
    </div>
  )
}
