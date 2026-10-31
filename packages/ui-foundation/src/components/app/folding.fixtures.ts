// A long text with sections to fold, for the Folding stories of <Markdown>
// and the rich-text editor (e2e/folding.spec.ts). Each story opens with
// "Watering" folded when nothing is folded yet, so a folded heading is on
// screen for axe in both themes, and a reload keeps what was folded.
import { foldStore } from '@/hooks/fold-store'

export const FOLDING_SAMPLE = `# Garden plan

What goes where this year, and when.

## Beds

Three raised beds along the fence.

### Soil

Compost in March, a mulch of leaves in November.

### Layout

| Bed | Crop |
| --- | --- |
| North | Beans |
| South | Tomatoes |

## Watering

Every other morning in July and August.

> [!TIP]
> Water the roots, not the leaves.

## Harvest

- Beans from July
- Tomatoes from August

# Shopping list

- Seeds
- Twine
`

/** The fold state a Folding story opens with: "Watering" folded, unless something is. */
export function startFolded(foldKey: string) {
  if (foldStore.get(foldKey).size === 0) foldStore.set(foldKey, new Set(['2:Watering']))
}
