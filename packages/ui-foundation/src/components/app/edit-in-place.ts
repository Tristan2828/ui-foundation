// Editing in place on a record's view: what a field passes to EntityView
// (or to an EditableValue in its header) to become editable where it's
// shown. The rules live in edit-in-place-store.ts; the markup in
// editable-value.tsx. Design language: cell-patterns.md "Editable value".
import { createContext, type ReactNode } from 'react'
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
  | { success: false; error: { issues: readonly { message: string }[] } }

/** A field marked editable. Make one with `editInPlace({...})`. */
export type EditInPlace = {
  kind: EditKind
  value: unknown
  control: (props: EditControlProps<unknown>) => ReactNode
  schema?: { safeParse: (value: unknown) => SafeParseResult<unknown> }
  save: (value: unknown) => Promise<unknown>
  isEqual?: (a: unknown, b: unknown) => boolean
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
}

/** Marks a field editable in place, typed end to end: draft → schema → save. */
export function editInPlace<TDraft, TValue = TDraft>(options: EditInPlaceOptions<TDraft, TValue>): EditInPlace {
  return options as unknown as EditInPlace
}

export const EditInPlaceContext = createContext<EditInPlaceStore | null>(null)
