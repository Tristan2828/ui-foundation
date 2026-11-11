// A record's field row as the target of its value edited in place (4.88,
// the form standard's F15 and F18): EditableValue's `look="row"`. The row
// wears the list's row hover (the `--table-hover` tint and the 3px
// `--primary` bar at its start, as DataTable's rows do since 4.83), its
// muted words read as foreground on the tint, and under 48rem or on a
// touch screen it's 44px tall at least. Clicking anywhere on it opens the
// value. EntityView's field rows wear it; a field list of the app's own can too:
//
//   <div className={cn(editRowClass, 'grid grid-cols-[8rem_1fr]')} onClick={onEditRowClick}>
//     <dt>Status</dt>
//     <dd><EditableValue look="row" label="Status" edit={statusEdit} /></dd>
//   </div>
import type { MouseEvent } from 'react'

/** How long "✓ Saved" stays beside a value once its save lands. */
export const SAVED_FOR_MS = 2000

/** The classes that make a field row the target of the `look="row"` EditableValue inside it. */
export const editRowClass = [
  'group/edit-row cursor-text rounded-md transition-colors',
  'hover:bg-(--table-hover) hover:shadow-[inset_3px_0_0_0_var(--primary)]',
  'has-[[data-edit]:focus-visible]:bg-(--table-hover) has-[[data-edit]:focus-visible]:shadow-[inset_3px_0_0_0_var(--primary)]',
  // Muted words (the label, "Not set") read as foreground on the tint.
  'hover:[&_.text-muted-foreground]:text-foreground has-[[data-edit]:focus-visible]:[&_.text-muted-foreground]:text-foreground',
  // Open, the control has its own look: no row hover over it. (Written
  // out whole: Tailwind finds classes by reading the source.)
  'has-[[data-slot=editable-value][data-state]]:cursor-auto has-[[data-slot=editable-value][data-state]]:bg-transparent has-[[data-slot=editable-value][data-state]]:shadow-none has-[[data-slot=editable-value][data-state]]:[&_.text-muted-foreground]:text-muted-foreground',
  // A finger's target.
  'max-md:min-h-11 pointer-coarse:min-h-11',
].join(' ')

// What a click on the row leaves alone: links, buttons and boxes, and the open control.
const LEAVE_ALONE =
  'a[href], button, input, select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="switch"], [role="combobox"], [role="listbox"], [data-slot=editable-value][data-state]'

/** The row's click: anywhere on it but a link, a button or the open control opens its value. */
export function onEditRowClick(event: MouseEvent<HTMLElement>) {
  if ((event.target as Element).closest(LEAVE_ALONE)) return
  event.currentTarget.querySelector<HTMLButtonElement>('[data-slot="editable-value"] [data-edit]')?.click()
}
