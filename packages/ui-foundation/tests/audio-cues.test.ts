// The audio cues (src/lib/audio-cues.ts) against a fake Web Audio and
// speech synthesis that record what they're asked: nothing sounds before
// unlockAudio(), a chime's envelope rises fast and fades slow, a sequence
// spaces its strikes, a new spoken line cuts off the last, and every cue
// is a no-op where the browser has no such API.
import { describe, expect, it } from 'vitest'
import { createAudioCues } from '../src/lib/audio-cues'

type Strike = { pitch: number; start: number; stop: number; gain: [string, number, number][] }

function fakeAudio(initialState: AudioContextState = 'suspended') {
  const contexts: FakeContext[] = []
  const strikes: Strike[] = []

  class FakeContext {
    state: AudioContextState = initialState
    currentTime = 10
    destination = {}
    resumes = 0
    // A chime makes its oscillator, then its gain: both record here.
    private building: Strike | null = null
    constructor() {
      contexts.push(this)
    }
    resume() {
      this.resumes++
      return Promise.resolve().then(() => {
        this.state = 'running'
      })
    }
    createOscillator() {
      const strike: Strike = { pitch: 0, start: 0, stop: 0, gain: [] }
      this.building = strike
      return {
        type: '',
        frequency: { setValueAtTime: (value: number) => (strike.pitch = value) },
        connect: (node: unknown) => node,
        start: (time: number) => {
          strike.start = time
          strikes.push(strike)
        },
        stop: (time: number) => (strike.stop = time),
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
      cues.sequence([{}, {}])
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
