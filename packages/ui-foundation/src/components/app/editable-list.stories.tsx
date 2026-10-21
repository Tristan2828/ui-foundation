import type { Meta, StoryObj } from '@storybook/react-vite'
import { useRef, useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { editInPlace } from './edit-in-place'
import { EntityView, type EntityViewSection } from './entity-view'

// A list item's row edited in place (#187): the same `renderItem` lays out
// as in the form's ListEditor row. Checklist's row is a fragment, a done
// box then a Field with the text box (the form's shape); Steps' row is an
// app's own flex row around the same two, which still fills the width.
// e2e/editable-list.spec.ts compares the box and the text box while
// editing and while adding.

type Task = { text: string; done: boolean }

// A list held in state, saved after a short wait like a server would.
function useSavedList(initial: Task[]) {
  const [items, setItems] = useState(initial)
  const latest = useRef(initial)
  const save = (change: (current: Task[]) => Task[]) =>
    new Promise<void>((resolve) =>
      setTimeout(() => {
        latest.current = change(latest.current)
        setItems(latest.current)
        resolve()
      }, 100),
    )
  return { items, save }
}

function taskList(list: ReturnType<typeof useSavedList>, name: string, wrapped: boolean) {
  return editInPlace<Task>({
    kind: 'list',
    value: list.items,
    save: list.save,
    newItem: () => ({ text: '', done: false }),
    itemName: (index) => `${name} ${index + 1}`,
    addLabel: `Add ${name}`,
    renderShown: (task) => <span className={task.done ? 'text-muted-foreground' : undefined}>{task.text}</span>,
    renderItem: ({ value, onChange, disabled, invalid, describedBy, index }) => {
      const parts = (
        <>
          <Checkbox
            className="mt-2.5"
            checked={value.done}
            disabled={disabled}
            aria-label={`${name} ${index + 1} done`}
            onCheckedChange={(done) => onChange({ ...value, done })}
          />
          <Field data-invalid={invalid} className="min-w-0 flex-1">
            <Input
              value={value.text}
              readOnly={disabled}
              aria-invalid={invalid || undefined}
              aria-label={`${name} ${index + 1} text`}
              aria-describedby={describedBy}
              onChange={(event) => onChange({ ...value, text: event.target.value })}
            />
          </Field>
        </>
      )
      // An app that wrapped its row before the list laid it out (#187).
      return wrapped ? <div className="flex items-start gap-2">{parts}</div> : parts
    },
  })
}

function RowsRecord() {
  const checklist = useSavedList([
    { text: 'Book the lift', done: true },
    { text: 'Label the boxes', done: false },
  ])
  const steps = useSavedList([{ text: 'Pack the kitchen', done: false }])
  const sections: EntityViewSection[] = [
    { title: 'Checklist', content: null, emptyLabel: 'No items', edit: taskList(checklist, 'Item', false) },
    { title: 'Steps', content: null, emptyLabel: 'No steps', edit: taskList(steps, 'Step', true) },
  ]
  return <EntityView isLoading={false} back={{ to: '/', label: 'Projects' }} title="Office move" sections={sections} />
}

function RowsInRouter() {
  const [router] = useState(() => createMemoryRouter([{ path: '/', element: <RowsRecord /> }]))
  return <RouterProvider router={router} />
}

const meta: Meta = {
  title: 'app/EditableList',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
}

export default meta

export const ItemRows: StoryObj = { render: () => <RowsInRouter /> }
