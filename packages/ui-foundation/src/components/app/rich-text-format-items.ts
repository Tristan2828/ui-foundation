// The rich-text editor's formats as people see them: each one's name, icon
// and shortcut, in the groups the fixed toolbar shows. Shared by the
// toolbars (rich-text-toolbar.tsx), the slash menu
// (rich-text-slash-menu.tsx) and the keys (rich-text-shortcuts.ts).
//
// Shortcuts are Notion's where Notion has one: Ctrl+Shift+1 to 6 and 8 for
// blocks (Cmd+Option on a Mac, where Cmd+Shift+3 to 5 take screenshots),
// written `Block+…` here; Mod+Shift+S strikes through. Milkdown's own
// (Ctrl+Alt+1, Mod+Alt+X, Mod+Shift+B, …) still work.
import {
  BoldIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  ListChecksIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  SquareCodeIcon,
  StrikethroughIcon,
  TableIcon,
  TextQuoteIcon,
  type LucideIcon,
} from 'lucide-react'
import { CALLOUT_KINDS } from '@/lib/markdown-callout'
import { CALLOUT_LOOK } from './prose-look'
import type { CalloutFormat, FormatId } from './rich-text-formats'

export type FormatItem = {
  id: FormatId
  label: string
  icon: LucideIcon
  /**
   * Its shortcut, as `aria-keyshortcuts` writes it with Mod for Ctrl/Cmd,
   * and Block for Notion's block keys (Ctrl+Shift, or Cmd+Option on a Mac).
   */
  keys?: string
  /** More for the tooltip than the shortcut. */
  hint?: string
}

export const FORMAT_GROUPS: FormatItem[][] = [
  [
    { id: 'bold', label: 'Bold', icon: BoldIcon, keys: 'Mod+B' },
    { id: 'italic', label: 'Italic', icon: ItalicIcon, keys: 'Mod+I' },
    { id: 'strike', label: 'Strikethrough', icon: StrikethroughIcon, keys: 'Mod+Shift+S' },
    { id: 'code', label: 'Code', icon: CodeIcon, keys: 'Mod+E' },
  ],
  [
    { id: 'heading1', label: 'Heading 1', icon: Heading1Icon, keys: 'Block+1' },
    { id: 'heading2', label: 'Heading 2', icon: Heading2Icon, keys: 'Block+2' },
    { id: 'heading3', label: 'Heading 3', icon: Heading3Icon, keys: 'Block+3' },
  ],
  [
    { id: 'tasks', label: 'Task list', icon: ListChecksIcon, keys: 'Block+4', hint: 'tick an item: Mod+Shift+Enter' },
    { id: 'bullets', label: 'Bulleted list', icon: ListIcon, keys: 'Block+5' },
    { id: 'numbers', label: 'Numbered list', icon: ListOrderedIcon, keys: 'Block+6' },
  ],
  [
    { id: 'quote', label: 'Quote', icon: TextQuoteIcon, keys: 'Mod+Shift+B' },
    { id: 'callout', label: 'Callout', icon: CALLOUT_LOOK.note.icon },
    { id: 'codeBlock', label: 'Code block', icon: SquareCodeIcon, keys: 'Block+8' },
    { id: 'divider', label: 'Divider', icon: MinusIcon, hint: 'or type ---' },
  ],
  [{ id: 'table', label: 'Table', icon: TableIcon }],
  [{ id: 'link', label: 'Link', icon: LinkIcon, keys: 'Mod+K' }],
]

/** Every format by its id. */
export const FORMAT_ITEMS = new Map(FORMAT_GROUPS.flat().map((item) => [item.id, item]))

/**
 * A callout of each kind but the default, for the slash menu: "Warning
 * callout". Not on the toolbar (its Callout makes a note).
 */
export const CALLOUT_VARIANTS: FormatItem[] = CALLOUT_KINDS.filter((kind) => kind !== 'note').map((kind) => ({
  id: `callout-${kind}` as CalloutFormat,
  label: `${CALLOUT_LOOK[kind].label} callout`,
  icon: CALLOUT_LOOK[kind].icon,
}))

/** Notion's block keys: the digit after Ctrl+Shift (Cmd+Option on a Mac), and its format. */
export const BLOCK_KEYS: Record<string, FormatId> = {
  '0': 'text',
  '1': 'heading1',
  '2': 'heading2',
  '3': 'heading3',
  '4': 'tasks',
  '5': 'bullets',
  '6': 'numbers',
  '8': 'codeBlock',
}
