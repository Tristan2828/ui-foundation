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
//   opens the next, so a run of items goes in from the keyboard.
// - Move and remove save at once. Whatever is open is saved first; while
//   the change saves, the buttons wait, "Saving…" shows under the list,
//   and a refusal leaves the list as it was with the reason under it.
// - Every change is one save of the whole list, built from the record's
//   latest list when it's sent (`save` takes a change, not a list), so it
//   never undoes a tick or another change still saving.
import { PlusIcon } from 'lucide-react'
import { useContext, useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { EditInPlaceContext, type EditInPlace, type EditInPlaceList } from './edit-in-place'
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

type Parsed = { success: true; data: unknown } | { success: false; error: { issues: readonly { message: string }[] } }

// The list's schema, run on the list this draft would make. A message
// about this item comes first, then one about the list as a whole (too
// many items).
function checkItem(edit: EditInPlaceList, items: readonly unknown[], index: number, draft: unknown): Parsed {
  if (!edit.schema) return { success: true, data: draft }
  const list = index < items.length ? items.map((item, i) => (i === index ? draft : item)) : [...items, draft]
  const result = edit.schema.safeParse(list)
  if (result.success) return { success: true, data: result.data[index] }
  const { issues } = result.error
  const issue = issues.find(({ path }) => path?.[0] === index) ?? issues.find(({ path }) => !path?.length) ?? issues[0]
  return { success: false, error: { issues: issue ? [issue] : [] } }
}

export function EditableList({ label, edit, emptyLabel }: { label: string; edit: EditInPlaceList; emptyLabel?: string }) {
  const store = useContext(EditInPlaceContext)
  if (!store) throw new Error('A list edited in place works inside an <EntityView>, which runs editing in place.')
  const items = edit.value
  const statusId = useId()
  const [status, setStatus] = useState<{ saving: boolean; error: string | null }>({ saving: false, error: null })

  // The buttons are disabled while a change saves, which drops the caret.
  // Once the list shows the outcome it goes to the first of these buttons
  // (by name) that's there and enabled, else to Add.
  const root = useRef<HTMLDivElement>(null)
  const focusNext = useRef<string[] | null>(null)
  useEffect(() => {
    const names = focusNext.current
    if (status.saving || !names) return
    focusNext.current = null
    const buttons = [...(root.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
    const target = names.map((name) => buttons.find((button) => button.getAttribute('aria-label') === name)).find(Boolean)
    ;(target ?? root.current?.querySelector<HTMLButtonElement>('[data-list-add]:not(:disabled)'))?.focus()
  }, [items, status.saving])

  // Move and remove: save the open field first (if it can't save, it stays
  // and nothing else happens), then the change.
  const act = async (change: (current: unknown[]) => unknown[], focusAfter: string[], focusIfRefused: string[]) => {
    if (status.saving) return
    const open = store.open
    if (open !== null && !(await store.commit(open))) return
    setStatus({ saving: true, error: null })
    try {
      await edit.save(change)
      focusNext.current = focusAfter
      setStatus({ saving: false, error: null })
    } catch (error) {
      focusNext.current = focusIfRefused
      setStatus({ saving: false, error: messageOf(error) })
    }
  }

  const move = (from: number, to: number) => {
    const direction = to < from ? 'up' : 'down'
    const other = direction === 'up' ? 'down' : 'up'
    void act(
      (current) => {
        const at = locate(current, items[from], from)
        const target = at + (to - from)
        if (target < 0 || target >= current.length) return current
        const next = [...current]
        next.splice(target, 0, ...next.splice(at, 1))
        return next
      },
      [`Move ${edit.itemName(to)} ${direction}`, `Move ${edit.itemName(to)} ${other}`],
      [`Move ${edit.itemName(from)} ${direction}`],
    )
  }

  const remove = (index: number) =>
    void act(
      (current) => {
        const at = locate(current, items[index], index)
        return current.filter((_, i) => i !== at)
      },
      [`Remove ${edit.itemName(index)}`, `Remove ${edit.itemName(index - 1)}`],
      [`Remove ${edit.itemName(index)}`],
    )

  // An item, edited as the form's row.
  const itemEdit = (index: number): EditInPlace => ({
    kind: 'text',
    value: items[index],
    control: (props) => edit.renderItem({ ...props, index, isNew: false }),
    schema: { safeParse: (draft) => checkItem(edit, items, index, draft) },
    save: (item) =>
      edit.save((current) => {
        const at = locate(current, items[index], index)
        return current.map((other, i) => (i === at ? item : other))
      }),
  })

  // The item being added, at the end.
  const addEdit: EditInPlace = {
    kind: 'text',
    value: edit.newItem(),
    control: (props) => edit.renderItem({ ...props, index: items.length, isNew: true }),
    schema: { safeParse: (draft) => checkItem(edit, items, items.length, draft) },
    save: (item) => edit.save((current) => [...current, item]),
  }

  return (
    <div ref={root} className="flex flex-col gap-2" data-slot="editable-list">
      <ListEditor
        aria-label={label}
        items={items.map((_, index) => ({ id: String(index) }))}
        itemName={edit.itemName}
        addLabel={edit.addLabel}
        emptyText={emptyLabel}
        disabled={status.saving}
        onRemove={remove}
        onMove={move}
        renderItem={(index) => (
          <EditableField label={edit.itemName(index)} edit={itemEdit(index)}>
            {edit.renderShown(items[index], index)}
          </EditableField>
        )}
        add={
          <EditableField
            label={edit.itemName(items.length)}
            edit={addEdit}
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
                >
                  <PlusIcon />
                  {edit.addLabel}
                </Button>
              </div>
            )}
          />
        }
      />
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
