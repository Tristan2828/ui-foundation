// A long text with sections to fold, for the Folding stories of <Markdown>
// and the rich-text editor (e2e/folding.spec.ts). Its `#` and `##` are
// toggle headings; its `###`s are plain, so they never fold. Each story opens with
// "Watering" folded when nothing is folded yet, so a folded heading is on
// screen for axe in both themes, and a reload keeps what was folded.
import { foldStore } from '@/hooks/fold-store'

export const FOLDING_SAMPLE = `# Garden plan {toggle="true"}

What goes where this year, and when.

## Beds {toggle="true"}

Three raised beds along the fence.

### Soil

Compost in March, a mulch of leaves in November.

### Layout

| Bed | Crop |
| --- | --- |
| North | Beans |
| South | Tomatoes |

## Watering {toggle="true"}

Every other morning in July and August.

> [!TIP]
> Water the roots, not the leaves.

## Harvest {toggle="true"}

- Beans from July
- Tomatoes from August

# Shopping list {toggle="true"}

- Seeds
- Twine
`

/** The fold state a Folding story opens with: "Watering" folded, unless something is. */
export function startFolded(foldKey: string) {
  if (foldStore.get(foldKey).size === 0) foldStore.set(foldKey, new Set(['2:Watering']))
}
