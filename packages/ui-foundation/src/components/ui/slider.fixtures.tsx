import type { Meta, StoryObj } from '@/fixtures/types'
import { Slider } from '@/components/ui/slider'

// One value and a range, each named, so axe sees labelled thumbs and the
// token check sees the track, the range and the thumb. Under a palette the
// thumbs glow (--thumb-glow).
const meta: Meta = {
  title: 'ui/Slider',
  render: () => (
    <div className="flex max-w-sm flex-col gap-8">
      <div className="flex flex-col gap-3">
        <span id="slider-volume" className="type-label">Volume</span>
        <Slider aria-labelledby="slider-volume" defaultValue={40} />
      </div>
      <div className="flex flex-col gap-3">
        <span id="slider-price" className="type-label">Price range</span>
        <Slider aria-labelledby="slider-price" defaultValue={[20, 70]} />
      </div>
    </div>
  ),
}

export default meta
type Story = StoryObj

export const Default: Story = {}
