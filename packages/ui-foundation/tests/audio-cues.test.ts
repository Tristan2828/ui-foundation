// The audio cues (src/lib/audio-cues.ts) against a fake Web Audio and
// speech synthesis that record what they're asked: nothing sounds before
// unlockAudio(), a chime's envelope rises fast and fades slow, a sequence
// spaces its strikes, a new spoken line cuts off the last, and every cue
// is a no-op where the browser has no such API. A chime booked `at` a
// later time is scheduled that far ahead on the audio clock, and a cancel
// takes back only the strikes that haven't sounded (#193). canVibrate() and the shared
// vibrate() read the same navigator.vibrate, so they never disagree.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAudioCues } from '../src/lib/audio-cues'

type Strike = { pitch: number; start: number; stop: number; gain: [string, number, number][]; cancelled: boolean }

function fakeAudio(initialState: AudioContextState = 'suspended') {
  const contexts: FakeContext[] = []
  const strikes: Strike[] = []

  class FakeContext {
    state: AudioContextState = initialState
    currentTime = 10
    destination = {}
    resumes = 0
    // Set false to leave it stuck, as iOS does while a call is on.
    resumeWorks = true
    private listeners: (() => void)[] = []
    // A chime makes its oscillator, then its gain: both record here.
    private building: Strike | null = null
    constructor() {
      contexts.push(this)
    }
    addEventListener(type: string, listener: () => void) {
      if (type === 'statechange') this.listeners.push(listener)
    }
    // The browser changing the state, and saying so.
    change(state: string) {
      this.state = state as AudioContextState
      this.listeners.forEach((listener) => listener())
    }
    resume() {
      this.resumes++
      if (!this.resumeWorks) return Promise.reject(new Error('not allowed'))
      return Promise.resolve().then(() => this.change('running'))
    }
    createOscillator() {
      const strike: Strike = { pitch: 0, start: 0, stop: 0, gain: [], cancelled: false }
      this.building = strike
      return {
        type: '',
        frequency: { setValueAtTime: (value: number) => (strike.pitch = value) },
        connect: (node: unknown) => node,
        start: (time: number) => {
          strike.start = time
          strikes.push(strike)
        },
        stop: (time?: number) => {
          if (time !== undefined) strike.stop = time
        },
        onended: null,
      }
    }
    createGain() {
      const strike = this.building!
      return {
        gain: {
          setValueAtTime: (value: number, time: number) => strike.gain.push(['set', value, time]),
          exponentialRampToValueAtTime: (value: number, time: number) => strike.gain.push(['ramp', value, time]),
        },
        connect: (node: unknown) => node,
        disconnect: () => (strike.cancelled = true),
      }
    }
  }
  return { AudioContext: FakeContext as unknown as new () => AudioContext, contexts, strikes }
}

function fakeSpeech() {
  const spoken: { text: string; volume: number; lang: string }[] = []
  let cancels = 0
  class Utterance {
    volume = 1
    lang = ''
    rate = 1
    constructor(public text = '') {}
  }
  return {
    env: {
      speechSynthesis: {
        speak: (line: SpeechSynthesisUtterance) => void spoken.push({ text: line.text, volume: line.volume, lang: line.lang }),
        cancel: () => void cancels++,
      },
      SpeechSynthesisUtterance: Utterance as unknown as new (text?: string) => SpeechSynthesisUtterance,
    },
    spoken,
    get cancels() {
      return cancels
    },
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('audio cues', () => {
  it('drops a chime before unlockAudio(), rather than playing it late', () => {
    const audio = fakeAudio()
    const cues = createAudioCues({ AudioContext: audio.AudioContext })
    cues.chime()
    expect(audio.contexts).toHaveLength(0)
    expect(audio.strikes).toHaveLength(0)
  })

  it('unlockAudio() makes one context and resumes it; a chime in the same click plays', async () => {
    const audio = fakeAudio()
    const cues = createAudioCues({ AudioContext: audio.AudioContext })
    cues.unlockAudio()
    cues.chime({ pitch: 523 })
    expect(audio.contexts).toHaveLength(1)
    expect(audio.contexts[0].resumes).toBe(1)
    expect(audio.strikes.map((s) => s.pitch)).toEqual([523])
    await settle()
    cues.unlockAudio()
    expect(audio.contexts).toHaveLength(1)
    expect(audio.contexts[0].resumes).toBe(1)
  })

  it('a chime rises in 15ms and fades over its duration, from and to near silence', () => {
    const audio = fakeAudio('running')
    const cues = createAudioCues({ AudioContext: audio.AudioContext })
    cues.unlockAudio()
    cues.chime({ volume: 0.5, duration: 1000 })
    const [strike] = audio.strikes
    expect(strike.start).toBe(10)
    expect(strike.gain).toEqual([
      ['set', 0.0001, 10],
      ['ramp', 0.5, 10.015],
      ['ramp', 0.0001, 11],
    ])
    expect(strike.stop).toBeCloseTo(11.05)
  })

  it('a sequence strikes each chime `spacing` apart', () => {
    const audio = fakeAudio('running')
    const cues = createAudioCues({ AudioContext: audio.AudioContext })
    cues.unlockAudio()
    cues.sequence([{ pitch: 660 }, { pitch: 880 }], { spacing: 250 })
    expect(audio.strikes.map((s) => [s.pitch, s.start])).toEqual([
      [660, 10],
      [880, 10.25],
    ])
  })

  it('a chime booked `at` a later time is scheduled that far ahead on the audio clock', () => {
    const audio = fakeAudio('running')
    let time = 50_000
    const cues = createAudioCues({ AudioContext: audio.AudioContext, now: () => time })
    cues.unlockAudio()
    cues.chime({ pitch: 523, at: 52_500 })
    cues.sequence([{ pitch: 660 }, { pitch: 880 }], { spacing: 250, at: 60_000 })
    // Already past: it strikes now, as chime() does.
    time = 61_000
    cues.chime({ pitch: 440, at: 60_000 })
    expect(audio.strikes.map((s) => [s.pitch, s.start])).toEqual([
      [523, 12.5],
      [660, 20],
      [880, 20.25],
      [440, 10],
    ])
  })

  it('cancelCues() takes back every strike not yet sounded, and leaves one sounding to ring out', () => {
    const audio = fakeAudio('running')
    const cues = createAudioCues({ AudioContext: audio.AudioContext, now: () => 0 })
    cues.unlockAudio()
    cues.chime({ pitch: 440 })
    cues.chime({ pitch: 523, at: 5_000 })
    cues.sequence([{ pitch: 660 }, { pitch: 880 }], { at: 9_000 })
    audio.contexts[0].currentTime = 10.5
    cues.cancelCues()
    expect(audio.strikes.map((s) => [s.pitch, s.cancelled])).toEqual([
      [440, false],
      [523, true],
      [660, true],
      [880, true],
    ])
    // Booking again after a cancel works as before.
    cues.chime({ pitch: 523, at: 5_000 })
    expect(audio.strikes.at(-1)).toMatchObject({ pitch: 523, cancelled: false })
  })

  it("a cue's own cancel() takes back only its strikes, the rest of a sequence included", () => {
    const audio = fakeAudio('running')
    const cues = createAudioCues({ AudioContext: audio.AudioContext, now: () => 0 })
    cues.unlockAudio()
    const pair = cues.sequence([{ pitch: 660 }, { pitch: 880 }], { spacing: 1_000 })
    const later = cues.chime({ pitch: 523, at: 5_000 })
    // The first of the pair has struck; the second hasn't.
    audio.contexts[0].currentTime = 10.5
    pair.cancel()
    expect(audio.strikes.map((s) => [s.pitch, s.cancelled])).toEqual([
      [660, false],
      [880, true],
      [523, false],
    ])
    later.cancel()
    expect(audio.strikes.at(-1)!.cancelled).toBe(true)
  })

  it('a booking before unlockAudio() is dropped, and its cancel() does nothing', () => {
    const audio = fakeAudio('running')
    const cues = createAudioCues({ AudioContext: audio.AudioContext })
    const cue = cues.chime({ at: Date.now() + 5_000 })
    cue.cancel()
    cues.cancelCues()
    expect(audio.strikes).toHaveLength(0)
  })

  it('a context suspended again later (iOS interrupts it) stays silent until the next unlock', async () => {
    const audio = fakeAudio()
    const cues = createAudioCues({ AudioContext: audio.AudioContext })
    cues.unlockAudio()
    await settle()
    audio.contexts[0].state = 'suspended'
    cues.chime()
    expect(audio.strikes).toHaveLength(0)
    cues.unlockAudio()
    cues.chime()
    expect(audio.strikes).toHaveLength(1)
  })

  it('say() cuts off the line before; hush() stops it', () => {
    const speech = fakeSpeech()
    const cues = createAudioCues(speech.env)
    cues.say('Next: stretch, 2 minutes', { lang: 'en-GB' })
    expect(speech.cancels).toBe(1)
    expect(speech.spoken).toEqual([{ text: 'Next: stretch, 2 minutes', volume: 1, lang: 'en-GB' }])
    cues.hush()
    expect(speech.cancels).toBe(2)
  })

  it('unlockAudio() primes speech with a silent, empty line (iOS)', () => {
    const speech = fakeSpeech()
    createAudioCues(speech.env).unlockAudio()
    expect(speech.spoken).toEqual([{ text: '', volume: 0, lang: '' }])
  })

  it('vibrate() passes the pattern on where there is a motor', () => {
    const patterns: (number | number[])[] = []
    const cues = createAudioCues({ vibrate: (pattern) => (patterns.push(pattern), true) })
    cues.vibrate([200, 100, 200])
    expect(patterns).toEqual([[200, 100, 200]])
  })

  it('every cue is a no-op where the browser has none of the APIs', () => {
    const cues = createAudioCues({})
    expect(() => {
      cues.unlockAudio()
      cues.chime()
      cues.sequence([{}, {}], { at: 1 }).cancel()
      cues.cancelCues()
      cues.say('Done')
      cues.hush()
      cues.vibrate(200)
    }).not.toThrow()
  })

  it('a context the browser refuses to create leaves every chime a no-op', () => {
    const Refusing = class {
      constructor() {
        throw new DOMException('Not allowed', 'NotAllowedError')
      }
    } as unknown as new () => AudioContext
    const cues = createAudioCues({ AudioContext: Refusing })
    expect(() => {
      cues.unlockAudio()
      cues.chime()
    }).not.toThrow()
  })
})

// #217: on iOS the audio clock stops while the context is interrupted. The
// cues resume it, take back what was booked on the stopped clock, and say so.
describe('recovering from an interruption', () => {
  function fakePage() {
    const listeners: (() => void)[] = []
    return {
      visibilityState: 'hidden' as DocumentVisibilityState,
      addEventListener: (_type: string, listener: () => void) => void listeners.push(listener),
      show() {
        this.visibilityState = 'visible'
        listeners.forEach((listener) => listener())
      },
    }
  }

  const started = async (page?: ReturnType<typeof fakePage>) => {
    const audio = fakeAudio()
    let wall = 1000
    const cues = createAudioCues({
      AudioContext: audio.AudioContext,
      document: page as unknown as Pick<Document, 'addEventListener' | 'visibilityState'>,
      now: () => wall,
    })
    cues.unlockAudio()
    await settle()
    return { audio, cues, context: audio.contexts[0], advance: (ms: number) => (wall += ms) }
  }

  it('resumes a context that stops, then takes back its bookings and calls back once', async () => {
    const { audio, cues, context } = await started()
    const recovered = vi.fn()
    cues.onCuesRecovered(recovered)
    cues.chime({ at: 6000 })
    expect(audio.strikes[0].cancelled).toBe(false)

    context.change('interrupted')
    expect(context.resumes).toBe(2)
    expect(recovered).not.toHaveBeenCalled()
    await settle()

    expect(recovered).toHaveBeenCalledTimes(1)
    expect(audio.strikes[0].cancelled).toBe(true)
    cues.chime({ at: 6000 })
    expect(audio.strikes).toHaveLength(2)
  })

  it('takes back a strike the stopped clock had reached, too: it would ring on late', async () => {
    const { audio, cues, context } = await started()
    cues.chime()
    context.currentTime = 12
    context.change('suspended')
    await settle()
    expect(audio.strikes[0].cancelled).toBe(true)
  })

  it("the context's first run is not a recovery", async () => {
    const audio = fakeAudio()
    const cues = createAudioCues({ AudioContext: audio.AudioContext })
    const recovered = vi.fn()
    cues.onCuesRecovered(recovered)
    cues.unlockAudio()
    await settle()
    expect(audio.contexts[0].state).toBe('running')
    expect(recovered).not.toHaveBeenCalled()
  })

  it('a callback that unsubscribed is not called, and one that throws does not stop the others', async () => {
    const { cues, context } = await started()
    const gone = vi.fn()
    const after = vi.fn()
    cues.onCuesRecovered(gone)()
    cues.onCuesRecovered(() => {
      throw new Error('a screen failed')
    })
    cues.onCuesRecovered(after)
    context.change('interrupted')
    await settle()
    expect(gone).not.toHaveBeenCalled()
    expect(after).toHaveBeenCalledTimes(1)
  })

  it('a refused resume is tried again when the page is visible again', async () => {
    const page = fakePage()
    const { cues, context } = await started(page)
    const recovered = vi.fn()
    cues.onCuesRecovered(recovered)
    context.resumeWorks = false
    context.change('interrupted')
    await settle()
    expect(recovered).not.toHaveBeenCalled()

    context.resumeWorks = true
    page.show()
    await settle()
    expect(context.resumes).toBe(3)
    expect(recovered).toHaveBeenCalledTimes(1)
  })

  it('a click on unlockAudio() recovers a context whose change was never announced', async () => {
    const { cues, context } = await started()
    const recovered = vi.fn()
    cues.onCuesRecovered(recovered)
    context.state = 'interrupted' as AudioContextState
    cues.unlockAudio()
    await settle()
    expect(recovered).toHaveBeenCalledTimes(1)
  })

  it('works with a stand-in context that has no addEventListener', async () => {
    const audio = fakeAudio()
    Reflect.deleteProperty(audio.AudioContext.prototype, 'addEventListener')
    const cues = createAudioCues({ AudioContext: audio.AudioContext })
    expect(() => cues.unlockAudio()).not.toThrow()
    await settle()
    expect(() => cues.chime()).not.toThrow()
    expect(audio.strikes).toHaveLength(1)
  })
})

describe('cuesInSync', () => {
  const booked = async () => {
    const audio = fakeAudio('running')
    let wall = 1000
    const cues = createAudioCues({ AudioContext: audio.AudioContext, now: () => wall })
    cues.unlockAudio()
    cues.chime({ at: 9000 })
    return { audio, cues, context: audio.contexts[0], advance: (ms: number) => (wall += ms) }
  }

  it('is true with nothing booked, and before any context', () => {
    const cues = createAudioCues({ AudioContext: fakeAudio('running').AudioContext })
    expect(cues.cuesInSync()).toBe(true)
    cues.unlockAudio()
    expect(cues.cuesInSync()).toBe(true)
  })

  it('is true while the audio clock keeps time with Date.now()', async () => {
    const { cues, context, advance } = await booked()
    advance(5000)
    context.currentTime += 5
    expect(cues.cuesInSync()).toBe(true)
  })

  it('is false once the audio clock has stood still, and true again after a rebook', async () => {
    const { cues, context, advance } = await booked()
    advance(5000)
    context.currentTime += 1 // the clock stopped for four seconds
    expect(cues.cuesInSync()).toBe(false)

    cues.cancelCues()
    expect(cues.cuesInSync()).toBe(true)
    cues.chime({ at: 9000 })
    advance(1000)
    context.currentTime += 1
    expect(cues.cuesInSync()).toBe(true)
  })

  it('allows 250 ms of drift and no more', async () => {
    const { cues, context, advance } = await booked()
    advance(1000)
    context.currentTime += 1.25
    expect(cues.cuesInSync()).toBe(true)
    context.currentTime += 0.01
    expect(cues.cuesInSync()).toBe(false)
  })

  it('takes the time to compare against, for a screen that already has it', async () => {
    const { cues, context } = await booked()
    context.currentTime += 2
    expect(cues.cuesInSync(3000)).toBe(true)
    expect(cues.cuesInSync(9000)).toBe(false)
  })

  it('is false while the audio is stopped', async () => {
    const { cues, context } = await booked()
    context.resumeWorks = false
    context.change('interrupted')
    expect(cues.cuesInSync()).toBe(false)
  })
})

describe('canVibrate', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  // A fresh module each time: the shared cues are built once, on first use.
  const load = () => import('../src/lib/audio-cues')

  it('is true where navigator.vibrate exists, and vibrate() reaches it', async () => {
    const patterns: (number | number[])[] = []
    vi.stubGlobal('navigator', { vibrate: (pattern: number | number[]) => (patterns.push(pattern), true) })
    const { canVibrate, vibrate } = await load()
    expect(canVibrate()).toBe(true)
    vibrate([200, 100, 200])
    expect(patterns).toEqual([[200, 100, 200]])
  })

  it('is false where navigator has no vibrate (iPhone browsers), and vibrate() is a no-op', async () => {
    vi.stubGlobal('navigator', {})
    const { canVibrate, vibrate } = await load()
    expect(canVibrate()).toBe(false)
    expect(() => vibrate(200)).not.toThrow()
  })

  it('is false where there is no navigator at all (server rendering)', async () => {
    vi.stubGlobal('navigator', undefined)
    const { canVibrate } = await load()
    expect(canVibrate()).toBe(false)
  })
})
