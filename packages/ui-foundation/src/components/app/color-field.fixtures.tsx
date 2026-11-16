import type { Meta, StoryObj } from '@/fixtures/types'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { storedColor } from '@/lib/stored-color'
import { ColorField } from './color-field'

// ColorField, a stored colour on a form, on a card (where a form sits), in
// a real browser: axe, the token check (the swatch fills are the one colour
// exempt), each swatch's ring and the picker's edge at 3:1, and the
// default colours against the card, in light, dark and every palette
// (e2e/fixtures-visual.spec.ts). e2e/color-field.spec.ts drives it.
// - Default: a named colour, a hex that's none of them (Custom, stored
//   uppercase and without its #), and a required one left empty, with
//   react-hook-form's Controller; Save shows the values out.
// - OwnColors: an app's own list of named colours.
// - Invalid: a refused value, its message under it.

type Colours = { label: string; calendar: string; tag: string }

function OnAForm() {
  const form = useForm<Colours>({ defaultValues: { label: '#2563eb', calendar: 'C0FFEE', tag: '' } })
  const values = useWatch({ control: form.control })
  const { errors } = form.formState
  return (
    <Card className="max-w-xl">
      <CardContent>
        <form onSubmit={form.handleSubmit(() => {})} noValidate>
          <FieldGroup>
            {(['label', 'calendar', 'tag'] as const).map((name) => {
              const title = { label: 'Label Colour', calendar: 'Calendar Colour', tag: 'Tag Colour' }[name]
              return (
                <Field key={name} data-invalid={!!errors[name] || undefined}>
                  <FieldLabel id={`${name}-colour-label`} htmlFor={`${name}-colour`} required={name === 'tag'}>
                    {title}
                  </FieldLabel>
                  <Controller
                    control={form.control}
                    name={name}
                    rules={name === 'tag' ? { validate: (value) => !!storedColor(value) || 'Pick a colour for the tag' } : undefined}
                    render={({ field, fieldState }) => (
                      <ColorField
                        id={`${name}-colour`}
                        aria-labelledby={`${name}-colour-label`}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        invalid={fieldState.invalid}
                      />
                    )}
                  />
                  <FieldError errors={[errors[name]]} />
                </Field>
              )
            })}
            <Button type="submit" className="w-fit">Save Colours</Button>
            <output data-testid="values" className="type-caption text-muted-foreground">
              {values.label || 'empty'} · {values.calendar || 'empty'} · {values.tag || 'empty'}
            </output>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

const PAINTS = [
  { name: 'Hale Navy', color: '#434c56' },
  { name: 'Simply White', color: '#f2f1e7' },
  { name: 'Sage', color: '#9caf88' },
  { name: 'Terracotta', color: '#c66b3d' },
]

function OwnColorsForm() {
  const form = useForm({ defaultValues: { paint: '#9CAF88' } })
  const paint = useWatch({ control: form.control, name: 'paint' })
  return (
    <Card className="max-w-xl">
      <CardContent>
        <Field>
          <FieldLabel id="paint-label" htmlFor="paint">Wall Paint</FieldLabel>
          <Controller
            control={form.control}
            name="paint"
            render={({ field }) => (
              <ColorField id="paint" aria-labelledby="paint-label" colors={PAINTS} value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
            )}
          />
          <output data-testid="paint-value" className="type-caption text-muted-foreground">{paint}</output>
        </Field>
      </CardContent>
    </Card>
  )
}

function InvalidForm() {
  return (
    <Card className="max-w-xl">
      <CardContent>
        <Field data-invalid>
          <FieldLabel id="refused-label" htmlFor="refused">Label Colour</FieldLabel>
          <ColorField id="refused" aria-labelledby="refused-label" value="#000" onChange={() => {}} invalid aria-describedby="refused-error" />
          <FieldError id="refused-error">That colour is taken by another label</FieldError>
        </Field>
      </CardContent>
    </Card>
  )
}

const meta: Meta = {
  title: 'app/ColorField',
  parameters: { controls: { disable: true } },
}

export default meta

export const Default: StoryObj = { render: () => <OnAForm /> }

export const OwnColors: StoryObj = { render: () => <OwnColorsForm /> }

export const Invalid: StoryObj = { render: () => <InvalidForm /> }
