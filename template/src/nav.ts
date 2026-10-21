import { HomeIcon, PackageIcon } from 'lucide-react'
import type { NavItem } from '@tristan2828/ui-foundation'

// The sidebar's primary navigation, in order. A new entity's table gets an
// entry here (docs/foundation/add-an-entity.md step 7). An app with several
// modules can group entries as sections, `{ label, items: [...] }`, each a
// labelled group in the sidebar. With many sections, `collapsible: true`
// lets each fold away (remembered per browser; `defaultOpen: false` starts
// it folded); the section holding the current page always stays open.
// An entry's label also names the browser tab ("Widgets · <app>"), and its
// `to` may open a list on a saved view ('/widgets?status=active'): it's
// matched on its path alone.
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/widgets', label: 'Widgets', icon: PackageIcon },
]
