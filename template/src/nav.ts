import { HomeIcon, PackageIcon } from 'lucide-react'
import type { NavItem } from '@tristan2828/ui-foundation'

// The sidebar's primary navigation, in order. A new entity's table gets an
// entry here (docs/foundation/add-an-entity.md step 7).
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/widgets', label: 'Widgets', icon: PackageIcon },
]
