import type { Meta, StoryObj } from '@/fixtures/types'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Artwork } from './artwork'
import { ImageViewer, type ImageViewerImage } from './image-viewer'

// ImageViewer as an app uses it: a grid of covers, each a button that opens
// the viewer on it, with a caption and an action of the app's own beside
// it. Opened on load so axe sees it in both themes
// (e2e/fixtures-visual.spec.ts); e2e/image-viewer.spec.ts drives it.
// The pictures are neutral placeholders in e2e/harness/public.
// - Default: seven images (five tall covers, a photo, a very wide one),
//   open on the third, with Start From Here.
// - Failed: open on an image that can't be loaded (the frame's message).
// - OneImage: a single image, so no counter and no steps.

type Plate = ImageViewerImage & { id: string; name: string }

const PLATES: Plate[] = [
  { id: 'p1', name: 'Plate 1', src: '/viewer/cover-1.svg', alt: 'Plate 1: a blue circle over two grey lines' },
  { id: 'p2', name: 'Plate 2', src: '/viewer/cover-2.svg', alt: 'Plate 2: an orange circle over two brown lines' },
  { id: 'p3', name: 'Plate 3', src: '/viewer/cover-3.svg', alt: 'Plate 3: a green circle over two dark green lines' },
  { id: 'p4', name: 'Plate 4', src: '/viewer/cover-4.svg', alt: 'Plate 4: a violet circle over two plum lines' },
  { id: 'p5', name: 'Plate 5', src: '/viewer/cover-5.svg', alt: 'Plate 5: a red circle over two maroon lines' },
  { id: 'p6', name: 'Hillside', src: '/sample-photo.svg', alt: 'Green hills under a pale sky and a yellow sun' },
  { id: 'p7', name: 'Long ridge', src: '/wide-photo.svg', alt: 'A long brown ridge under a cream sky' },
].map((plate, i) => ({
  ...plate,
  caption: (
    <>
      <span className="font-semibold">{plate.name}</span>
      <span className="text-muted-foreground"> · Set {i < 5 ? 'A' : 'B'}</span>
    </>
  ),
}))

function Gallery({ plates, start, withActions = true }: { plates: Plate[]; start: number | null; withActions?: boolean }) {
  const [shown, setShown] = useState<number | null>(start)
  const [picked, setPicked] = useState('nothing yet')
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <p data-testid="picked" className="type-caption text-muted-foreground">
        Started from: {picked}
      </p>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {plates.map((plate, i) => (
          <li key={plate.id}>
            <button
              type="button"
              aria-label={`Open ${plate.name}`}
              onClick={() => setShown(i)}
              className="block w-full rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Artwork src={plate.src} aspect="2:3" />
            </button>
          </li>
        ))}
      </ul>
      <ImageViewer
        title="Plates"
        images={plates}
        index={shown}
        onIndexChange={setShown}
        actions={
          withActions
            ? (plate) => (
                <Button
                  onClick={() => {
                    setPicked(plate.name)
                    setShown(null)
                  }}
                >
                  Start From Here
                </Button>
              )
            : undefined
        }
      />
    </div>
  )
}

const meta: Meta = {
  title: 'app/ImageViewer',
  parameters: { controls: { disable: true } },
}

export default meta

export const Default: StoryObj = {
  render: () => <Gallery plates={PLATES} start={2} />,
}

export const Failed: StoryObj = {
  render: () => (
    <Gallery
      plates={[
        PLATES[0],
        { ...PLATES[1], id: 'gone', src: '/viewer/missing.svg', alt: 'Plate 2: an orange circle over two brown lines' },
        PLATES[2],
      ]}
      start={1}
    />
  ),
}

export const OneImage: StoryObj = {
  render: () => <Gallery plates={[PLATES[5]]} start={0} withActions={false} />,
}
