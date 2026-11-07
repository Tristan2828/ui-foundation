// A list of sub-items edited in place on a record's view (cell-patterns.md
// "Editable list"): editInPlace's `list` kind, on a `content` section of
// EntityView. Built on ListEditor, so the rows and their buttons are the
// form's, with the same names ("Move item 2 up", "Remove item 2").
//
// - Each item reads as the app's `renderShown`, whose own controls (a
//   done box) keep working. Clicking it, or its pencil, turns it into the
//   form's row (`renderItem`), an EditableValue like any field: leaving or
//   Enter saves, Esc gives up, one field open at a time.
// - "Add" at the end opens a new item the same way. Enter saves it and
//   opens the next, so a run of items goes in from the keyboard. Or the
//   app's own `add` (an upload) puts items at the end, saved as a move is.
// - Move and remove save at once. Whatever is open is saved first; while
//   the change saves, the buttons wait, "Saving…" shows under the list,
//   and a refusal leaves the list as it was with the reason under it.
// - Every change is one save of the whole list, built from the record's
//   latest list when it's sent (`save` takes a change, not a list), so it
//   never undoes a tick or another change still saving.
// - `groupBy` shows the items under headings, each group its own rows and
//   Add; `filter` shows only some. Both only change what's shown: the
//   list saves as one, in its own order, and a move swaps an item with the
//   next one shown. `duplicate` adds ListEditor's Duplicate button.
// - A refusal about an item's own field (the schema's, or a 422 at
//   `<name>.2.text`) goes to the row as `errors`; `itemForm` hands the row
//   a react-hook-form form of the list instead, with those errors set on it.
import { PlusIcon } from 'lucide-react'
import { useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { FormProvider, useForm, type FieldValues } from 'react-hook-form'
import type { AppError } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import {
  EditInPlaceContext,
  type EditControlProps,
  type EditInPlace,
  type EditInPlaceList,
  type EditListAddProps,
  type EditListItemProps,
} from './edit-in-place'
import { messageOf } from './edit-in-place-store'
import { EditableField } from './editable-value'
import { ListEditor } from './list-editor'

const sameItem = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// Where the item shown at `index` is in the latest list: still there, or
// wherever a change saved before this one moved it, or, if it isn't
// anywhere as shown (it was itself just changed), the same position.
function locate(current: readonly unknown[], item: unknown, index: number) {
  if (index < current.length && sameItem(current[index], item)) return index
  const found = current.findIndex((other) => sameItem(other, item))
  return found === -1 ? index : found
}

// The form's row, in place too: ListEditor lays `renderItem` out in a
// row, so its parts (a done box, then the text box) sit side by side
// there and here alike. One element (an app's own row) fills it, as it
// filled the field's column before.
function ItemRow({ children }: { children: ReactNode }) {
  return <span className="flex min-w-0 items-start gap-2 [&>:only-child]:flex-1">{children}</span>
}

type Issue = { message: string; path?: readonly PropertyKey[] }
type Parsed = { success: true; data: unknown } | { success: false; error: { issues: readonly Issue[] } }

// The list's schema, run on the list this draft would make. Messages
// about this item come first, then one about the list as a whole (too
// many items).
function checkItem(edit: EditInPlaceList, items: readonly unknown[], index: number, draft: unknown): Parsed {
  if (!edit.schema) return { success: true, data: draft }
  const list = index < items.length ? items.map((item, i) => (i === index ? draft : item)) : [...items, draft]
  const result = edit.schema.safeParse(list)
  if (result.success) return { success: true, data: result.data[index] }
  const { issues } = result.error
  const own = issues.filter(({ path }) => path?.[0] === index)
  const issue = own[0] ?? issues.find(({ path }) => !path?.length) ?? issues[0]
  return { success: false, error: { issues: own.length > 0 ? own : issue ? [issue] : [] } }
}

// What a refusal says about the item's own fields, keyed by the field's
// path inside the item (`text`, `links.0.url`): the schema's issues at
// [index, ...], or a 422's field errors at `<name>.<index>.…`.
function itemFieldErrors(edit: EditInPlaceList, index: number, cause: unknown): Record<string, string> | null {
  const errors: Record<string, string> = {}
  if (cause && typeof cause === 'object' && 'issues' in cause) {
    for (const { message, path } of (cause as { issues: readonly Issue[] }).issues) {
      if (path?.[0] !== index || path.length < 2) continue
      errors[path.slice(1).map(String).join('.')] ??= message
    }
  } else if (edit.name && cause && typeof cause === 'object' && 'kind' in cause) {
    const prefix = `${edit.name}.${index}.`
    for (const [field, messages] of Object.entries((cause as AppError).fieldErrors ?? {})) {
      if (field.startsWith(prefix) && messages[0]) errors[field.slice(prefix.length)] ??= messages[0]
    }
  }
  return Object.keys(errors).length > 0 ? errors : null
}

type ItemFormProps = {
  name: string
  index: number
  /** The list as the form holds it: the draft at `index`. */
  list: readonly unknown[]
  props: EditListItemProps<unknown>
  render: (props: EditListItemProps<unknown>) => ReactNode
}

// A form of the whole list, for the one open item: the form's own row
// registers its fields here as it does on the form, and every change to
// it is the item's draft. A refusal's field errors are set on it, so the
// row shows them where the form would.
function ItemForm({ name, index, list, props, render }: ItemFormProps) {
  const [defaultValues] = useState<FieldValues>(() => ({ [name]: structuredClone(list) }))
  const form = useForm<FieldValues>({ defaultValues })
  const onChange = useRef(props.onChange)
  useEffect(() => {
    onChange.current = props.onChange
  })
  const { subscribe } = form
  useEffect(
    () =>
      subscribe({
        formState: { values: true },
        callback: ({ values }) => {
          const item = (values[name] as unknown[] | undefined)?.[index]
          onChange.current(structuredClone(item))
        },
      }),
    [subscribe, name, index],
  )
  const { errors } = props
  useEffect(() => {
    form.clearErrors()
    for (const [path, message] of Object.entries(errors ?? {})) form.setError(`${name}.${index}.${path}`, { type: 'refused', message })
  }, [form, name, index, errors])
  return <FormProvider {...form}>{render({ ...props, form })}</FormProvider>
}

// The app's own add, as a component of its own: it renders the app's
// control with what it's given, and holds nothing.
function ListAdd({ render, ...props }: EditListAddProps<unknown> & { render: (props: EditListAddProps<unknown>) => ReactNode }) {
  return <div data-list-add-slot="">{render(props)}</div>
}

// The items one ListEditor shows: positions in the whole list, under a
// heading when grouped.
type Run = { key: string | null; heading: string | null; indices: number[] }

function runsOf(edit: EditInPlaceList, items: readonly unknown[]): Run[] {
  const shown = items.map((_, index) => index).filter((index) => !edit.filter || edit.filter(items[index], index))
  const groupBy = edit.groupBy
  if (!groupBy) return [{ key: null, heading: null, indices: shown }]
  const groups = new Map<string, number[]>((groupBy.order ?? []).map((key) => [key, []]))
  for (const index of shown) {
    const key = groupBy.key(items[index])
    groups.set(key, [...(groups.get(key) ?? []), index])
  }
  return [...groups].map(([key, indices]) => ({ key, heading: groupBy.label?.(key) ?? key, indices }))
}

export function EditableList({ label, edit, emptyLabel }: { label: string; edit: EditInPlaceList; emptyLabel?: string }) {
  const store = useContext(EditInPlaceContext)
  if (!store) throw new Error('A list edited in place works inside an <EntityView>, which runs editing in place.')
  const items = edit.value
  const statusId = useId()
  const headingId = useId()
  const [status, setStatus] = useState<{ saving: boolean; inFlight: number; error: string | null }>({ saving: false, inFlight: 0, error: null })

  // The buttons are disabled while a change saves, which drops the caret.
  // Once the list shows the outcome it goes to the first of these buttons
  // (by name) that's there and enabled, else to Add (or the app's add's
  // first button).
  const root = useRef<HTMLDivElement>(null)
  const focusNext = useRef<string[] | null>(null)
  useEffect(() => {
    const names = focusNext.current
    if (status.saving || !names) return
    focusNext.current = null
    const buttons = [...(root.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
    const target = names.map((name) => buttons.find((button) => button.getAttribute('aria-label') === name)).find(Boolean)
    ;(target ?? root.current?.querySelector<HTMLButtonElement>('[data-list-add]:not(:disabled), [data-list-add-slot] button:not(:disabled)'))?.focus()
  }, [items, status.saving])

  // Move, remove, duplicate and the app's own add: save the open field
  // first (if it can't save, it stays and nothing else happens), then the
  // change. An add that lands while a change saves (an upload finishing)
  // still goes: `save` builds on the latest list, and "Saving…" stays
  // until both are done.
  const act = async (change: (current: unknown[]) => unknown[], focusAfter: string[], focusIfRefused: string[], waits = true) => {
    if (waits && status.saving) return false
    const open = store.open
    if (open !== null && !(await store.commit(open))) return false
    setStatus((now) => ({ saving: true, inFlight: now.inFlight + 1, error: null }))
    let error: string | null = null
    try {
      await edit.save(change)
      focusNext.current = focusAfter
    } catch (refused) {
      focusNext.current = focusIfRefused
      error = messageOf(refused)
    }
    setStatus((now) => ({ saving: now.inFlight > 1, inFlight: now.inFlight - 1, error: error ?? now.error }))
    return error === null
  }

  // Grouped or filtered, the rows a ListEditor shows aren't the whole
  // list: a move swaps the item with the next one shown, wherever that is.
  const partial = Boolean(edit.groupBy || edit.filter)

  const move = (from: number, to: number) => {
    const direction = to < from ? 'up' : 'down'
    const other = direction === 'up' ? 'down' : 'up'
    void act(
      (current) => {
        const at = locate(current, items[from], from)
        const target = partial ? locate(current, items[to], to) : at + (to - from)
        if (target < 0 || target >= current.length || target === at) return current
        const next = [...current]
        if (partial) [next[at], next[target]] = [next[target], next[at]]
        else next.splice(target, 0, ...next.splice(at, 1))
        return next
      },
      [`Move ${edit.itemName(to)} ${direction}`, `Move ${edit.itemName(to)} ${other}`],
      [`Move ${edit.itemName(from)} ${direction}`],
    )
  }

  // `shown` is the run the item was removed from: the caret goes to the
  // next one there (one place earlier once this one's gone), else the one before.
  const remove = (index: number, shown: readonly number[]) => {
    const at = shown.indexOf(index)
    const after = shown[at + 1]
    const before = shown[at - 1]
    void act(
      (current) => {
        const found = locate(current, items[index], index)
        return current.filter((_, i) => i !== found)
      },
      [
        ...(after !== undefined ? [`Remove ${edit.itemName(after - 1)}`] : []),
        ...(before !== undefined ? [`Remove ${edit.itemName(before)}`] : []),
      ],
      [`Remove ${edit.itemName(index)}`],
    )
  }

  const duplicate = edit.duplicate
  const copy = (index: number) => {
    if (!duplicate) return
    void act(
      (current) => {
        const at = locate(current, items[index], index)
        const next = [...current]
        next.splice(at + 1, 0, duplicate(current[at]))
        return next
      },
      [`Duplicate ${edit.itemName(index)}`],
      [`Duplicate ${edit.itemName(index)}`],
    )
  }

  const itemForm = Boolean(edit.itemForm)
  if (itemForm && !edit.name) throw new Error('A list edited in place with `itemForm` needs `name`: the list field the form holds.')
  const errorsOnFields = itemForm || Boolean(edit.errorsOnFields)

  // The row, as the app's renderItem draws it: given a form of the list
  // with the draft in it, with `itemForm`.
  const row = (props: EditControlProps<unknown>, index: number, isNew: boolean, group?: string) => {
    const itemProps: EditListItemProps<unknown> = { ...props, index, isNew, ...(group !== undefined ? { group } : {}) }
    if (!itemForm) return <ItemRow>{edit.renderItem(itemProps)}</ItemRow>
    const list = isNew ? [...items, props.value] : items.map((item, i) => (i === index ? props.value : item))
    return (
      <ItemRow>
        <ItemForm name={edit.name!} index={index} list={list} props={itemProps} render={edit.renderItem} />
      </ItemRow>
    )
  }

  // An item, edited as the form's row.
  const itemEdit = (index: number): EditInPlace => ({
    kind: 'text',
    value: items[index],
    control: (props) => row(props, index, false),
    schema: { safeParse: (draft) => checkItem(edit, items, index, draft) },
    save: (item) =>
      edit.save((current) => {
        const at = locate(current, items[index], index)
        return current.map((other, i) => (i === at ? item : other))
      }),
    fieldErrors: (cause) => itemFieldErrors(edit, index, cause),
    errorsOnFields,
  })

  // The app's own add: its items saved at the end, the caret back on it.
  const addItems = (added: unknown[]) =>
    added.length === 0 ? Promise.resolve(true) : act((current) => [...current, ...added], [], [], false)
  const onProblem = (message: string | null) => setStatus((now) => ({ ...now, error: message }))

  // The item being added, at the end of the list (a group's Add puts it
  // in that group: its blank item says which).
  const newItem = edit.newItem
  if (!newItem && !edit.add) throw new Error('A list edited in place needs `newItem` (a blank item to add) or `add` (its own control).')
  const addEdit = (group?: string): EditInPlace => ({
    kind: 'text',
    value: newItem?.(group),
    control: (props) => row(props, items.length, true, group),
    schema: { safeParse: (draft) => checkItem(edit, items, items.length, draft) },
    save: (item) => edit.save((current) => [...current, item]),
    fieldErrors: (cause) => itemFieldErrors(edit, items.length, cause),
    errorsOnFields,
  })

  const addBox = (run: Run, last: boolean) => {
    if (edit.add) {
      // The app's own add is the list's, once, at the end.
      return last ? <ListAdd render={edit.add} add={addItems} items={items} disabled={status.saving} onProblem={onProblem} /> : <></>
    }
    const group = run.key ?? undefined
    return (
      <EditableField
        label={edit.itemName(items.length)}
        edit={addEdit(group)}
        reopenAfterKeyboardSave
        children={null}
        trigger={(start) => (
          <div>
            <Button
              data-list-add=""
              type="button"
              variant="outline"
              size="sm"
              disabled={status.saving}
              onClick={start}
              aria-label={run.heading !== null && edit.addLabel ? `${edit.addLabel} to ${run.heading}` : undefined}
            >
              <PlusIcon />
              {edit.addLabel}
            </Button>
          </div>
        )}
      />
    )
  }

  const runs = runsOf(edit, items)
  const grouped = Boolean(edit.groupBy) && runs.length > 0
  const shownRuns = grouped ? runs : [runs[0] ?? { key: null, heading: null, indices: [] }]

  return (
    <div ref={root} className="flex flex-col gap-2" data-slot="editable-list">
      <div className={grouped ? 'flex flex-col gap-4' : 'contents'}>
        {shownRuns.map((run, at) => {
          const list = (
            <ListEditor
              aria-label={run.heading === null ? label : `${label}: ${run.heading}`}
              items={run.indices.map((index) => ({ id: String(index) }))}
              itemName={(position) => edit.itemName(run.indices[position] ?? items.length)}
              addLabel={edit.addLabel ?? ''}
              emptyText={emptyLabel}
              disabled={status.saving}
              onRemove={(position) => remove(run.indices[position]!, run.indices)}
              onMove={(from, to) => move(run.indices[from]!, run.indices[to]!)}
              onDuplicate={duplicate ? (position) => copy(run.indices[position]!) : undefined}
              renderItem={(position) => {
                const index = run.indices[position]!
                return (
                  <EditableField label={edit.itemName(index)} edit={itemEdit(index)}>
                    {edit.renderShown(items[index], index)}
                  </EditableField>
                )
              }}
              add={addBox(run, at === shownRuns.length - 1)}
            />
          )
          if (!grouped) return <div key="list" className="contents">{list}</div>
          return (
            <div key={run.key} role="group" aria-labelledby={`${headingId}-${at}`} className="flex flex-col gap-2">
              <h3 id={`${headingId}-${at}`} className="type-label text-muted-foreground">
                {run.heading}
              </h3>
              {list}
            </div>
          )
        })}
      </div>
      <span id={statusId} className="type-body">
        {status.saving ? (
          <span role="status" className="inline-flex items-center gap-1.5 type-caption text-muted-foreground">
            <Spinner aria-hidden="true" className="size-3.5" />
            Saving…
          </span>
        ) : (
          status.error && <FieldError className="type-caption">{status.error}</FieldError>
        )}
      </span>
    </div>
  )
}
