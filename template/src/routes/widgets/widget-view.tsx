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
import { CircleCheckIcon, CircleIcon, PencilIcon } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { EntityView, Markdown, type EntityViewSection } from '@tristan2828/ui-foundation'
import { Badge } from '@tristan2828/ui-foundation/ui/badge'
import { Button } from '@tristan2828/ui-foundation/ui/button'
import type { components } from '@/api/schema'
import { CategoryName } from './category-names'
import { CategoryNamesContext } from './category-names-context'
import { DeleteWidgetAction } from './delete-widget-action'
import { useWidgetCategoriesByIdsQuery, widgetCategoryNames } from './use-widget-categories'
import { useWidgetQuery } from './use-widgets'
import {
  CHECKLIST_STATE_BADGE_VARIANT,
  STATUS_BADGE_VARIANT,
  checklistDoneCount,
  dateFormatter,
  priceFormatter,
} from './widget-format'
import { CHECKLIST_STATE_LABELS, WIDGET_TAG_LABELS } from './widget-schema'

type Widget = components['schemas']['Widget']

// Sub-records, read-only: the done-count, then each item in order. A glyph
// with its state in words, not a checkbox: nothing here can be ticked yet.
function ChecklistItems({ items }: { items: Widget['checklist'] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="type-caption tabular-nums text-muted-foreground">{checklistDoneCount(items)}</p>
      <ul aria-label="Checklist items" className="flex flex-col gap-1.5">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-2">
            {item.done ? (
              <CircleCheckIcon role="img" aria-label="Done" className="mt-0.5 size-4 shrink-0 text-success-text" />
            ) : (
              <CircleIcon role="img" aria-label="Not done" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            )}
            <span className={item.done ? 'text-muted-foreground' : undefined}>{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// The plan's "View screen" section, in order. Labels match the form's.
function widgetSections(widget: Widget): EntityViewSection[] {
  return [
    {
      title: 'Details',
      fields: [
        // A reference shows the linked record's name. WidgetCategory has no
        // view of its own, so it's plain text; a referenced entity that has
        // one links to it: <Link to={`/<other>/${id}`}>.
        { label: 'Category', value: <CategoryName id={widget.categoryId} /> },
        {
          label: 'Extra Categories',
          emptyLabel: 'No extra categories',
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
          value: <span className="tabular-nums">{priceFormatter.format(Number(widget.price))}</span>,
        },
        { label: 'Assignee Email', emptyLabel: 'Unassigned', value: widget.assigneeEmail },
        // Yes/no: the word (cell pattern 12), read-only here. The table's row
        // switch is where it flips without the form.
        { label: 'In Stock', value: widget.inStock ? 'Yes' : 'No' },
      ],
    },
    {
      // Long text the author writes as Markdown, rendered to read.
      title: 'Description',
      content: <Markdown>{widget.description}</Markdown>,
    },
    {
      title: 'Checklist',
      emptyLabel: 'No items',
      content: widget.checklist.length > 0 && <ChecklistItems items={widget.checklist} />,
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

  return (
    <CategoryNamesContext.Provider value={names}>
      <EntityView
        isLoading={widgetQuery.isLoading}
        error={widgetQuery.error}
        onRetry={() => widgetQuery.refetch()}
        back={{ to: '/widgets', label: 'Widgets' }}
        title={widget?.name}
        badges={
          widget && (
            <>
              <Badge variant={STATUS_BADGE_VARIANT[widget.status]}>{widget.status}</Badge>
              <Badge variant={CHECKLIST_STATE_BADGE_VARIANT[widget.checklistState]}>
                {CHECKLIST_STATE_LABELS[widget.checklistState]}
              </Badge>
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
        sections={widget ? widgetSections(widget) : []}
      />
    </CategoryNamesContext.Provider>
  )
}
