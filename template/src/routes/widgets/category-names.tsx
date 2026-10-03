// Category names for the widgets table's cells, through context rather than
// baked into the column definitions.
//
// Why: TanStack's flexRender treats a column's `cell` function as a React
// component, so rebuilding the columns gives every cell a new component type
// and React remounts all of them. Names arrive after the rows (they're
// looked up by id once the page is known), so columns built from the names
// remounted the whole table ~30ms after it first painted: focus was lost,
// and a measurement taken in that window found nothing. Columns stay stable
// (built once); the cells below read the names and re-render in place.
import { useContext } from 'react'
import { CategoryNamesContext } from './category-names-context'

export function CategoryName({ id }: { id: number }) {
  const names = useContext(CategoryNamesContext)
  return <>{names.get(id) ?? '…'}</>
}
