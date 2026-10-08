// The widget view (/widgets/:id): one widget laid out to read, opened from
// the table by clicking its name. A thin consumer of the foundation's
// EntityView composite, which owns the loading, not-found and error
// states; this file owns what each section shows. Edit and Delete live in
// its header. Table, view and form are the copy-this-file reference for
// the entity playbook (docs/foundation/add-an-entity.md).
//
// Every value renders the way the table's cell renders it (the shared
// lookups are in widget-format.ts), and every optional one passes its
// empty value through as it is: EntityView shows the plan's "not set"
// label for it, never a blank.
//
// The plan's layout is `rail`: Details, the short label/value section, sits
// in a column on the right that stays in view; Description and Checklist,
// the long ones, fill the main column. An entity whose plan names no
// layout drops `layout` and every `placement` (one column).
//
// Read-only, except what the plan names:
// - Editing in place (cell pattern 18): Name (the title), Status (its
//   header badge), Price, Description (rich text) and Extra Categories
//   turn into the form's own control (widget-fields.tsx) where they're
//   shown, and save when you leave them. Not optimistic: "Saving…" until
//   the server agrees; a refusal stays open with its reason.
// - The checklist, a list edited in place (editInPlace's `list` kind): an
//   item is added at the end (Enter adds the next), its text edited where
//   it's shown, moved and removed with the form's own buttons. Each change
//   saves the whole list, built on the latest one.
// - Quick actions (widget-quick-actions.tsx, cell pattern 17): In Stock
//   flips from the header and checklist items tick in place.
// Anything else goes through Edit.
import { PencilIcon } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  EditableValue,
  EntityView,
  Markdown,
  editInPlace,
  type EditInPlace,
  type EditInPlaceList,
  type EntityViewSection,
} from '@tristan2828/ui-foundation'
import { Badge } from '@tristan2828/ui-foundation/ui/badge'
import { Button } from '@tristan2828/ui-foundation/ui/button'
import type { components } from '@/api/schema'
import { CategoryName } from './category-names'
import { CategoryNamesContext } from './category-names-context'
import { DeleteWidgetAction } from './delete-widget-action'
import { useWidgetCategoriesByIdsQuery, widgetCategoryNames } from './use-widget-categories'
import { useEditWidgetField, useWidgetQuery } from './use-widgets'
import {
  WidgetChecklistItemFields,
  WidgetDescriptionEditor,
  WidgetExtraCategoriesPicker,
  WidgetNameInput,
  WidgetPriceInput,
  WidgetStatusSelect,
} from './widget-fields'
import { CHECKLIST_STATE_BADGE_VARIANT, STATUS_BADGE_VARIANT, dateFormatter, priceFormatter } from './widget-format'
import { ChecklistDoneCount, ChecklistItem, WidgetInStockSwitch } from './widget-quick-actions'
import { CHECKLIST_STATE_LABELS, WIDGET_STATUS_LABELS, WIDGET_TAG_LABELS, widgetFormSchema } from './widget-schema'

type Widget = components['schemas']['Widget']
type WidgetUpdate = components['schemas']['WidgetUpdate']

type WidgetEdits = Record<'name' | 'status' | 'price' | 'description' | 'extraCategoryIds', EditInPlace> & {
  checklist: EditInPlaceList
}
type ChecklistItemValue = Widget['checklist'][number]

const sameIds = (a: number[], b: number[]) => [...a].sort().join() === [...b].sort().join()

// The plan's "Edit in place" fields: each one's form control
// (widget-fields.tsx), its rule from the form's schema, and the save, a
// PATCH of that one field. A list's save takes a change and applies it to
// the latest list (`saveChange`), so it builds on a tick still saving.
function widgetEdits(
  widget: Widget,
  save: (update: WidgetUpdate) => Promise<unknown>,
  saveChange: (change: (widget: Widget) => WidgetUpdate) => Promise<unknown>,
): WidgetEdits {
  const rules = widgetFormSchema.shape
  return {
    name: editInPlace({
      kind: 'text',
      value: widget.name,
      schema: rules.name,
      save: (name) => save({ name }),
      control: (props) => (
        <WidgetNameInput
          id={props.id}
          value={props.value}
          onChange={props.onChange}
          invalid={props.invalid}
          readOnly={props.disabled}
          aria-label={props.label}
          aria-describedby={props.describedBy}
        />
      ),
    }),
    // A choice: its list opens with the field, and a pick saves.
    status: editInPlace({
      kind: 'choice',
      value: widget.status,
      schema: rules.status,
      save: (status) => save({ status }),
      control: (props) => (
        <WidgetStatusSelect
          id={props.id}
          value={props.value}
          onChange={(status) => props.commit(status)}
          invalid={props.invalid}
          readOnly={props.disabled}
          defaultOpen
          modal={false}
          onOpenChange={(open) => {
            if (!open) props.cancel()
          }}
          aria-label={props.label}
          aria-describedby={props.describedBy}
        />
      ),
    }),
    price: editInPlace({
      kind: 'text',
      value: widget.price,
      schema: rules.price,
      save: (price) => save({ price }),
      control: (props) => (
        <WidgetPriceInput
          id={props.id}
          value={props.value}
          onChange={props.onChange}
          invalid={props.invalid}
          readOnly={props.disabled}
          aria-label={props.label}
          aria-describedby={props.describedBy}
        />
      ),
    }),
    // Long text, as rich text: Ctrl/Cmd+Enter saves, Enter is a new line.
    description: editInPlace({
      kind: 'long-text',
      value: widget.description,
      schema: rules.description,
      save: (description) => save({ description }),
      control: (props) => (
        <WidgetDescriptionEditor
          id={props.id}
          value={props.value}
          onChange={props.onChange}
          onProblem={props.onProblem}
          invalid={props.invalid}
          readOnly={props.disabled}
          autoFocus
          aria-label={props.label}
          aria-describedby={props.describedBy}
        />
      ),
    }),
    // Several picks: Enter picks, leaving saves. The server keeps ids in
    // ascending order, so order alone isn't a change.
    extraCategoryIds: editInPlace({
      kind: 'multi',
      value: widget.extraCategoryIds,
      schema: rules.extraCategoryIds,
      isEqual: sameIds,
      save: (extraCategoryIds) => save({ extraCategoryIds }),
      control: (props) => (
        <WidgetExtraCategoriesPicker
          id={props.id}
          value={props.value}
          onChange={props.onChange}
          invalid={props.invalid}
          readOnly={props.disabled}
          aria-label={props.label}
          aria-describedby={props.describedBy}
        />
      ),
    }),
    // Sub-records: the form's own row for each item (and the one being
    // added), the form's rules for the list, ticking still a quick action.
    checklist: editInPlace<ChecklistItemValue>({
      kind: 'list',
      value: widget.checklist,
      schema: rules.checklist,
      save: (change) => saveChange((current) => ({ checklist: change(current.checklist) })),
      newItem: () => ({ text: '', done: false }),
      itemName: (index) => `item ${index + 1}`,
      addLabel: 'Add item',
      renderShown: (_item, index) => <ChecklistItem widget={widget} index={index} />,
      renderItem: (props) => (
        <WidgetChecklistItemFields
          index={props.index}
          done={props.value.done}
          onDoneChange={(done) => props.onChange({ ...props.value, done })}
          invalid={props.invalid}
          readOnly={props.disabled}
          textProps={{
            id: props.id,
            value: props.value.text,
            onChange: (event) => props.onChange({ ...props.value, text: event.target.value }),
            'aria-describedby': props.describedBy,
          }}
        />
      ),
    }),
  }
}

// The plan's "View screen" section, in order. Labels match the form's.
function widgetSections(widget: Widget, edits: WidgetEdits): EntityViewSection[] {
  return [
    {
      title: 'Details',
      placement: 'rail',
      fields: [
        // A reference shows the linked record's name. WidgetCategory has no
        // view of its own, so it's plain text; a referenced entity that has
        // one links to it: <Link to={`/<other>/${id}`}>.
        { label: 'Category', value: <CategoryName id={widget.categoryId} /> },
        {
          label: 'Extra Categories',
          emptyLabel: 'No extra categories',
          edit: edits.extraCategoryIds,
          value: widget.extraCategoryIds.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {widget.extraCategoryIds.map((id) => (
                <Badge key={id} variant="outline">
                  <CategoryName id={id} />
                </Badge>
              ))}
            </div>
          ),
        },
        {
          label: 'Tags',
          emptyLabel: 'Untagged',
          value: widget.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {widget.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {WIDGET_TAG_LABELS[tag]}
                </Badge>
              ))}
            </div>
          ),
        },
        { label: 'Available From', value: dateFormatter.format(new Date(widget.availableFrom)) },
        {
          label: 'Price',
          edit: edits.price,
          value: <span className="tabular-nums">{priceFormatter.format(Number(widget.price))}</span>,
        },
        { label: 'Assignee Email', emptyLabel: 'Unassigned', value: widget.assigneeEmail },
      ],
    },
    {
      // Long text the author writes as Markdown, rendered to read, and
      // edited in place as rich text.
      title: 'Description',
      content: <Markdown>{widget.description}</Markdown>,
      edit: edits.description,
    },
    {
      title: 'Checklist',
      emptyLabel: 'No items',
      // Edited in place as a list; the done-count above it follows every
      // tick (each item's box, a quick action).
      content: widget.checklist.length > 0 && <ChecklistDoneCount widget={widget} />,
      edit: edits.checklist,
    },
  ]
}

export function WidgetViewRoute() {
  const params = useParams<{ id: string }>()
  const navigate = useNavigate()
  const widgetId = Number(params.id)
  const widgetQuery = useWidgetQuery(widgetId)
  const widget = widgetQuery.data

  // Names for every category this widget links to, in one lookup by id.
  const categoryIds = widget ? [widget.categoryId, ...widget.extraCategoryIds] : []
  const categoriesQuery = useWidgetCategoriesByIdsQuery(categoryIds)
  const names = useMemo(() => widgetCategoryNames(categoriesQuery.data), [categoriesQuery.data])

  const editField = useEditWidgetField(widgetId)
  const edits =
    widget &&
    widgetEdits(
      widget,
      (update) => editField.mutateAsync(update),
      (change) => editField.mutateAsync(change),
    )

  return (
    <CategoryNamesContext.Provider value={names}>
      <EntityView
        layout="rail"
        isLoading={widgetQuery.isLoading}
        error={widgetQuery.error}
        onRetry={() => widgetQuery.refetch()}
        back={{ to: '/widgets', label: 'Widgets' }}
        title={widget?.name}
        titleEdit={edits && { label: 'Name', ...edits.name }}
        badges={
          widget &&
          edits && (
            <>
              {/* Edited in place: the badge turns into the form's Status picker. */}
              <EditableValue label="Status" edit={edits.status} layout="inline">
                <Badge variant={STATUS_BADGE_VARIANT[widget.status]}>{WIDGET_STATUS_LABELS[widget.status]}</Badge>
              </EditableValue>
              {/* Computed by the server, so it follows a tick once the save answers. */}
              <Badge variant={CHECKLIST_STATE_BADGE_VARIANT[widget.checklistState]}>
                {CHECKLIST_STATE_LABELS[widget.checklistState]}
              </Badge>
              {/* A quick action: flips and saves at once. */}
              <WidgetInStockSwitch widget={widget} />
            </>
          )
        }
        actions={
          widget && (
            <>
              <Button nativeButton={false} render={<Link to={`/widgets/${widget.id}/edit`} />}>
                <PencilIcon />
                Edit
              </Button>
              <DeleteWidgetAction widget={widget} onDeleted={() => navigate('/widgets')} />
            </>
          )
        }
        sections={widget && edits ? widgetSections(widget, edits) : []}
      />
    </CategoryNamesContext.Provider>
  )
}
