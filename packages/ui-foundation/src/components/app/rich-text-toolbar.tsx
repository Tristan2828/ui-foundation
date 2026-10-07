// The rich-text editor's fixed toolbar: one row of pressed/not-pressed
// buttons above the text, each a format and its keyboard shortcut.
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
import { Fragment, useRef, useState, type KeyboardEvent, type Ref } from 'react'
import type { EditorState } from '@milkdown/kit/prose/state'
import { Separator } from '@/components/ui/separator'
import { Toggle } from '@/components/ui/toggle'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { FORMAT_GROUPS, type FormatItem } from './rich-text-format-items'
import { formatOn, type FormatId } from './rich-text-formats'

function isApple(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
}

// `aria-keyshortcuts` names real keys: Meta on Apple, Control elsewhere.
function ariaKeys(keys: string, apple: boolean): string {
  return keys.replace('Mod', apple ? 'Meta' : 'Control')
}

// What a person reads: ⌘⌥X on Apple, Ctrl+Alt+X elsewhere.
function shownKeys(keys: string, apple: boolean): string {
  if (!apple) return keys.replace('Mod', 'Ctrl')
  const symbols: Record<string, string> = { Mod: '⌘', Alt: '⌥', Shift: '⇧', Enter: '↵' }
  return keys
    .split('+')
    .map((part) => symbols[part] ?? part)
    .join('')
}

// Which buttons a toolbar has: every format (the fixed one), or the ones
// that apply to selected words (the floating one).
const SETS = {
  all: FORMAT_GROUPS,
  selection: [FORMAT_GROUPS[0], FORMAT_GROUPS[4]],
} satisfies Record<string, FormatItem[][]>

export type FormatButtonsProps = {
  /** Every format, or the ones for selected words. */
  formats: keyof typeof SETS
  /** The editor's state now, to show which formats are on. Null until it's made. */
  state: EditorState | null
  readOnly: boolean
  /** A button pressed: run the format on the editor and give it focus back. */
  onFormat: (id: FormatId) => void
}

// A toolbar's row of buttons: one tab stop, the last one used (ARIA's
// toolbar pattern); the arrow keys, Home and End move along the row. The
// toolbar's element (`role="toolbar"`, its name) is the caller's.
export function FormatButtons({ formats, state, readOnly, onFormat }: FormatButtonsProps) {
  const apple = isApple()
  const groups = SETS[formats]
  const items = groups.flat()
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  // The one button Tab reaches: the last one used.
  const [current, setCurrent] = useState(0)

  const move = (index: number) => {
    const next = (index + items.length) % items.length
    setCurrent(next)
    buttons.current[next]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowRight: () => move(current + 1),
      ArrowLeft: () => move(current - 1),
      Home: () => move(0),
      End: () => move(items.length - 1),
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
            const Icon = item.icon
            const tip = [
              item.label,
              item.keys && `(${shownKeys(item.keys, apple)})`,
              item.hint && `· ${item.hint.replace(/Mod\+Shift\+Enter/, shownKeys('Mod+Shift+Enter', apple))}`,
            ]
              .filter(Boolean)
              .join(' ')
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
  /** The toolbar's element, for Alt+F10 to reach it from the text. */
  ref?: Ref<HTMLDivElement>
}

export function RichTextToolbar({ state, readOnly, controls, onFormat, ref }: RichTextToolbarProps) {
  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Formatting"
      aria-controls={controls}
      data-slot="rich-text-toolbar"
      className="flex flex-wrap items-center gap-0.5 border-b border-input px-1 py-1"
    >
      <FormatButtons formats="all" state={state} readOnly={readOnly} onFormat={onFormat} />
    </div>
  )
}
