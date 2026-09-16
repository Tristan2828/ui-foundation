// Screen B (docs/BUILD-PLAN.md Phase 4). Handles both create (/widgets/new)
// and edit (/widgets/:id/edit) — a thin consumer of the EntityForm
// composite. Table + form are Phase 6's copy-this-file reference for the
// entity playbook.
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import type { AppError } from '@/api/contracts'
import { EntityForm } from '@/components/app/entity-form'
import { ErrorState } from '@/components/app/error-state'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useCategoriesQuery } from './use-categories'
import { useCreateWidgetMutation, useUpdateWidgetMutation, useWidgetQuery } from './use-widgets'
import {
  WIDGET_FORM_DEFAULTS,
  WIDGET_STATUSES,
  formValuesToWidgetCreate,
  formValuesToWidgetUpdate,
  widgetFormSchema,
  widgetToFormValues,
  type WidgetFormValues,
} from './widget-schema'

const pickerDateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

function WidgetFormSkeleton() {
  return (
    <div className="flex max-w-xl flex-col gap-6" data-state="loading">
      <Skeleton className="h-6 w-40" />
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  )
}

export function WidgetFormRoute() {
  const params = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const isEdit = params.id !== undefined
  const widgetId = isEdit ? Number(params.id) : Number.NaN

  const widgetQuery = useWidgetQuery(widgetId, { enabled: isEdit })
  const createWidget = useCreateWidgetMutation()
  const updateWidget = useUpdateWidgetMutation(widgetId)

  const [categorySearch, setCategorySearch] = useState('')
  const categoriesQuery = useCategoriesQuery(categorySearch)
  const categoriesById = useMemo(() => {
    const entries = (categoriesQuery.data ?? []).map((c) => [c.id, c.name] as const)
    return Object.fromEntries(entries) as Record<number, string>
  }, [categoriesQuery.data])

  const [submitError, setSubmitError] = useState<AppError | null>(null)

  const form = useForm<WidgetFormValues>({
    resolver: zodResolver(widgetFormSchema),
    defaultValues: WIDGET_FORM_DEFAULTS,
    // RHF's documented alternative to resetting inside a useEffect: `values`
    // re-syncs the form whenever the prop changes, once the edit-mode fetch
    // resolves.
    values: isEdit && widgetQuery.data ? widgetToFormValues(widgetQuery.data) : undefined,
  })

  if (isEdit && widgetQuery.isLoading) {
    return <WidgetFormSkeleton />
  }

  if (isEdit && widgetQuery.error) {
    return <ErrorState error={widgetQuery.error} onRetry={() => widgetQuery.refetch()} />
  }

  const isSubmitting = createWidget.isPending || updateWidget.isPending

  const onSubmit = form.handleSubmit((values) => {
    setSubmitError(null)

    const onSuccess = () => {
      toast.success(isEdit ? 'Widget updated' : 'Widget created')
      navigate('/widgets')
    }
    const onError = (error: AppError) => {
      if (error.kind === 'validation' && error.fieldErrors) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          form.setError(field as keyof WidgetFormValues, { message: messages[0] })
        }
      } else {
        setSubmitError(error)
      }
    }

    if (isEdit) {
      updateWidget.mutate(formValuesToWidgetUpdate(values), { onSuccess, onError })
    } else {
      createWidget.mutate(formValuesToWidgetCreate(values), { onSuccess, onError })
    }
  })

  return (
    <EntityForm
      title={isEdit ? 'Edit Widget' : 'New Widget'}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      submitError={submitError}
      submitLabel={isEdit ? 'Save changes' : 'Create widget'}
      onCancel={() => navigate('/widgets')}
    >
      <Field data-invalid={!!form.formState.errors.name}>
        <FieldLabel htmlFor="widget-name">Name</FieldLabel>
        <Input id="widget-name" aria-invalid={!!form.formState.errors.name} {...form.register('name')} />
        <FieldError errors={[form.formState.errors.name]} />
      </Field>

      <Field data-invalid={!!form.formState.errors.categoryId}>
        <FieldLabel htmlFor="widget-category">Category</FieldLabel>
        <Controller
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <Combobox
              // `items` must carry the same shape as `value` (a plain
              // category id), not the raw Category objects — Base UI's
              // default isItemEqualToValue is Object.is(item, value), so
              // handing it {id,name} objects can never match a numeric
              // value and itemToStringLabel is never invoked, leaving the
              // input blank even when a category IS selected (only visible
              // in edit mode, where a value arrives pre-set instead of
              // through a user pick).
              items={(categoriesQuery.data ?? []).map((category) => category.id)}
              // Base UI decides controlled-vs-uncontrolled from whether
              // `value` is `undefined` on the FIRST render, not on every
              // render — the schema's default (no category chosen yet)
              // starts as `undefined`, so without this coalesce, selecting
              // a category flips the combobox from uncontrolled to
              // controlled mid-lifecycle and Base UI logs a warning. `null`
              // is a defined "nothing selected" value the field never had.
              value={field.value ?? null}
              onValueChange={(value) => field.onChange(value)}
              // Deliberately uncontrolled: only listening via
              // onInputValueChange (to drive the server-side search query),
              // not also feeding categorySearch back in as `inputValue`.
              // Controlling inputValue makes it the single source of truth
              // for the box's displayed text, and it only ever changes via
              // this callback — so a categoryId set from outside (editing an
              // existing widget, never typed by the user) has no path to
              // ever populate it, and the box shows blank forever despite a
              // real selection. Left uncontrolled, Base UI resolves the
              // displayed text itself from value + itemToStringLabel,
              // including on first render.
              onInputValueChange={setCategorySearch}
              itemToStringLabel={(id: number) => categoriesById[id] ?? ''}
              filter={null}
            >
              <ComboboxInput
                id="widget-category"
                aria-invalid={!!form.formState.errors.categoryId}
                placeholder="Search categories"
              />
              <ComboboxContent>
                <ComboboxEmpty>No categories found.</ComboboxEmpty>
                <ComboboxList>
                  {(categoriesQuery.data ?? []).map((category) => (
                    <ComboboxItem key={category.id} value={category.id}>
                      {category.name}
                    </ComboboxItem>
                  ))}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          )}
        />
        <FieldError errors={[form.formState.errors.categoryId]} />
      </Field>

      <Field data-invalid={!!form.formState.errors.status}>
        <FieldLabel htmlFor="widget-status">Status</FieldLabel>
        <Controller
          control={form.control}
          name="status"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="widget-status" aria-invalid={!!form.formState.errors.status}>
                <SelectValue placeholder="Select a status" />
              </SelectTrigger>
              <SelectContent>
                {WIDGET_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError errors={[form.formState.errors.status]} />
      </Field>

      <Field data-invalid={!!form.formState.errors.availableFrom}>
        <FieldLabel htmlFor="widget-available-from">Available From</FieldLabel>
        <Controller
          control={form.control}
          name="availableFrom"
          render={({ field }) => (
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    id="widget-available-from"
                    type="button"
                    variant="outline"
                    aria-invalid={!!form.formState.errors.availableFrom}
                    className="w-full justify-start font-normal"
                  />
                }
              >
                <CalendarIcon className="size-4" />
                {field.value ? pickerDateFormatter.format(field.value) : 'Pick a date'}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={field.value} onSelect={field.onChange} />
              </PopoverContent>
            </Popover>
          )}
        />
        <FieldError errors={[form.formState.errors.availableFrom]} />
      </Field>

      <Field data-invalid={!!form.formState.errors.assigneeEmail}>
        <FieldLabel htmlFor="widget-assignee">Assignee Email (optional)</FieldLabel>
        <Input
          id="widget-assignee"
          type="email"
          aria-invalid={!!form.formState.errors.assigneeEmail}
          {...form.register('assigneeEmail')}
        />
        <FieldError errors={[form.formState.errors.assigneeEmail]} />
      </Field>

      <Field data-invalid={!!form.formState.errors.price}>
        <FieldLabel htmlFor="widget-price">Price</FieldLabel>
        <Input
          id="widget-price"
          inputMode="decimal"
          placeholder="19.99"
          aria-invalid={!!form.formState.errors.price}
          {...form.register('price')}
        />
        <FieldError errors={[form.formState.errors.price]} />
      </Field>

      <Field data-invalid={!!form.formState.errors.description}>
        <FieldLabel htmlFor="widget-description">Description</FieldLabel>
        <Textarea
          id="widget-description"
          aria-invalid={!!form.formState.errors.description}
          {...form.register('description')}
        />
        <FieldError errors={[form.formState.errors.description]} />
      </Field>
    </EntityForm>
  )
}
