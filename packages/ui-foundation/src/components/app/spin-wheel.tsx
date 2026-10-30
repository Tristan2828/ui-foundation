// A wheel that picks one item at random, weighted: "what do I do next?"
// answered by chance among the app's own candidates.
//
// - Items: `items`, each a slice in order clockwise from the pointer. Its
//   `weight` (> 0, default 1; anything else counts as 1) is both the
//   slice's size and its chance: weight over the sum of weights. An
//   `emphasis` item is a tinted slice (a flagged record, a favourite).
// - Spinning: the Spin button turns the wheel several full turns with an
//   ease-out and stops with the pointer inside the picked slice, a little
//   off its centre. Spinning again starts from where it stopped. While it
//   turns the button is disabled; when it stops, `onResult(item)` and a
//   polite live region says "Picked <label>". With reduced motion asked
//   for, it doesn't turn: the result is at once.
// - The result at rest is the app's: `result` is the id of the slice drawn
//   picked (a solid fill), so the app can keep it, clear it, or show one
//   it chose itself.
// - Empty: `emptyMessage` in the wheel's place, the button disabled.
//
// Drawn in SVG so every fill is a theme token. Labels read from the hub
// out, cut to fit their slice, and left off a slice too thin to read; the
// full label is the slice's <title>. Square, the container's width up to
// 28rem.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'
import { pickSpinWheelIndex, spinWheelWeight as weightOf, type SpinWheelItem } from '@/components/app/spin-wheel-pick'

export type { SpinWheelItem }

export interface SpinWheelProps {
  items: readonly SpinWheelItem[]
  /** Called when the wheel stops, with the item under the pointer. */
  onResult: (item: SpinWheelItem) => void
  /** The slice drawn as picked while the wheel is at rest. The app owns it. */
  result?: SpinWheelItem['id'] | null
  /** The button's label. Default "Spin". */
  spinLabel?: string
  /** How long a spin turns. Default 4000. */
  durationMs?: number
  /** Shown in the wheel's place, with the button disabled, when `items` is empty. */
  emptyMessage?: ReactNode
  /** The source of chance, [0, 1). Default Math.random; a test passes a fixed one. */
  random?: () => number
  /** Names the wheel. Default "Wheel". */
  'aria-label'?: string
  className?: string
}

type Slice = { item: SpinWheelItem; start: number; end: number }

// Degrees clockwise from the top, where the pointer is.
function slicesOf(items: readonly SpinWheelItem[]): Slice[] {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0)
  let at = 0
  return items.map((item) => {
    const start = at
    at += (weightOf(item) / total) * 360
    return { item, start, end: at }
  })
}

// The wheel in viewBox units: centred on 0, 208 across so the pointer fits.
const RADIUS = 96
const HUB = 18
const FONT = 7.5
// Roughly a character's width at FONT, for cutting a label to its slice.
const CHAR = FONT * 0.52
const RIM_GAP = 7

const point = (degrees: number, radius: number) => {
  const radians = (degrees * Math.PI) / 180
  return `${(radius * Math.sin(radians)).toFixed(3)} ${(-radius * Math.cos(radians)).toFixed(3)}`
}

const slicePath = ({ start, end }: Slice) =>
  `M 0 0 L ${point(start, RADIUS)} A ${RADIUS} ${RADIUS} 0 ${end - start > 180 ? 1 : 0} 1 ${point(end, RADIUS)} Z`

// The label cut to the room its slice has: from where the slice is wide
// enough for a line of text out to the rim. Null when that's under three
// characters.
function fitLabel(label: string, degrees: number): string | null {
  const radians = (Math.min(degrees, 180) * Math.PI) / 180
  // The radius at which the slice is a line of text and a little wide.
  const wideEnough = degrees >= 180 ? 0 : (FONT * 1.3) / radians
  const from = Math.max(HUB + 5, wideEnough)
  const room = RADIUS - RIM_GAP - from
  const chars = Math.floor(room / CHAR)
  if (chars < 3) return null
  return label.length <= chars ? label : `${label.slice(0, chars - 1).trimEnd()}…`
}

// How far to turn so the pointer lands at `angle` on the wheel, from
// `rotation`, clockwise: never backwards.
const turnTo = (rotation: number, angle: number) => (((-angle - rotation) % 360) + 360) % 360

export function SpinWheel({
  items,
  onResult,
  result = null,
  spinLabel = 'Spin',
  durationMs = 4000,
  emptyMessage = 'Nothing to pick from',
  random = Math.random,
  'aria-label': ariaLabel = 'Wheel',
  className,
}: SpinWheelProps) {
  const reducedMotion = usePrefersReducedMotion()
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onResultRef = useRef(onResult)
  useEffect(() => {
    onResultRef.current = onResult
  })
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current)
  }, [])
  const titleId = useId()

  const slices = slicesOf(items)
  const empty = items.length === 0

  const spin = () => {
    if (spinning || empty) return
    const index = pickSpinWheelIndex(items, random())
    const slice = slices[index]
    // Somewhere inside the slice, not on its edge.
    const angle = slice.start + (slice.end - slice.start) * (0.15 + 0.7 * random())
    const turns = reducedMotion ? 0 : Math.max(3, Math.round(durationMs / 800))
    const next = rotation + turns * 360 + turnTo(rotation, angle)
    const finish = () => {
      timer.current = null
      setSpinning(false)
      setAnnouncement(`Picked ${slice.item.label}`)
      onResultRef.current(slice.item)
    }
    setRotation(next)
    if (reducedMotion) {
      finish()
      return
    }
    setAnnouncement('')
    setSpinning(true)
    timer.current = setTimeout(finish, durationMs)
  }

  return (
    <div data-slot="spin-wheel" className={cn('flex w-full max-w-md flex-col items-center gap-4', className)}>
      <div className="relative aspect-square w-full">
        {empty ? (
          <div
            data-state="empty"
            className="flex size-full items-center justify-center rounded-full border-2 border-dashed border-border p-8 text-center type-body text-muted-foreground"
          >
            {emptyMessage}
          </div>
        ) : (
          <svg
            viewBox="-104 -104 208 208"
            role="img"
            aria-labelledby={titleId}
            className="size-full select-none"
            data-state={spinning ? 'spinning' : 'idle'}
          >
            <title id={titleId}>{`${ariaLabel}, ${items.length} ${items.length === 1 ? 'item' : 'items'}`}</title>
            <g
              data-slot="spin-wheel-rotor"
              style={{
                transform: `rotate(${rotation}deg)`,
                transformBox: 'fill-box',
                transformOrigin: 'center',
                transition:
                  spinning && !reducedMotion ? `transform ${durationMs}ms cubic-bezier(0.15, 0.75, 0.2, 1)` : 'none',
              }}
            >
              {slices.map((slice, index) => {
                const picked = !spinning && result !== null && slice.item.id === result
                const degrees = slice.end - slice.start
                const text = fitLabel(slice.item.label, degrees)
                const mid = (slice.start + slice.end) / 2
                return (
                  <g
                    key={slice.item.id}
                    data-slot="spin-wheel-slice"
                    data-picked={picked || undefined}
                    data-emphasis={slice.item.emphasis || undefined}
                  >
                    <title>{slice.item.label}</title>
                    {degrees >= 359.999 ? (
                      <circle r={RADIUS} className={sliceFill(picked, slice.item.emphasis, index)} />
                    ) : (
                      <path d={slicePath(slice)} className={cn(sliceFill(picked, slice.item.emphasis, index), 'stroke-border')} strokeWidth={0.75} />
                    )}
                    {text !== null && (
                      <text
                        transform={`rotate(${mid - 90})`}
                        x={RADIUS - RIM_GAP}
                        y={0}
                        textAnchor="end"
                        dominantBaseline="central"
                        fontSize={FONT}
                        className={cn(picked ? 'fill-primary-foreground font-semibold' : 'fill-foreground')}
                      >
                        {text}
                      </text>
                    )}
                  </g>
                )
              })}
              <circle r={RADIUS} className="fill-none stroke-border" strokeWidth={1.5} />
            </g>
            <circle r={HUB} className="fill-background stroke-border" strokeWidth={1.5} />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={11}
              className="fill-foreground font-semibold tabular-nums"
              aria-hidden="true"
            >
              {items.length}
            </text>
            {/* The pointer, over the rim at the top. */}
            <path d="M -7 -104 L 7 -104 L 0 -88 Z" className="fill-foreground stroke-background" strokeWidth={1.5} strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <Button onClick={spin} disabled={spinning || empty} size="lg" className="min-w-32">
        {spinLabel}
      </Button>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  )
}

function sliceFill(picked: boolean, emphasis: boolean | undefined, index: number): string {
  if (picked) return 'fill-primary'
  if (emphasis) return 'fill-info/20'
  return index % 2 === 0 ? 'fill-muted' : 'fill-card'
}
