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
// Read-only, except the plan's quick actions (widget-quick-actions.tsx,
// cell pattern 17): Status and In Stock change from the header, and
// checklist items tick in place, each saved on its own. Anything else
// goes through Edit.
import { PencilIcon } from 'lucide-react'
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
import { CHECKLIST_STATE_BADGE_VARIANT, dateFormatter, priceFormatter } from './widget-format'
import { ChecklistItems, WidgetInStockSwitch, WidgetStatusSelect } from './widget-quick-actions'
import { CHECKLIST_STATE_LABELS, WIDGET_TAG_LABELS } from './widget-schema'

type Widget = components['schemas']['Widget']

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
      // A quick action: each item ticks in place (the done-count follows).
      content: widget.checklist.length > 0 && <ChecklistItems widget={widget} />,
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
              {/* Quick actions: Status picks another value, In Stock flips. */}
              <WidgetStatusSelect widget={widget} />
              {/* Computed by the server, so it follows a tick once the save answers. */}
              <Badge variant={CHECKLIST_STATE_BADGE_VARIANT[widget.checklistState]}>
                {CHECKLIST_STATE_LABELS[widget.checklistState]}
              </Badge>
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
        sections={widget ? widgetSections(widget) : []}
      />
    </CategoryNamesContext.Provider>
  )
}
