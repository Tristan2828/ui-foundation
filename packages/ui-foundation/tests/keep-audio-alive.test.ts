// keepAudioAlive (src/lib/keep-audio-alive.ts, #217) against a fake audio
// element and Media Session that record what they're asked: a silent
// looped track plays, the lock screen gets the title and a Pause and Play
// that call back, pause() and stop() undo it, Safari's audio session is
// "playback" while it runs, and it's a no-op where the browser has no audio
// element.
import { describe, expect, it, vi } from 'vitest'
import { createKeepAudioAlive, silentWav } from '../src/lib/keep-audio-alive'

function fakeBrowser() {
  const audios: FakeAudio[] = []
  const handlers = new Map<string, (() => void) | null>()
  const revoked: string[] = []
  const session = {
    metadata: null as MediaMetadata | null,
    playbackState: 'none' as MediaSessionPlaybackState,
    setActionHandler: (action: string, handler: (() => void) | null) => void handlers.set(action, handler),
  }

  class FakeAudio {
    loop = false
    plays = 0
    pauses = 0
    src: string
    playResult: Promise<void> = Promise.resolve()
    constructor(src = '') {
      this.src = src
      audios.push(this)
    }
    play() {
      this.plays++
      return this.playResult
    }
    pause() {
      this.pauses++
    }
    removeAttribute() {
      this.src = ''
    }
    load() {}
  }
  class FakeMetadata {
    constructor(public init: { title?: string }) {}
  }

  const env = {
    Audio: FakeAudio as unknown as NonNullable<Parameters<typeof createKeepAudioAlive>[0]['Audio']>,
    mediaSession: session as unknown as NonNullable<Parameters<typeof createKeepAudioAlive>[0]['mediaSession']>,
    MediaMetadata: FakeMetadata as unknown as new (init?: MediaMetadataInit) => MediaMetadata,
    createObjectURL: () => 'blob:silence',
    revokeObjectURL: (url: string) => void revoked.push(url),
  }
  return { env, audios, handlers, session, revoked }
}

describe('silentWav', () => {
  it('is a valid mono 8-bit WAV of one second, all at the midpoint', () => {
    const bytes = silentWav()
    const text = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to))
    const view = new DataView(bytes.buffer)
    expect(text(0, 4)).toBe('RIFF')
    expect(text(8, 12)).toBe('WAVE')
    expect(text(36, 40)).toBe('data')
    expect(view.getUint32(4, true)).toBe(bytes.length - 8)
    expect(view.getUint32(40, true)).toBe(8000)
    expect(bytes.length).toBe(44 + 8000)
    expect(new Set(bytes.slice(44))).toEqual(new Set([128]))
  })
})

describe('keepAudioAlive', () => {
  it('plays a silent looped track and puts the title on the lock screen', () => {
    const { env, audios, session } = fakeBrowser()
    createKeepAudioAlive(env)({ title: 'Focus' })
    expect(audios).toHaveLength(1)
    expect(audios[0].src).toBe('blob:silence')
    expect(audios[0].loop).toBe(true)
    expect(audios[0].plays).toBe(1)
    expect((session.metadata as unknown as { init: { title: string } }).init.title).toBe('Focus')
    expect(session.playbackState).toBe('playing')
  })

  it("the lock screen's Pause and Play pause and play the track and call back", () => {
    const { env, audios, handlers, session } = fakeBrowser()
    const onToggle = vi.fn()
    createKeepAudioAlive(env)({ title: 'Focus', onToggle })

    handlers.get('pause')!()
    expect(audios[0].pauses).toBe(1)
    expect(session.playbackState).toBe('paused')
    expect(onToggle).toHaveBeenLastCalledWith(false)

    handlers.get('play')!()
    expect(audios[0].plays).toBe(2)
    expect(session.playbackState).toBe('playing')
    expect(onToggle).toHaveBeenLastCalledWith(true)
  })

  it('pause() pauses the track and shows Play, without calling onToggle', () => {
    const { env, audios, session } = fakeBrowser()
    const onToggle = vi.fn()
    createKeepAudioAlive(env)({ title: 'Focus', onToggle }).pause()
    expect(audios[0].pauses).toBe(1)
    expect(session.playbackState).toBe('paused')
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('stop() ends the track, frees it and clears the lock screen; a second stop() does nothing', () => {
    const { env, audios, handlers, session, revoked } = fakeBrowser()
    const keeping = createKeepAudioAlive(env)({ title: 'Focus' })
    keeping.stop()
    expect(audios[0].pauses).toBe(1)
    expect(audios[0].src).toBe('')
    expect(revoked).toEqual(['blob:silence'])
    expect(session.metadata).toBeNull()
    expect(session.playbackState).toBe('none')
    expect(handlers.get('play')).toBeNull()
    expect(handlers.get('pause')).toBeNull()
    keeping.stop()
    expect(audios[0].pauses).toBe(1)
    expect(revoked).toHaveLength(1)
  })

  it('starting again stops the one before, so only one track ever plays', () => {
    const { env, audios, revoked } = fakeBrowser()
    const keepAudioAlive = createKeepAudioAlive(env)
    const first = keepAudioAlive({ title: 'One' })
    keepAudioAlive({ title: 'Two' })
    expect(audios).toHaveLength(2)
    expect(audios[0].pauses).toBe(1)
    expect(revoked).toHaveLength(1)
    first.stop() // already ended: it must not end the second
    expect(audios[1].pauses).toBe(0)
  })

  it('a play the browser refuses is not an error', async () => {
    const { env, audios } = fakeBrowser()
    const FakeAudio = env.Audio
    env.Audio = class extends (FakeAudio as unknown as new () => { playResult: Promise<void> }) {
      constructor() {
        super()
        this.playResult = Promise.reject(new DOMException('Not allowed', 'NotAllowedError'))
      }
    } as unknown as typeof env.Audio
    expect(() => createKeepAudioAlive(env)({ title: 'Focus' })).not.toThrow()
    await Promise.resolve()
    expect(audios).toHaveLength(1)
  })

  it('works without a Media Session or metadata, and a handler the browser lacks is skipped', () => {
    const { env, audios, session } = fakeBrowser()
    session.setActionHandler = () => {
      throw new TypeError('unsupported action')
    }
    expect(() => createKeepAudioAlive(env)({ title: 'Focus' })).not.toThrow()
    expect(audios[0].plays).toBe(1)

    const bare = fakeBrowser()
    const keeping = createKeepAudioAlive({ ...bare.env, mediaSession: undefined })({ title: 'Focus' })
    expect(bare.audios[0].plays).toBe(1)
    expect(() => (keeping.pause(), keeping.stop())).not.toThrow()
  })

  it("sets Safari's audio session to playback while it runs and puts it back on stop()", () => {
    const { env } = fakeBrowser()
    const audioSession = { type: 'auto' }
    const keeping = createKeepAudioAlive({ ...env, audioSession })({ title: 'Focus' })
    expect(audioSession.type).toBe('playback')
    keeping.pause()
    expect(audioSession.type).toBe('playback')
    keeping.stop()
    expect(audioSession.type).toBe('auto')
  })

  it('an audio session that refuses the type is not an error', () => {
    const { env, audios } = fakeBrowser()
    const audioSession = {
      get type() {
        return 'auto'
      },
      set type(_value: string) {
        throw new TypeError('unsupported type')
      },
    }
    const keeping = createKeepAudioAlive({ ...env, audioSession })({ title: 'Focus' })
    expect(audios[0].plays).toBe(1)
    expect(() => keeping.stop()).not.toThrow()
  })

  it('is a no-op where the browser has no audio element', () => {
    const keeping = createKeepAudioAlive({})({ title: 'Focus' })
    expect(() => (keeping.pause(), keeping.stop())).not.toThrow()
  })
})
