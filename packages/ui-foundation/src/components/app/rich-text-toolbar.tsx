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
import {
  BoldIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  ItalicIcon,
  LinkIcon,
  ListChecksIcon,
  ListIcon,
  ListOrderedIcon,
  SquareCodeIcon,
  StrikethroughIcon,
  TextQuoteIcon,
  type LucideIcon,
} from 'lucide-react'
import { Fragment, useRef, useState, type KeyboardEvent } from 'react'
import type { EditorState } from '@milkdown/kit/prose/state'
import { Separator } from '@/components/ui/separator'
import { Toggle } from '@/components/ui/toggle'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatOn, type FormatId } from './rich-text-formats'

type Item = {
  id: FormatId
  label: string
  icon: LucideIcon
  /** Milkdown's own shortcut, as `aria-keyshortcuts` writes it with Mod for Ctrl/Cmd. */
  keys?: string
  /** More for the tooltip than the shortcut. */
  hint?: string
}

const GROUPS: Item[][] = [
  [
    { id: 'bold', label: 'Bold', icon: BoldIcon, keys: 'Mod+B' },
    { id: 'italic', label: 'Italic', icon: ItalicIcon, keys: 'Mod+I' },
    { id: 'strike', label: 'Strikethrough', icon: StrikethroughIcon, keys: 'Mod+Alt+X' },
    { id: 'code', label: 'Code', icon: CodeIcon, keys: 'Mod+E' },
  ],
  [
    { id: 'heading', label: 'Heading', icon: Heading1Icon, keys: 'Mod+Alt+1' },
    { id: 'subheading', label: 'Subheading', icon: Heading2Icon, keys: 'Mod+Alt+2' },
  ],
  [
    { id: 'bullets', label: 'Bulleted list', icon: ListIcon, keys: 'Mod+Alt+8' },
    { id: 'numbers', label: 'Numbered list', icon: ListOrderedIcon, keys: 'Mod+Alt+7' },
    { id: 'tasks', label: 'Task list', icon: ListChecksIcon, hint: 'tick an item: Mod+Shift+Enter' },
  ],
  [
    { id: 'quote', label: 'Quote', icon: TextQuoteIcon, keys: 'Mod+Shift+B' },
    { id: 'codeBlock', label: 'Code block', icon: SquareCodeIcon, keys: 'Mod+Alt+C' },
  ],
  [{ id: 'link', label: 'Link', icon: LinkIcon, keys: 'Mod+K' }],
]

const ITEMS = GROUPS.flat()

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

export interface RichTextToolbarProps {
  /** The editor's state now, to show which formats are on. Null until it's made. */
  state: EditorState | null
  readOnly: boolean
  /** The editable element's id, for `aria-controls`. */
  controls?: string
  /** A button pressed: run the format on the editor and give it focus back. */
  onFormat: (id: FormatId) => void
}

export function RichTextToolbar({ state, readOnly, controls, onFormat }: RichTextToolbarProps) {
  const apple = isApple()
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  // The one button Tab reaches: the last one used.
  const [current, setCurrent] = useState(0)

  const move = (index: number) => {
    const next = (index + ITEMS.length) % ITEMS.length
    setCurrent(next)
    buttons.current[next]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowRight: () => move(current + 1),
      ArrowLeft: () => move(current - 1),
      Home: () => move(0),
      End: () => move(ITEMS.length - 1),
    }
    const action = keys[event.key]
    if (!action || event.metaKey || event.ctrlKey || event.altKey) return
    event.preventDefault()
    action()
  }

  return (
    <TooltipProvider delay={400}>
      <div
        role="toolbar"
        aria-label="Formatting"
        aria-controls={controls}
        data-slot="rich-text-toolbar"
        className="flex flex-wrap items-center gap-0.5 border-b border-input px-1 py-1"
        onKeyDown={onKeyDown}
      >
        {GROUPS.map((group, groupIndex) => (
          <Fragment key={groupIndex}>
            {groupIndex > 0 && <Separator orientation="vertical" className="mx-1 h-5 self-center" />}
            {group.map((item) => {
              const index = ITEMS.indexOf(item)
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
      </div>
    </TooltipProvider>
  )
}
