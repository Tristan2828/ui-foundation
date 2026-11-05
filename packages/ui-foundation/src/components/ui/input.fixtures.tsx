import type { Meta, StoryObj } from '@/fixtures/types'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const meta: Meta<typeof Input> = {
  title: 'ui/Input',
  component: Input,
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number'],
    },
    placeholder: {
      control: 'text',
    },
    disabled: {
      control: 'boolean',
    },
  },
  args: {
    type: 'text',
    placeholder: 'Type here',
    disabled: false,
  },
}

export default meta
type Story = StoryObj<typeof Input>

export const Default: Story = {}

// Fields refused by the server, with what was typed still in them, on a
// card the way a form sits. An invalid Field turns its text the danger
// shade; under a palette the typed value stays foreground, since the
// danger shade measured 4.28:1 on a palette's input fill (4.63.2).
export const InvalidWithValues: Story = {
  render: () => (
    <div className="bg-card p-4 text-card-foreground">
      <FieldGroup>
        <Field data-invalid>
          <FieldLabel htmlFor="invalid-code">Code</FieldLabel>
          <Input id="invalid-code" aria-invalid defaultValue="123456" />
          <FieldError>That code didn't match. Try the newest one.</FieldError>
        </Field>
        <Field data-invalid>
          <FieldLabel htmlFor="invalid-notes">Notes</FieldLabel>
          <Textarea id="invalid-notes" aria-invalid defaultValue="Too long by a few words" />
          <FieldError>Notes are too long.</FieldError>
        </Field>
      </FieldGroup>
    </div>
  ),
}
