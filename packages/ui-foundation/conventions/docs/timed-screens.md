# Timed Screens

A screen that runs on its own for minutes: a paced timer, a step-by-step
player, a recipe step, anything followed from across the room. The
package has the parts, so a screen like this is assembled, not rebuilt:

| Part | What it does |
|---|---|
| `SessionView` | The whole viewport over the app shell: a modal named by its title, focus kept inside, Esc closes it. Optional real fullscreen and a held wake lock |
| `useSessionClock` | A clock that doesn't drift, with pause, resume and seek: `idle`, `running`, `done` |
| `useWakeLock` | Keeps the screen on while a session runs (`SessionView`'s `keepAwake` uses it) |
| `unlockAudio`, `chime`, `sequence`, `cancelCues`, `say`, `hush`, `vibrate` | Sound cues with no audio files, booked ahead where they must be on time |
| `canVibrate` | Whether this browser can vibrate, to offer a Vibrate setting only where it works |
| `useMuted` | A mute toggle remembered on this device |
| `usePrefersReducedMotion` | Whether to swap movement for a fade |

All of them are imported from `@tristan2828/ui-foundation`. The package's
Storybook has the whole thing working together: `app/SessionView`, the
Timer story.

## The view

```tsx
const [open, setOpen] = useState(false)
// The clock lives above the view: closing it holds the time, reopening
// carries on. Inside the view, it would start over on every open.
const clock = useSessionClock({ running: open, endsAt: 5 * 60_000 })
const primary = useRef<HTMLButtonElement>(null)

<Button onClick={() => setOpen(true)}>Start the routine</Button>
<SessionView
  open={open}
  onOpenChange={setOpen}
  title="Morning routine"
  keepAwake
  fullscreenControl
  initialFocus={primary}
>
  …the screen, with its main control as `ref={primary}`
</SessionView>
```

- **The title is required.** It names the dialog for screen readers and
  heads the view. The header also holds Close and, with
  `fullscreenControl`, a "Full screen" toggle.
- **Real fullscreen** asks the browser to take the whole screen too
  (hiding its own bars). Where the browser can't (iOS Safari on a phone),
  the control isn't shown. The view already covers the page. Closing the
  view leaves fullscreen if the view entered it.
- **Safe areas.** The view pads itself by the phone's safe-area insets.
  They are zero unless the app's `index.html` viewport meta has
  `viewport-fit=cover`. Without it the browser keeps the page out of the
  notch on its own. With it, check the rest of the app at phone width too.
- **Never build this from `DialogContent`** with its classes overridden
  piece by piece. That fights the primitive's own classes on every
  upgrade, and gets the details above wrong.

## The clock

`useSessionClock({ running?, endsAt? })` returns
`{ elapsed, status, paused, start, startFrom, seek, pause, resume, stop }`.

- `elapsed` is in milliseconds, read from `performance.now()` each
  animation frame. It is never summed from ticks, so it doesn't drift.
  Paused time is left out, so `resume()` carries on exactly where
  `pause()` stopped.
- `status` is `idle` until `start()`, then `running`, then `done` once
  `elapsed` reaches `endsAt`. `elapsed` stops at `endsAt`. Without
  `endsAt` it runs until `stop()`, which goes back to `idle` at zero.
- `paused` is the person's own pause. `running: false` is different: it
  holds the clock still without pausing it. Use it for time the session
  isn't on screen at all, such as the view closed or a confirmation in
  front of it.
- It re-renders once per frame, only while counting. Format what it shows
  from `elapsed`, never by counting renders.
- A hidden tab draws no frames, but its time still counts. While hidden,
  the clock reads the time on a slow tick instead (once a second at most),
  enough for a countdown in the tab's title, and coming back catches up
  exactly, reaching `done` if it's due. See "Background tabs" below.
- `startFrom(ms)` starts a run at a given elapsed time: one resumed from
  storage after a reload. `seek(ms)` moves a running run there, paused or
  not, for Skip and Back; at or past `endsAt` it's `done`. A seek while
  idle or done does nothing: use `startFrom`. Pause and resume stay exact
  after either. Don't keep a `Date.now()` clock of your own beside it.

For phases (stretch two minutes, rest thirty seconds), keep one clock for
the whole session and work out the phase from `elapsed`. A clock per
phase drifts by the gap between one ending and the next starting.

## Sound

Browsers block sound until the person has clicked or tapped. So:

- **Call `unlockAudio()` from the click that starts the session**, in the
  click handler itself, not in an effect after it. Every cue before that
  is dropped rather than played late. iOS also needs speech started from
  a click, and `unlockAudio()` does that too.
- `chime({ pitch?, volume?, duration?, at? })`: a soft sine tone, a short
  attack and a slow fade. `pitch` is in Hz (660 by default). For a
  closing pair, use `sequence([{ pitch: 660 }, { pitch: 880 }])`, 180 ms
  apart by default. `at` (a `Date.now()` time; `sequence` takes it in its
  options) books it ahead: see "Background tabs". Each returns a handle
  whose `cancel()` takes back what hasn't sounded yet, and `cancelCues()`
  takes back every booked chime.
- `say(text)` speaks a line ("Next: stretch, 2 minutes"), cutting off any
  line still being spoken. `hush()` stops it. Call `hush()` when the
  session stops or the view closes.
- `vibrate(pattern)` only works on Android. Elsewhere it does nothing.
- **A Vibrate setting is offered only where `canVibrate()` is true.**
  iPhone browsers can't vibrate, so a toggle there would set something
  that does nothing. `canVibrate()` is the same test `vibrate()` makes, so
  the two never disagree. Read it once, since it doesn't change during a
  session: `const [vibrates] = useState(canVibrate)`. Show the toggle (a
  pressed button named "Vibrate", like Mute) only when `vibrates` is
  true, and check the setting before each `vibrate()` call.
- Every one of them is a no-op where the browser can't make the sound, so
  none needs a check around it.
- **Mute** is the app's: `const [muted, setMuted] = useMuted('my-app:routine:muted')`,
  and check `muted` before each cue. Name the key for the app and screen.
  It's remembered on this device. Where storage is blocked it still works
  for the page's life. Show the toggle as a pressed button
  (`aria-pressed={muted}`) named "Mute".
- **Cue on a change of state** in an effect that compares the previous
  state with the current one, so the cue plays once. Never play a cue
  during render. A cue that must be on time while the tab is in the
  background (a phase ending) is booked ahead instead, below.

## Background tabs

A timer is often left running in a tab behind another. The browser draws
no frames there and slows its timers (Chrome to about once a minute after
a few minutes), so anything driven by them runs late: a chime from an
effect on a phase change sounds when the person comes back, not when the
phase ends. Web Audio's own clock keeps time, so:

- **Book the cues ahead from the run's plan.** When counting starts
  (start, resume, the view reopened, unmuted), work out when each coming
  cue is due from the plan and the clock's position, and book it:
  `sequence(closingPair, { at: Date.now() + endsAt - clock.elapsed })`,
  a `chime({ at })` for each phase boundary. They strike on time whatever
  the page's timers do.
- **Take them back whenever counting stops, and rebook when the run
  moves:** `cancelCues()` on pause, on closing the view, on mute and on
  leaving the screen (an effect's cleanup); on Skip and Back, `seek`,
  then `cancelCues()` and book again from the new position. A chime
  already sounding rings out. Reaching `done` takes nothing back: the
  closing cue is sounding then.
- **Do it in the handlers**, where you know why counting stopped, not in
  an effect on `paused`: an effect's cleanup can't tell pause from done.
  The Timer story (`app/SessionView`) does exactly this.
- **Speech can't be booked.** `say()` still comes when the clock's slow
  tick reaches the moment, so in a background tab it may be late. Keep
  what must be on time to chimes.
- **The tab's title** (`Focus 18:42`) can count down from `elapsed`: the
  clock's slow tick re-renders while hidden. Set it in an effect, and put
  the plain title back when the run ends. A tick a browser has slowed to
  once a minute shows a coarser countdown; the time itself is never off.
- Booked cues need `unlockAudio()` from a click, like any other. iOS
  Safari may suspend audio in a background tab altogether; nothing in a
  web page gets round that.

## Motion

`usePrefersReducedMotion()` is true while the person's system asks for
less motion. Swap a sweeping ring or a breathing circle for a fade or a
still state then. Don't drop the information it carried.

## Testing a timed screen in Playwright

**Install the fake clock before `goto`, then `fastForward` to each state:**

```ts
test('running, paused and done', async ({ page }) => {
  await page.clock.install()          // before goto, or the page keeps the real clock
  await page.goto('/routine')
  await page.getByRole('button', { name: 'Start' }).click()

  await page.clock.fastForward('00:20')
  await expect(page.getByRole('timer', { name: 'Time left' })).toHaveText('4:40')

  await page.getByRole('button', { name: 'Pause' }).click()
  await page.clock.fastForward('05:00')
  await expect(page.getByRole('timer', { name: 'Time left' })).toHaveText('4:40')

  await page.getByRole('button', { name: 'Resume' }).click()
  await page.clock.fastForward('04:40')
  await expect(page.getByRole('status')).toHaveText('Done')
})
```

- **`fastForward`, not `runFor`.** `runFor` over a long span doesn't fire
  every animation frame. A screen that adds time up per frame comes out
  short: a one-minute session ended about 20 seconds early in a real
  app's tests. `useSessionClock` reads the time each frame, so one frame
  after `fastForward` lands on the right state.
- Give the time on screen `role="timer"` and a name, and the state line
  `role="status"`, so tests (and screen readers) find them by role.
- **The wake lock** does nothing in headless Chromium. To check it's
  held, replace `navigator.wakeLock` in `page.addInitScript` with one that
  records `request` and `release`. The package's own spec does this
  (`e2e/session-view.spec.ts` in the foundation repo).
- **Sound in tests.** Headless browsers play to nothing, so a test never
  needs sound off to pass. To check what's spoken, wrap
  `speechSynthesis.speak` in `addInitScript` and record each
  utterance's `text`. To run a headed test in silence, set the mute key
  before the page loads:
  `page.addInitScript(() => localStorage.setItem('my-app:routine:muted', 'true'))`.
- **Reduced motion:** `await page.emulateMedia({ reducedMotion: 'reduce' })`.

**A background tab:** set the page's visibility yourself, stop its
animation frames, and record what's booked on a stand-in `AudioContext`:

```ts
test.beforeEach(async ({ page }) => {
  await page.clock.install()
  await page.addInitScript(() => {
    let visibility: DocumentVisibilityState = 'visible'
    Object.defineProperty(document, 'visibilityState', { get: () => visibility })
    Object.defineProperty(document, 'hidden', { get: () => visibility === 'hidden' })
    const booked: { pitch: number; at: number; cancelled: boolean }[] = []
    class RecordingAudioContext {
      state = 'running'; currentTime = 0; destination = {}
      resume = async () => {}
      last = { pitch: 0, at: 0, cancelled: false }
      createOscillator() {
        const cue = (this.last = { pitch: 0, at: 0, cancelled: false })
        return {
          frequency: { setValueAtTime: (hz: number) => (cue.pitch = hz) },
          connect: (node: unknown) => node,
          start: (at: number) => booked.push(Object.assign(cue, { at })),
          stop: () => {},
        }
      }
      createGain() {
        const cue = this.last
        return {
          gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect: (node: unknown) => node,
          disconnect: () => (cue.cancelled = true),
        }
      }
    }
    Object.assign(window, {
      AudioContext: RecordingAudioContext,
      __booked: booked,
      __hide() {
        visibility = 'hidden'
        window.requestAnimationFrame = () => 0   // a hidden tab draws no frames
        document.dispatchEvent(new Event('visibilitychange'))
      },
    })
  })
})

test('the end is booked ahead, and the title counts down while hidden', async ({ page }) => {
  await page.goto('/routine')
  await page.getByRole('button', { name: 'Start' }).click()
  // Seconds ahead on the audio clock: the closing pair five minutes on.
  const booked = () => page.evaluate(() => (window as any).__booked.map((c: any) => [c.pitch, Math.round(c.at), c.cancelled]))
  await expect.poll(booked).toContainEqual([660, 300, false])

  await page.evaluate(() => (window as any).__hide())
  await page.clock.fastForward('00:10')
  await expect(page).toHaveTitle(/^4:50/)
})
```

Pause, Skip and Back are asserted the same way: the earlier booking's
`cancelled` turns true and a new one appears at the new time.

**An open-ended count-up: pause the fake clock.** After
`clock.install()` the fake clock still moves in real time between
steps, so every reading picks up however long the machine took since the
last `fastForward`. A count-up with no end (a stopwatch, a hold that
ends on a tap) has nothing to stop at, so under load its readings are
off by a second or more. Pause the clock before the session starts, at a
time fixed from the install, and move it only with `fastForward`:

```ts
test('the hold counts up until the tap', async ({ page }) => {
  const t0 = Date.now()
  await page.clock.install({ time: t0 })
  await page.goto('/routine')
  // The page's clock runs no faster than real time, so a minute on is still
  // ahead for the whole test timeout; nothing on the start screen is timed.
  await page.clock.pauseAt(t0 + 60_000)
  await page.getByRole('button', { name: 'Start' }).click()

  await page.clock.fastForward('00:42')
  await expect(page.getByRole('timer', { name: 'Held for' })).toHaveText('0:42')

  // A paused clock stops axe and the dialog's close animation: resume first.
  await page.clock.resume()
  await expectNoAxeViolations(page)   // @tristan2828/ui-foundation/testing
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
})
```

- **Pause at a time fixed from `install`, before the session starts.**
  Never at one read after it (`pauseAt(Date.now() + 50)` after Start):
  until the pause lands the page's fake clock runs in real time, so a
  slow round trip or a busy first frame puts it past that time, and
  `pauseAt` fails with "Cannot fast-forward to the past". A time a minute
  on from `install` is still ahead however slow the machine is.
- **`clock.resume()` before axe or closing the view.** With the clock
  paused, axe's scan never finishes and the dialog's close animation
  never ends, so the test times out with nothing pointing at the clock.
