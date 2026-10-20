// The session clock's rules (src/hooks/use-session-clock.ts) against a
// fake clock the test moves by hand: elapsed is read from the clock, not
// summed from ticks, pauses are left out exactly, and `done` holds at
// `endsAt` however late the next frame comes.
import { describe, expect, it } from 'vitest'
import { createSessionClock } from '../src/hooks/use-session-clock'

function fakeClock() {
  let time = 1_000
  const clock = createSessionClock(() => time)
  return {
    clock,
    advance(ms: number) {
      time += ms
      clock.tick()
    },
    get state() {
      return clock.getSnapshot()
    },
  }
}

describe('createSessionClock', () => {
  it('is idle at zero until started, and time before start never counts', () => {
    const t = fakeClock()
    t.advance(5_000)
    expect(t.state).toEqual({ elapsed: 0, status: 'idle', paused: false })
    t.clock.start()
    t.advance(250)
    expect(t.state).toEqual({ elapsed: 250, status: 'running', paused: false })
  })

  it('reads the clock, so uneven frames add up to the real time', () => {
    const t = fakeClock()
    t.clock.start()
    for (const gap of [16, 17, 16, 400, 3, 16]) t.advance(gap)
    expect(t.state.elapsed).toBe(468)
  })

  it('leaves paused time out, and resumes where it paused', () => {
    const t = fakeClock()
    t.clock.start()
    t.advance(1_000)
    t.clock.pause()
    t.advance(60_000)
    expect(t.state).toEqual({ elapsed: 1_000, status: 'running', paused: true })
    t.clock.resume()
    t.advance(500)
    expect(t.state.elapsed).toBe(1_500)
  })

  it('reaches done at endsAt, and holds there however late the frame', () => {
    const t = fakeClock()
    t.clock.setEndsAt(60_000)
    t.clock.start()
    t.advance(59_000)
    expect(t.state.status).toBe('running')
    // A hidden tab draws no frames: the first one back is far past the end.
    t.advance(30_000)
    expect(t.state).toEqual({ elapsed: 60_000, status: 'done', paused: false })
    t.advance(10_000)
    expect(t.state.elapsed).toBe(60_000)
  })

  it('pause and resume do nothing before start or after done', () => {
    const t = fakeClock()
    t.clock.pause()
    expect(t.state.paused).toBe(false)
    t.clock.setEndsAt(100)
    t.clock.start()
    t.advance(200)
    t.clock.pause()
    expect(t.state).toEqual({ elapsed: 100, status: 'done', paused: false })
  })

  it('running=false holds the clock still without pausing it', () => {
    const t = fakeClock()
    t.clock.start()
    t.advance(1_000)
    t.clock.setRunning(false)
    t.advance(5_000)
    expect(t.state).toEqual({ elapsed: 1_000, status: 'running', paused: false })
    t.clock.setRunning(true)
    t.advance(1_000)
    expect(t.state.elapsed).toBe(2_000)
  })

  it('a pause while held stays paused when running comes back', () => {
    const t = fakeClock()
    t.clock.start()
    t.advance(1_000)
    t.clock.setRunning(false)
    t.clock.pause()
    t.clock.setRunning(true)
    t.advance(1_000)
    expect(t.state).toEqual({ elapsed: 1_000, status: 'running', paused: true })
  })

  it('stop goes back to idle at zero, and start begins again from zero', () => {
    const t = fakeClock()
    t.clock.start()
    t.advance(3_000)
    t.clock.stop()
    expect(t.state).toEqual({ elapsed: 0, status: 'idle', paused: false })
    t.advance(1_000)
    t.clock.start()
    t.advance(10)
    expect(t.state.elapsed).toBe(10)
  })

  it('a shorter endsAt while running ends it at once', () => {
    const t = fakeClock()
    t.clock.start()
    t.advance(5_000)
    t.clock.setEndsAt(3_000)
    expect(t.state).toEqual({ elapsed: 3_000, status: 'done', paused: false })
  })

  it('tells subscribers only when something changed', () => {
    const t = fakeClock()
    let calls = 0
    t.clock.subscribe(() => calls++)
    t.clock.tick()
    t.clock.tick()
    expect(calls).toBe(0)
    t.clock.start()
    t.advance(16)
    expect(calls).toBe(2)
  })
})
