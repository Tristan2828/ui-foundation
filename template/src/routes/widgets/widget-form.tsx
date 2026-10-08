// The widget form. Handles both create (/widgets/new) and edit
// (/widgets/:id/edit) — a thin consumer of the EntityForm composite. Table,
// view and form are the copy-this-file reference for the entity playbook
// (docs/foundation/add-an-entity.md).
//
// Every way out lands on a view: saving an edit, or cancelling one, goes
// back to the widget's view, and creating opens the new widget's view.
// Cancelling a create, with no widget to show, goes back to the list. Each
// replaces the form's history entry, so Back from the view returns to
// where the user came from, not to the form they just left.
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { type AppError, EntityForm, ErrorState, ListEditor, MultiChoice } from '@tristan2828/ui-foundation'
import { Button } from '@tristan2828/ui-foundation/ui/button'
import { Calendar } from '@tristan2828/ui-foundation/ui/calendar'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@tristan2828/ui-foundation/ui/combobox'
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from '@tristan2828/ui-foundation/ui/field'
import { Input } from '@tristan2828/ui-foundation/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@tristan2828/ui-foundation/ui/popover'
import { Skeleton } from '@tristan2828/ui-foundation/ui/skeleton'
import { Switch } from '@tristan2828/ui-foundation/ui/switch'
import type { components } from '@/api/schema'
import { useWidgetCategoriesQuery } from './use-widget-categories'
import { useCreateWidgetMutation, useUpdateWidgetMutation, useWidgetQuery } from './use-widgets'
import {
  WidgetChecklistItemFields,
  WidgetDescriptionEditor,
  WidgetExtraCategoriesPicker,
  WidgetNameInput,
  WidgetPriceInput,
  WidgetStatusSelect,
} from './widget-fields'
import {
  WIDGET_FORM_DEFAULTS,
  WIDGET_TAGS,
  WIDGET_TAG_LABELS,
  formValuesToWidgetCreate,
  formValuesToWidgetUpdate,
  widgetFormSchema,
  widgetToFormValues,
  type WidgetFormValues,
} from './widget-schema'

type Widget = components['schemas']['Widget']

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
  const categoriesQuery = useWidgetCategoriesQuery(categorySearch)
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

  // Sub-records: the items live in the form's own state and save with the
  // widget. useFieldArray's `fields` carry the stable keys ListEditor needs.
  const checklist = useFieldArray({ control: form.control, name: 'checklist' })

  if (isEdit && widgetQuery.isLoading) {
    return <WidgetFormSkeleton />
  }

  if (isEdit && widgetQuery.error) {
    return <ErrorState error={widgetQuery.error} onRetry={() => widgetQuery.refetch()} />
  }

  const isSubmitting = createWidget.isPending || updateWidget.isPending

  const onSubmit = form.handleSubmit((values) => {
    setSubmitError(null)

    const onSuccess = (widget: Widget) => {
      toast.success(isEdit ? 'Widget updated' : 'Widget created')
      navigate(`/widgets/${widget.id}`, { replace: true })
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
      onCancel={() => navigate(isEdit ? `/widgets/${widgetId}` : '/widgets', { replace: true })}
    >
      {/* Name, Status, Price, Description and Extra Categories use the
          controls in widget-fields.tsx, the same ones the view edits in
          place with. */}
      <Field data-invalid={!!form.formState.errors.name}>
        <FieldLabel htmlFor="widget-name">Name</FieldLabel>
        <Controller
          control={form.control}
          name="name"
          render={({ field }) => (
            <WidgetNameInput
              id="widget-name"
              value={field.value}
              onChange={field.onChange}
              invalid={!!form.formState.errors.name}
            />
          )}
        />
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
            <WidgetStatusSelect
              id="widget-status"
              value={field.value}
              onChange={field.onChange}
              invalid={!!form.formState.errors.status}
            />
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
        <Controller
          control={form.control}
          name="price"
          render={({ field }) => (
            <WidgetPriceInput
              id="widget-price"
              value={field.value}
              onChange={field.onChange}
              invalid={!!form.formState.errors.price}
            />
          )}
        />
        <FieldError errors={[form.formState.errors.price]} />
      </Field>

      <Field data-invalid={!!form.formState.errors.description}>
        {/* A rich-text area is no <input>: the label names it by id. */}
        <FieldLabel id="widget-description-label" htmlFor="widget-description">
          Description
        </FieldLabel>
        <Controller
          control={form.control}
          name="description"
          render={({ field }) => (
            <WidgetDescriptionEditor
              id="widget-description"
              aria-labelledby="widget-description-label"
              value={field.value}
              onChange={field.onChange}
              invalid={!!form.formState.errors.description}
            />
          )}
        />
        <FieldError errors={[form.formState.errors.description]} />
      </Field>

      <Field data-invalid={!!form.formState.errors.tags}>
        <FieldLabel htmlFor="widget-tags">Tags</FieldLabel>
        <Controller
          control={form.control}
          name="tags"
          render={({ field }) => (
            <MultiChoice
              id="widget-tags"
              options={WIDGET_TAGS}
              getLabel={(tag) => WIDGET_TAG_LABELS[tag]}
              value={field.value}
              onValueChange={field.onChange}
              placeholder="Add tags"
              aria-invalid={!!form.formState.errors.tags}
            />
          )}
        />
        <FieldError errors={[form.formState.errors.tags]} />
      </Field>

      <Field data-invalid={!!form.formState.errors.extraCategoryIds}>
        <FieldLabel htmlFor="widget-extra-categories">Extra Categories (optional)</FieldLabel>
        <Controller
          control={form.control}
          name="extraCategoryIds"
          render={({ field }) => (
            <WidgetExtraCategoriesPicker
              id="widget-extra-categories"
              value={field.value}
              onChange={field.onChange}
              invalid={!!form.formState.errors.extraCategoryIds}
            />
          )}
        />
        <FieldError errors={[form.formState.errors.extraCategoryIds]} />
      </Field>

      {/* Sub-records: a fieldset, since the legend names a group of inputs
          rather than one. Each row's controls are named by position
          ("Item 2 text"), which is also how the row buttons name it. */}
      <FieldSet>
        <FieldLegend variant="label">Checklist (optional)</FieldLegend>
        <ListEditor
          aria-label="Checklist"
          items={checklist.fields}
          itemName={(index) => `item ${index + 1}`}
          addLabel="Add item"
          emptyText="No items yet."
          max={50}
          onAdd={() => checklist.append({ text: '', done: false })}
          onRemove={checklist.remove}
          onMove={checklist.move}
          renderItem={(index) => {
            const error = form.formState.errors.checklist?.[index]?.text
            return (
              <Controller
                control={form.control}
                name={`checklist.${index}.done`}
                render={({ field }) => (
                  <WidgetChecklistItemFields
                    index={index}
                    done={field.value}
                    onDoneChange={field.onChange}
                    invalid={!!error}
                    textProps={form.register(`checklist.${index}.text`)}
                    error={<FieldError errors={[error]} />}
                  />
                )}
              />
            )
          }}
        />
        <FieldError errors={[form.formState.errors.checklist?.root ?? form.formState.errors.checklist]} />
      </FieldSet>

      {/* Yes/no: a Switch with its label beside it (Field orientation
          "horizontal"), never a Select of Yes/No. The label is the
          question; the switch is the answer. */}
      <Field orientation="horizontal" data-invalid={!!form.formState.errors.inStock}>
        <Controller
          control={form.control}
          name="inStock"
          render={({ field }) => (
            <Switch
              id="widget-in-stock"
              checked={field.value}
              onCheckedChange={field.onChange}
              aria-invalid={!!form.formState.errors.inStock}
            />
          )}
        />
        <FieldLabel htmlFor="widget-in-stock">In Stock</FieldLabel>
        <FieldError errors={[form.formState.errors.inStock]} />
      </Field>
    </EntityForm>
  )
}
