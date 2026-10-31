// The rich-text editor's tools strip, for a field with the floating toolbar
// only (`toolbar="floating"`: notes edited where they're read), which has no
// bar above the text to carry the buttons that aren't about selected words:
// Outdent and Indent for list items (on a touch screen or a narrow one,
// where the keyboard has no Tab) and Full screen. A small strip over the
// field's top right corner while the field has focus, or is full screen;
// the same buttons, keys and tab stop as the fixed toolbar's
// (rich-text-toolbar.tsx). Alt+F10 reaches it when nothing else is showing;
// Esc gives focus back to the text (or leaves full screen).
//
// Placed against the field's element like the floating toolbar, not in a
// portal (rich-text-floating-toolbar.tsx says why).
import type { FocusEvent, KeyboardEvent, Ref } from 'react'
import type { EditorState } from '@milkdown/kit/prose/state'
import { cn } from 'cn'
import type { FormatId } from './rich-text-formats'
import { FormatButtons } from './rich-text-toolbar'

export interface RichTextToolsBarProps {
  state: EditorState | null
  readOnly: boolean
  fullScreen: boolean
  /** The editable element's id, for `aria-controls`. */
  controls: string
  onFormat: (id: FormatId) => void
  onFullScreen: () => void
  /** Esc: focus back to the text. */
  onReturn: () => void
  /** Focus leaving one of its buttons, for the editor to tell whether it left the field. */
  onBlur: (event: FocusEvent) => void
  ref?: Ref<HTMLDivElement>
}

export function RichTextToolsBar({ state, readOnly, fullScreen, controls, onFormat, onFullScreen, onReturn, onBlur, ref }: RichTextToolsBarProps) {
  const onKeyDown = (event: KeyboardEvent) => {
    // Full screen's Esc is the field's (milkdown-editor.tsx); otherwise it
    // gives focus back to the text.
    if (event.key === 'Escape' && !fullScreen) {
      event.preventDefault()
      event.stopPropagation()
      onReturn()
    }
  }
  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Editor tools"
      aria-controls={controls}
      data-slot="rich-text-tools-bar"
      className={cn(
        'absolute right-0 z-40 flex items-center gap-0.5 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10',
        // Above the field, or inside its corner once it fills the window.
        fullScreen ? 'top-2 right-2' : 'bottom-full mb-1',
      )}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      <FormatButtons formats="tools" state={state} readOnly={readOnly} onFormat={onFormat} onFullScreen={onFullScreen} fullScreen={fullScreen} />
    </div>
  )
}
