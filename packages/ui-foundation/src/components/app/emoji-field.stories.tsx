import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { EmojiField } from './emoji-field'

// An emoji on a form, closed (one chosen, one empty) and open with its
// search and groups. Axe and the token check run both in both themes
// (e2e/storybook-visual.spec.ts); e2e/emoji-field.spec.ts drives it.

function OnAForm({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [chosen, setChosen] = useState('🧘')
  const [empty, setEmpty] = useState('')
  return (
    <FieldGroup className="max-w-sm">
      <Field>
        <FieldLabel htmlFor="routine-emoji">Routine emoji</FieldLabel>
        <EmojiField id="routine-emoji" value={chosen} onChange={setChosen} clearable defaultOpen={defaultOpen} />
        <output data-testid="chosen-value">{chosen || 'empty'}</output>
      </Field>
      <Field>
        <FieldLabel htmlFor="list-emoji">List emoji</FieldLabel>
        <EmojiField id="list-emoji" value={empty} onChange={setEmpty} clearable placeholder="No emoji" />
        <output data-testid="empty-value">{empty || 'empty'}</output>
      </Field>
    </FieldGroup>
  )
}

const meta: Meta = {
  title: 'app/EmojiField',
  parameters: { controls: { disable: true } },
}

export default meta

export const Default: StoryObj = { render: () => <OnAForm /> }

export const Open: StoryObj = { render: () => <OnAForm defaultOpen /> }
