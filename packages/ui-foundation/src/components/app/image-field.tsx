// One image on a record (a photo of it): a thumbnail with Replace and
// Remove, or Add photo when there's none. A form control like DateField:
// a react-hook-form `Controller` on the form, its value what the record
// stores, the stored file's id (or null).
//
// The upload is the app's (`upload`, its own storage: the package knows no
// endpoint). A file picked uploads at once; while it does, the buttons
// wait and say so, and the value changes only once it's stored. A file
// the field won't take (its type, its size) is refused before it's sent,
// and why shows under the field, as does a failed upload's reason.
//
// Remove only empties the field; deleting the stored file, if ever, is the
// app's.
import { useEffect, useId, useRef, useState } from 'react'
import { ImageIcon, ImagePlusIcon, RefreshCwIcon, XIcon } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { acceptAttribute, DEFAULT_IMAGE_TYPES, imageRefusal, uploadFailure, type ImageUpload } from '@/lib/image-file'

export type ImageFieldProps = {
  /** The main button's id (Add or Replace), for the field's `<FieldLabel htmlFor>`. */
  id?: string
  /** The stored image's id, as the record keeps it, or null for none. */
  value: string | null
  /**
   * The current image's thumbnail, for a value the field didn't upload
   * itself (the record's saved photo). After an upload the field shows
   * the upload's own `thumbUrl`.
   */
  thumbUrl?: string | null
  /** Called with the new image's id once it's stored, or null when removed. */
  onChange: (id: string | null) => void
  /** Stores one file in the app's storage and resolves to its id and thumbnail. */
  upload: ImageUpload
  /** The image types taken. Defaults to JPEG, PNG and WebP (`DEFAULT_IMAGE_TYPES`). */
  accept?: readonly string[]
  /** The largest file taken, in bytes: a bigger one is refused before it's sent. */
  maxSize?: number
  /** What the image is, in the buttons' words: "Add photo", "Replace photo". Defaults to `'photo'`. */
  noun?: string
  /** The thumbnail's alt text. Defaults to "Current photo" (with `noun`). */
  alt?: string
  /** The value was refused (the form's schema, the server): `aria-invalid` on the main button. */
  invalid?: boolean
  /** Saving: the image shows, nothing can be changed. */
  readOnly?: boolean
  /** Told when an upload starts and ends, so a form can hold its submit meanwhile. */
  onBusyChange?: (busy: boolean) => void
  className?: string
  /** The field's name, on its group of controls: this, or `aria-labelledby` (the label's id). */
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
}

export function ImageField({
  id,
  value,
  thumbUrl,
  onChange,
  upload,
  accept = DEFAULT_IMAGE_TYPES,
  maxSize,
  noun = 'photo',
  alt,
  invalid = false,
  readOnly = false,
  onBusyChange,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}: ImageFieldProps) {
  const ids = useId()
  const errorId = `${ids}-error`
  const input = useRef<HTMLInputElement>(null)
  const main = useRef<HTMLButtonElement>(null)
  const [busy, setBusy] = useState(false)
  // Why the last file picked isn't the field's image.
  const [problem, setProblem] = useState<string | null>(null)
  // What a screen reader hears of an upload: started, done.
  const [status, setStatus] = useState('')
  // The image this field uploaded, so it shows before the record has it.
  const [uploaded, setUploaded] = useState<{ id: string; thumbUrl: string } | null>(null)
  // A thumbnail that didn't load shows as the image glyph instead.
  const [broken, setBroken] = useState<string | null>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const latestBusy = useRef(onBusyChange)
  useEffect(() => {
    latestBusy.current = onBusyChange
  })
  const changeBusy = (next: boolean) => {
    setBusy(next)
    latestBusy.current?.(next)
  }

  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1)
  const src = value === null ? null : uploaded?.id === value ? uploaded.thumbUrl : (thumbUrl ?? null)
  const shown = src !== null && src !== broken ? src : null

  const pick = async (file: File | undefined) => {
    if (!file) return
    const refusal = imageRefusal(file, { accept, maxSize })
    setProblem(refusal)
    if (refusal) return
    changeBusy(true)
    setStatus(`Uploading ${noun}…`)
    try {
      const result = await upload(file)
      if (!mounted.current) return
      setUploaded({ id: result.id, thumbUrl: result.thumbUrl })
      setBroken(null)
      setStatus(`${Noun} added.`)
      onChange(result.id)
    } catch (error) {
      if (!mounted.current) return
      setStatus('')
      setProblem(uploadFailure(error, noun))
    } finally {
      if (mounted.current) changeBusy(false)
    }
  }

  const remove = () => {
    setProblem(null)
    setStatus(`${Noun} removed.`)
    onChange(null)
    // Remove goes with the image: focus stays in the field.
    main.current?.focus()
  }

  const open = () => {
    if (!busy && !readOnly) input.current?.click()
  }

  const describedBy = [ariaDescribedBy, problem ? errorId : undefined].filter(Boolean).join(' ') || undefined
  const mainLabel = busy ? `Uploading ${noun}…` : value !== null ? `Replace ${noun}` : `Add ${noun}`

  return (
    <div
      data-slot="image-field"
      role="group"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-busy={busy || undefined}
      className={cn('flex flex-col gap-2', className)}
    >
      <div className="flex items-center gap-3">
        {value !== null ? (
          <div className="relative size-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
            {shown ? (
              <img src={shown} alt={alt ?? `Current ${noun}`} className="size-full object-cover" onError={() => setBroken(shown)} />
            ) : (
              <div role="img" aria-label={alt ?? `Current ${noun}`} className="flex size-full items-center justify-center text-muted-foreground">
                <ImageIcon aria-hidden="true" className="size-6" />
              </div>
            )}
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                <Spinner aria-hidden="true" className="size-5 text-foreground" />
              </div>
            )}
          </div>
        ) : (
          // The empty tile: the same as Add, for a mouse (the button is
          // the control, so the tile isn't one of its own).
          <div
            aria-hidden="true"
            onClick={open}
            className={cn(
              'flex size-24 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-input text-muted-foreground',
              !busy && !readOnly && 'cursor-pointer hover:bg-muted',
            )}
          >
            {busy ? <Spinner className="size-5" /> : <ImagePlusIcon className="size-6" />}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            ref={main}
            id={id}
            type="button"
            variant="outline"
            size="sm"
            aria-label={mainLabel}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            disabled={busy || readOnly}
            // Keeps focus through an upload, so it's where it was after.
            focusableWhenDisabled
            onClick={open}
          >
            {busy ? (
              <Spinner aria-hidden="true" />
            ) : value !== null ? (
              <RefreshCwIcon aria-hidden="true" />
            ) : (
              <ImagePlusIcon aria-hidden="true" />
            )}
            {busy ? 'Uploading…' : value !== null ? 'Replace' : `Add ${noun}`}
          </Button>
          {value !== null && (
            <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${noun}`} disabled={busy || readOnly} onClick={remove}>
              <XIcon aria-hidden="true" />
              Remove
            </Button>
          )}
        </div>
      </div>
      {problem && (
        <p id={errorId} role="alert" data-slot="image-field-error" className="type-caption text-destructive-text">
          {problem}
        </p>
      )}
      <span role="status" className="sr-only">
        {status}
      </span>
      <input
        ref={input}
        type="file"
        accept={acceptAttribute(accept)}
        hidden
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0]
          // Cleared, so picking the same file again still counts.
          event.target.value = ''
          void pick(file)
        }}
      />
    </div>
  )
}
