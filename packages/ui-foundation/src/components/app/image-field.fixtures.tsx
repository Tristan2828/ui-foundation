import type { Meta, StoryObj } from '@/fixtures/types'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { ImageUpload } from '@/lib/image-file'
import { EntityForm } from './entity-form'
import { ImageField } from './image-field'
import { delayedUpload, failingUpload, SAVED_PHOTO } from './image-upload.fixtures'

// One photo on a record, on the package's form layer (EntityForm,
// react-hook-form, zod), with a fake upload: a delayed store, a refusal
// from the "server", and a size limit. Each form shows the value it would
// save (e2e/image-field.spec.ts; axe in both themes there, in every state,
// and here through e2e/fixtures-visual.spec.ts).

const MB = 1024 * 1024

const schema = z.object({
  name: z.string().min(1, 'Give the plant a name.'),
  photoId: z.string().nullable(),
})
type PlantForm = z.infer<typeof schema>

function PlantPhotoForm({
  title,
  upload,
  maxSize,
  initial,
}: {
  title: string
  upload: ImageUpload
  maxSize?: number
  initial: PlantForm & { photoUrl?: string }
}) {
  const slug = title.toLowerCase().replace(/\W+/g, '-')
  const form = useForm<PlantForm>({ resolver: zodResolver(schema), defaultValues: { name: initial.name, photoId: initial.photoId } })
  const [saved, setSaved] = useState<PlantForm | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <div data-form={slug} className="flex flex-col gap-3">
      <EntityForm
        title={title}
        onSubmit={form.handleSubmit(setSaved)}
        isSubmitting={false}
        submitLabel="Save"
        onCancel={() => form.reset()}
      >
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor={`${slug}-name`}>Name</FieldLabel>
              <Input id={`${slug}-name`} {...field} aria-invalid={fieldState.invalid || undefined} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="photoId"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor={`${slug}-photo`} id={`${slug}-photo-label`}>
                Photo
              </FieldLabel>
              <ImageField
                id={`${slug}-photo`}
                aria-labelledby={`${slug}-photo-label`}
                aria-describedby={`${slug}-photo-hint`}
                value={field.value}
                // The record's saved photo; one uploaded here shows its own thumbnail.
                thumbUrl={field.value === initial.photoId ? initial.photoUrl : null}
                onChange={field.onChange}
                upload={upload}
                maxSize={maxSize}
                invalid={fieldState.invalid}
                onBusyChange={setBusy}
              />
              <FieldDescription id={`${slug}-photo-hint`}>
                JPEG, PNG or WebP{maxSize ? `, up to ${maxSize / MB} MB` : ''}.
              </FieldDescription>
            </Field>
          )}
        />
      </EntityForm>
      <p className="type-caption text-muted-foreground">
        Uploading: <output data-testid={`${slug}-busy`}>{busy ? 'yes' : 'no'}</output> · Saved:{' '}
        <output data-testid={`${slug}-saved`}>{saved ? JSON.stringify(saved) : 'nothing yet'}</output>
      </p>
    </div>
  )
}

const meta: Meta<typeof ImageField> = {
  title: 'app/ImageField',
  component: ImageField,
  parameters: { controls: { disable: true } },
}

export default meta

// An empty field and one with the record's photo; each upload takes 1.2s.
export const Default: StoryObj<typeof ImageField> = {
  render: () => (
    <div className="flex flex-col gap-10">
      <PlantPhotoForm title="New plant" upload={delayedUpload()} initial={{ name: 'Fern', photoId: null }} />
      <PlantPhotoForm
        title="Edit plant"
        upload={delayedUpload()}
        initial={{ name: 'Monstera', photoId: 'file-saved', photoUrl: SAVED_PHOTO }}
      />
    </div>
  ),
}

// What's refused: every upload fails on the "server", and the second
// field takes files up to 1 MB (a bigger one is refused before it's sent).
export const Refusals: StoryObj<typeof ImageField> = {
  render: () => (
    <div className="flex flex-col gap-10">
      <PlantPhotoForm title="Upload fails" upload={failingUpload()} initial={{ name: 'Cactus', photoId: null }} />
      <PlantPhotoForm title="Size limit" upload={delayedUpload()} maxSize={MB} initial={{ name: 'Pothos', photoId: null }} />
    </div>
  ),
}

// Every look at once, for axe and the token check: empty, a photo, one
// whose address doesn't load (the glyph), read-only, and refused by the
// form (`invalid`).
function Looks() {
  const never: ImageUpload = () => new Promise(() => {})
  return (
    <FieldGroup className="max-w-xl">
      {[
        { label: 'Empty', value: null },
        { label: 'With a photo', value: 'a', thumbUrl: SAVED_PHOTO },
        { label: 'Address missing', value: 'b', thumbUrl: null },
        { label: 'Read-only', value: 'c', thumbUrl: SAVED_PHOTO, readOnly: true },
        { label: 'Refused', value: null, invalid: true },
      ].map(({ label, ...props }) => {
        const slug = label.toLowerCase().replace(/\W+/g, '-')
        return (
          <Field key={label} data-invalid={props.invalid || undefined}>
            <FieldLabel htmlFor={slug} id={`${slug}-label`}>
              {label}
            </FieldLabel>
            <ImageField id={slug} aria-labelledby={`${slug}-label`} onChange={() => {}} upload={never} {...props} />
            {props.invalid && <FieldError>Add a photo of the plant.</FieldError>}
          </Field>
        )
      })}
    </FieldGroup>
  )
}

export const AllLooks: StoryObj<typeof ImageField> = { render: () => <Looks /> }
