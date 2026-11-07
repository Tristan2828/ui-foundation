// Editing in place on a record's view: what a field passes to EntityView
// (or to an EditableValue in its header) to become editable where it's
// shown. The rules live in edit-in-place-store.ts; the markup in
// editable-value.tsx, and a list's in editable-list.tsx. Design language:
// cell-patterns.md "Editable value" and "Editable list".
import { createContext, type ReactNode } from 'react'
import type { FieldValues, UseFormReturn } from 'react-hook-form'
import type { EditInPlaceStore } from './edit-in-place-store'

/** What an editable value's control is given. Spread what applies onto the form's own control. */
export type EditControlProps<TDraft> = {
  /** The control's id. */
  id: string
  /** The draft: exactly what's been typed or picked. */
  value: TDraft
  onChange: (value: TDraft) => void
  /**
   * Save now. A choice calls it with the value picked (`commit(value)`):
   * a choice saves the moment it's picked.
   */
  commit: (value?: TDraft) => void
  /** Close without saving: a list closed with nothing picked. */
  cancel: () => void
  /** The save is in flight: show the draft, don't let it change. */
  disabled: boolean
  /** The draft was refused; its reason is under it (`aria-describedby`). */
  invalid: boolean
  /** The field's label: the control's accessible name. */
  label: string
  /** The id of the line under the control (Saving…, or why it can't save). */
  describedBy: string
  /** For a control that can't always produce a value to save (RichTextEditor's `onProblem`). */
  onProblem: (message: string | null) => void
  /**
   * The field is `inline`: always editable, drawn as the text it edits.
   * Give it to RichTextEditor's `inline` (with `toolbar="floating"`).
   */
  inline?: boolean
  /**
   * A refusal's messages about the value's own fields (`fieldErrors`),
   * keyed by each field's path inside the value (`text`, `effort`). Show
   * each on its field (`aria-invalid`, the message under it).
   */
  errors?: Readonly<Record<string, string>>
}

/**
 * How the value saves, which follows from its control:
 * - `text`: one line. Enter saves (as does leaving it).
 * - `long-text`: Ctrl/Cmd+Enter saves; Enter is a new line.
 * - `choice`: one pick (a select, a switch, a single reference). Saves the
 *   moment it's picked; its list opens with the field.
 * - `multi`: several picks (a multi reference). Saves on leaving it, or
 *   Ctrl/Cmd+Enter; Enter picks.
 * Leaving the field saves every kind; Esc gives up.
 */
export type EditKind = 'text' | 'long-text' | 'choice' | 'multi'

type SafeParseResult<TValue> =
  | { success: true; data: TValue }
  | { success: false; error: { issues: readonly { message: string; path?: readonly PropertyKey[] }[] } }

/** A field marked editable. Make one with `editInPlace({...})`, or a ready-made one with `inPlace`. */
export type EditInPlace = {
  kind: EditKind
  value: unknown
  control: (props: EditControlProps<unknown>) => ReactNode
  schema?: { safeParse: (value: unknown) => SafeParseResult<unknown> }
  save: (value: unknown) => Promise<unknown>
  isEqual?: (a: unknown, b: unknown) => boolean
  autosave?: boolean
  alwaysEditable?: boolean
  inline?: boolean
  shown?: ReactNode
  fieldErrors?: (cause: unknown) => Record<string, string> | null
  errorsOnFields?: boolean
}

export type EditInPlaceOptions<TDraft, TValue> = {
  kind: EditKind
  /** The saved value as the control holds it: what the form's control would start from. */
  value: TDraft
  /** The form's own control for this field (one control per field, shared with the form). */
  control: (props: EditControlProps<TDraft>) => ReactNode
  /**
   * The form's schema for this field (`widgetFormSchema.shape.name`): a
   * value it refuses never leaves the browser, and its message shows
   * under the field. Its output is what `save` gets.
   */
  schema?: { safeParse: (value: unknown) => SafeParseResult<TValue> }
  /**
   * Saves the value: the entity's single-field save (`useRecordUpdate`
   * with `optimistic: false, toastOnError: false`), `mutateAsync` of the
   * field's update. Rejects with the AppError; a 422's field error shows
   * under the field word for word.
   */
  save: (value: TValue) => Promise<unknown>
  /** Whether a draft is still the saved value. Defaults to comparing as JSON. */
  isEqual?: (a: TDraft, b: TDraft) => boolean
  /**
   * Saves on its own, Notion-style, for long text: about a second after
   * typing stops, and at once on leaving the field or the page. The
   * control stays editable while it saves ("Saving…", then "Saved"), and
   * saves never cross: the next waits for the one in flight and sends the
   * latest draft. Esc saves and closes; nothing reverts. A refusal keeps
   * the draft and its reason, as without it.
   */
  autosave?: boolean
  /**
   * The control is the value: shown at rest, with no click to open (the
   * notes are the editor). Implies `autosave`. Its control shouldn't take
   * `autoFocus`. At rest it shows the control, not the read view: a link
   * in rich text is edited there, not followed.
   */
  alwaysEditable?: boolean
  /**
   * For long text: always editable (implies `alwaysEditable`), and drawn
   * as the read view, not as a field: no border, no box, typed into where
   * it's read (Notion-style). The control gets `inline: true`; pass it to
   * RichTextEditor's `inline`, with `toolbar="floating"` (the toolbar over
   * a selection and the slash menu, no bar above the text). An empty one
   * shows the editor's `placeholder`, not the view's "Not set".
   */
  inline?: boolean
  /**
   * How the value reads at rest, for a field that gives no `value` of its
   * own (EntityView's field, EditableValue's children). The `inPlace`
   * presets set it. `null` reads as the field's "Not set".
   */
  shown?: ReactNode
  /**
   * Which of the value's own fields a refusal is about, for a value made of
   * several (a pair saved as one): given the schema's error (`{ issues }`)
   * or the save's rejection (the AppError), each field's message keyed by
   * its path inside the value. The control gets them as `errors`.
   */
  fieldErrors?: (cause: unknown) => Record<string, string> | null
  /**
   * The control shows `errors` on its own fields, so a refusal about one
   * of them isn't repeated under the control; one about none still shows there.
   */
  errorsOnFields?: boolean
}

/** What a list item's fields are given while it's edited: a control's props, plus where the item is. */
export type EditListItemProps<TItem> = EditControlProps<TItem> & {
  /** The item's position; for the item being added, the one it will take (the list's length). */
  index: number
  /** The item being added at the end, not one already in the list. */
  isNew: boolean
  /**
   * With the list's `itemForm`: a react-hook-form form holding the list
   * under its `name`, the draft at `index`, so the form's own row works
   * here unchanged (`form.register('checklist.2.text')` for item 2, a
   * `Controller` on `form.control`, its errors in `form.formState.errors`).
   * Every change to it is the item's draft.
   */
  form?: UseFormReturn<FieldValues>
  /** With `groupBy`: the group the item being added goes in (what its "Add" was under). */
  group?: string
}

/** What a list's own `add` is given: how to put new items at the end, saved as the list's other changes are. */
export type EditListAddProps<TItem> = {
  /**
   * Saves these items at the end of the list, through the list's `save`
   * (built on its latest list, after whatever is open and whatever is
   * still saving). "Saving…" and a refusal show under the list, as for a
   * move. Resolves once it's done: `true` saved, `false` refused.
   */
  add: (items: TItem[]) => Promise<boolean>
  /** The list as saved: to stop adding at a limit (`items.length >= max`). */
  items: readonly TItem[]
  /** A change is saving: the list's buttons wait, and so should this one. */
  disabled: boolean
  /** Why the add can't happen (an upload refused), under the list where a refused save shows; `null` clears it. */
  onProblem: (message: string | null) => void
}

/**
 * A list of sub-items edited in place (a checklist, a list of links, a
 * record's files), on a `content` section of EntityView. Make one with
 * `editInPlace({ kind: 'list', ... })`. Every item reads as `renderShown`
 * (a quick action, such as its done box, still works there); clicking it
 * or its pencil turns it into `renderItem`, the form's own row. "Add" at
 * the end opens a new item (`newItem`), or the app's own `add` puts items
 * there (an upload); move up, move down and remove are ListEditor's
 * buttons. Each change is one save of the whole list.
 */
export type EditInPlaceListOptions<TItem> = {
  kind: 'list'
  /** The saved list. */
  value: readonly TItem[]
  /**
   * The item's own fields while it's edited: the form's row (what its
   * ListEditor's `renderItem` shows), as controls over `props.value`.
   * Laid out in a row as ListEditor's is: a fragment's parts sit side by
   * side, and a single element fills the row.
   */
  renderItem: (props: EditListItemProps<TItem>) => ReactNode
  /** How the item reads when it isn't being edited. Its own controls (a done box) keep working. */
  renderShown: (item: TItem, index: number) => ReactNode
  /**
   * A blank item, what "Add" starts from. Not needed with `add`; one or
   * the other is. With `groupBy`, each group has its own Add, given that
   * group's key (`(room) => ({ text: '', room })`).
   */
  newItem?: (group?: string) => TItem
  /**
   * In place of "Add" and its blank item: what adds items, such as a file
   * upload or a picker, e.g. a button that uploads, then calls
   * `props.add(stored.map(toItem))`. The items save at the end of the list
   * through `save`, so they read, move and save like any other.
   */
  add?: (props: EditListAddProps<TItem>) => ReactNode
  /** How the buttons name an item, as on the form: (i) => `item ${i + 1}` gives "Move item 2 up". */
  itemName: (index: number) => string
  /** The Add button's text, e.g. "Add item". Not needed with `add`, whose control has its own. */
  addLabel?: string
  /**
   * The form's schema for the whole list (`widgetFormSchema.shape.checklist`).
   * Each change is checked as the list it would make; a message about an
   * item shows under that item.
   */
  schema?: { safeParse: (value: unknown) => SafeParseResult<TItem[]> }
  /**
   * Saves a change to the list: call the record's single-field save with
   * the change applied to the record's latest list, so it builds on any
   * save still in flight (a tick, a move), e.g.
   * `(change) => edit.mutateAsync((widget) => ({ checklist: change(widget.checklist) }))`.
   * Rejects with the AppError; a 422's message shows where the change was made.
   */
  save: (change: (current: TItem[]) => TItem[]) => Promise<unknown>
  /**
   * Shows the items under headings, by one of their fields (a room, a
   * day): each group its own list with its own move buttons (an item moves
   * past the group's next item, never into another group) and its own Add.
   * The list still saves as one, in its own order.
   */
  groupBy?: {
    /** The item's group. */
    key: (item: TItem) => string
    /** The group's heading. Defaults to its key. */
    label?: (key: string) => string
    /**
     * The groups in this order, each shown even with no items (so its Add
     * is there). Groups not named follow, in the order their first item comes.
     */
    order?: readonly string[]
  }
  /**
   * Shows only the items this keeps (the view's filter, a pill's value).
   * The others stay in the list as they are: a move passes over them, a
   * save keeps them. A new item that this drops goes out of sight once saved.
   */
  filter?: (item: TItem, index: number) => boolean
  /**
   * Puts a Duplicate button beside Remove ("Duplicate item 2"), as on the
   * form's ListEditor: the copy this makes of an item goes right after it,
   * saved as a move is. Leave out what a copy mustn't share (a saved id).
   */
  duplicate?: (item: TItem) => TItem
  /**
   * The list's field name on the record (`checklist`). A refusal from the
   * server about an item's field (a 422 at `checklist.2.text`) is then
   * given to that item's row as `errors.text`. Needed by `itemForm`.
   */
  name?: string
  /**
   * The row shows `props.errors` on its own fields (the schema's and the
   * server's), so they aren't repeated under the row; a message about no
   * one field still shows there. Implied by `itemForm`.
   */
  errorsOnFields?: boolean
  /**
   * The row is the form's react-hook-form row: `renderItem` gets `form`, a
   * form of the list under `name`, so the row registers its fields as on
   * the form and shows their errors (the schema's and a 422's, set on it
   * with `setError`) as the form does. No form of the app's own per item.
   */
  itemForm?: boolean
}

/** A list marked editable in place. Make one with `editInPlace({ kind: 'list', ... })`. */
export type EditInPlaceList = Omit<
  EditInPlaceListOptions<unknown>,
  'renderItem' | 'renderShown' | 'schema' | 'save' | 'add' | 'groupBy' | 'filter' | 'duplicate'
> & {
  add?: (props: EditListAddProps<unknown>) => ReactNode
  renderItem: (props: EditListItemProps<unknown>) => ReactNode
  renderShown: (item: unknown, index: number) => ReactNode
  schema?: { safeParse: (value: unknown) => SafeParseResult<unknown[]> }
  save: (change: (current: unknown[]) => unknown[]) => Promise<unknown>
  groupBy?: { key: (item: unknown) => string; label?: (key: string) => string; order?: readonly string[] }
  filter?: (item: unknown, index: number) => boolean
  duplicate?: (item: unknown) => unknown
}

/** Marks a list editable in place: its items added, edited, removed and moved on the view. */
export function editInPlace<TItem>(options: EditInPlaceListOptions<TItem>): EditInPlaceList
/** Marks a field editable in place, typed end to end: draft → schema → save. */
export function editInPlace<TDraft, TValue = TDraft>(options: EditInPlaceOptions<TDraft, TValue>): EditInPlace
export function editInPlace(options: unknown): EditInPlace | EditInPlaceList {
  return options as EditInPlace | EditInPlaceList
}

export const EditInPlaceContext = createContext<EditInPlaceStore | null>(null)
