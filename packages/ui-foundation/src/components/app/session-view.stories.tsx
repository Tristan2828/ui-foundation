import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { FastForwardIcon, PauseIcon, PlayIcon, RotateCcwIcon, Volume2Icon, VolumeXIcon } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { useMuted } from '@/hooks/use-muted'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'
import { useSessionClock, type SessionClock } from '@/hooks/use-session-clock'
import { cancelCues, chime, say, sequence, unlockAudio } from '@/lib/audio-cues'
import { SessionView } from './session-view'

// A timed screen as an app builds one (docs/foundation/timed-screens.md):
// SessionView over the page, a one-minute useSessionClock, a chime on
// start and a closing pair and a spoken line on done, a remembered mute,
// and a breathing circle that becomes a still one under reduced motion.
// For a background tab (#193): the closing pair is booked ahead on the
// audio clock when the run starts, resumes or skips, and taken back on
// pause or close; Skip seeks the clock; the tab's title counts down.
// Opened on load so axe sees it (e2e/storybook-visual.spec.ts), and driven
// through its states in e2e/session-view.spec.ts.
const LENGTH = 60_000

function remaining(elapsed: number): string {
  const seconds = Math.ceil((LENGTH - elapsed) / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function TimerScreen({
  clock,
  muted,
  setMuted,
  primary,
}: {
  clock: SessionClock
  muted: boolean
  setMuted: (muted: boolean) => void
  primary: RefObject<HTMLButtonElement | null>
}) {
  const reducedMotion = usePrefersReducedMotion()

  const start = () => {
    // From the click: browsers allow sound only after one.
    unlockAudio()
    clock.start()
    if (!muted) chime()
  }
  // Ten seconds on: the booked closing pair follows (TimerSession rebooks).
  const skip = () => clock.seek(clock.elapsed + 10_000)

  const breath = (Math.sin((clock.elapsed / 4000) * Math.PI * 2) + 1) / 2
  const counting = clock.status === 'running' && !clock.paused
  const status = clock.status === 'done' ? 'Done' : clock.status === 'idle' ? 'Ready' : clock.paused ? 'Paused' : 'Running'

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8">
      <div
        data-motion={reducedMotion ? 'reduced' : 'full'}
        aria-hidden
        className={cn('size-40 rounded-full bg-primary/15 ring-2 ring-primary', reducedMotion && 'transition-opacity duration-1000')}
        style={reducedMotion ? { opacity: counting ? 1 : 0.5 } : { transform: `scale(${0.75 + breath * 0.25})` }}
      />
      <p role="timer" aria-label="Time left" className="text-6xl font-semibold tabular-nums">
        {remaining(clock.elapsed)}
      </p>
      <p role="status" className="type-label text-muted-foreground">
        {status}
      </p>
      <div className="flex gap-2">
        {clock.status === 'running' ? (
          <>
            <Button ref={primary} size="lg" onClick={clock.paused ? clock.resume : clock.pause}>
              {clock.paused ? <PlayIcon /> : <PauseIcon />}
              {clock.paused ? 'Resume' : 'Pause'}
            </Button>
            <Button size="lg" variant="outline" onClick={skip}>
              <FastForwardIcon />
              Skip 10 s
            </Button>
          </>
        ) : (
          <Button ref={primary} size="lg" onClick={start}>
            {clock.status === 'done' ? <RotateCcwIcon /> : <PlayIcon />}
            {clock.status === 'done' ? 'Start again' : 'Start'}
          </Button>
        )}
        <Button size="lg" variant="outline" aria-pressed={muted} onClick={() => setMuted(!muted)}>
          {muted ? <VolumeXIcon /> : <Volume2Icon />}
          Mute
        </Button>
      </div>
    </div>
  )
}

// The clock lives above the view, so closing it holds the time
// (`running: open`) rather than losing it, and reopening carries on.
function TimerSession() {
  const [open, setOpen] = useState(true)
  const clock = useSessionClock({ running: open, endsAt: LENGTH })
  const [muted, setMuted] = useMuted('ui-foundation:stories:session-muted')
  const primary = useRef<HTMLButtonElement>(null)

  // The closing pair, booked ahead on the audio clock while time counts,
  // so it strikes on time in a background tab: from the run's plan (the
  // end, LENGTH from the start) and the clock's position, whenever counting
  // starts or the run moves, and taken back whenever it stops. Done takes
  // nothing back: the pair is striking then.
  const book = (from: number) => {
    cancelCues()
    if (!muted) sequence([{ pitch: 660 }, { pitch: 880 }], { at: Date.now() + LENGTH - from })
  }
  const counting = clock.status === 'running' && !clock.paused
  const timed: SessionClock = {
    ...clock,
    start: () => {
      clock.start()
      book(0)
    },
    pause: () => {
      clock.pause()
      cancelCues()
    },
    resume: () => {
      clock.resume()
      book(clock.elapsed)
    },
    seek: (ms) => {
      clock.seek(ms)
      book(Math.min(ms, LENGTH))
    },
  }
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (!next) cancelCues()
    else if (counting) book(clock.elapsed)
  }
  const changeMuted = (next: boolean) => {
    setMuted(next)
    if (next) cancelCues()
    else if (counting && open) sequence([{ pitch: 660 }, { pitch: 880 }], { at: Date.now() + LENGTH - clock.elapsed })
  }

  // Speech can't be booked: the spoken line comes when the clock (ticking
  // slowly in a background tab) reaches done.
  const previous = useRef(clock.status)
  useEffect(() => {
    if (previous.current !== 'done' && clock.status === 'done' && !muted) say('Done')
    previous.current = clock.status
  }, [clock.status, muted])

  // The tab's title counts down while the run is on, hidden tab included.
  const title = clock.status === 'running' ? `${remaining(clock.elapsed)} · Morning stretch` : 'Morning stretch'
  useEffect(() => {
    document.title = title
  }, [title])
  return (
    <div className="flex flex-col items-start gap-2">
      <p>{open ? 'Session open' : 'Session closed'}</p>
      <Button onClick={() => changeOpen(true)}>Open the session</Button>
      <SessionView
        open={open}
        onOpenChange={changeOpen}
        title="Morning stretch"
        keepAwake
        fullscreenControl
        initialFocus={primary}
      >
        <TimerScreen clock={timed} muted={muted} setMuted={changeMuted} primary={primary} />
      </SessionView>
    </div>
  )
}

const meta: Meta = {
  title: 'app/SessionView',
  parameters: { controls: { disable: true } },
}

export default meta

export const Timer: StoryObj = {
  render: () => <TimerSession />,
}
