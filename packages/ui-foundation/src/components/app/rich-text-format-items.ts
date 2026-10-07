// The rich-text editor's formats as people see them: each one's name, icon
// and shortcut, in the groups the fixed toolbar shows. Shared by the
// toolbars (rich-text-toolbar.tsx) and the slash menu
// (rich-text-slash-menu.tsx).
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
import type { FormatId } from './rich-text-formats'

export type FormatItem = {
  id: FormatId
  label: string
  icon: LucideIcon
  /** Milkdown's own shortcut, as `aria-keyshortcuts` writes it with Mod for Ctrl/Cmd. */
  keys?: string
  /** More for the tooltip than the shortcut. */
  hint?: string
}

export const FORMAT_GROUPS: FormatItem[][] = [
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

