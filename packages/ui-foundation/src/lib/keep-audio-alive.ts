// Keeps a page's audio going with the phone locked (#217, #261). iOS pauses a
// page's sound on the lock screen unless the page is playing media, so
// keepAudioAlive() plays a silent looped track, which also puts the page's
// title and a Pause and Play on the lock screen (the Media Session). It's
// opt-in and off by default: it takes the device's audio session, which
// pauses another app's music (docs/foundation/timed-screens.md "Sound").
// Where Safari has an audio session (navigator.audioSession, iOS 17+) it's
// set to "playback" while the track runs, so the ringer switch doesn't mute
// the page's cues either, and put back on stop().
//
// The track is a few bytes of silence made here, so there is no file to
// ship. createKeepAudioAlive takes the browser's APIs, so the rules are
// unit tested against fakes (tests/keep-audio-alive.test.ts); the function
// exported below is one shared instance over the real ones.

export type KeepAudioAliveOptions = {
  /** Shown on the lock screen and in the control centre. */
  title: string
  /**
   * Called when the person presses Pause or Play on the lock screen or in the
   * control centre, with whether it's now playing: pause or resume the run.
   */
  onToggle?: (playing: boolean) => void
}

export type KeepAudioAlive = {
  /** Pauses the track and shows Play; `onToggle` isn't called. Call keepAudioAlive() from a click to start again. */
  pause: () => void
  /** Ends it and takes the title off the lock screen. */
  stop: () => void
}

export type KeepAudioAliveEnvironment = {
  Audio?: new (src?: string) => Pick<HTMLAudioElement, 'loop' | 'src' | 'play' | 'pause' | 'removeAttribute' | 'load'>
  mediaSession?: Pick<MediaSession, 'setActionHandler'> & { metadata: MediaMetadata | null; playbackState: MediaSessionPlaybackState }
  MediaMetadata?: new (init?: MediaMetadataInit) => MediaMetadata
  createObjectURL?: (blob: Blob) => string
  revokeObjectURL?: (url: string) => void
  /** Safari's `navigator.audioSession`, where it has one. */
  audioSession?: { type: string }
}

const SAMPLE_RATE = 8000
const SECONDS = 1

/** One second of silent 8-bit mono audio as a WAV file. */
export function silentWav(): Uint8Array {
  const samples = SAMPLE_RATE * SECONDS
  const bytes = new Uint8Array(44 + samples)
  const view = new DataView(bytes.buffer)
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i)
  }
  text(0, 'RIFF')
  view.setUint32(4, 36 + samples, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE, true) // bytes per second
  view.setUint16(32, 1, true) // bytes per frame
  view.setUint16(34, 8, true) // bits per sample
  text(36, 'data')
  view.setUint32(40, samples, true)
  // 8-bit PCM is unsigned: silence is the midpoint.
  bytes.fill(128, 44)
  return bytes
}

const NO_KEEP_ALIVE: KeepAudioAlive = { pause: () => {}, stop: () => {} }

export function createKeepAudioAlive(env: KeepAudioAliveEnvironment) {
  let active: KeepAudioAlive | null = null

  return function keepAudioAlive({ title, onToggle }: KeepAudioAliveOptions): KeepAudioAlive {
    active?.stop()
    if (!env.Audio || !env.createObjectURL) return NO_KEEP_ALIVE

    let url: string
    let audio: InstanceType<NonNullable<KeepAudioAliveEnvironment['Audio']>>
    try {
      url = env.createObjectURL(new Blob([silentWav() as BlobPart], { type: 'audio/wav' }))
      audio = new env.Audio(url)
    } catch {
      return NO_KEEP_ALIVE
    }
    audio.loop = true
    const session = env.mediaSession
    const audioSession = env.audioSession
    let typeBefore: string | null = null
    try {
      if (audioSession) {
        typeBefore = audioSession.type
        audioSession.type = 'playback'
      }
    } catch {
      // A type this Safari doesn't take: the silent track alone.
      typeBefore = null
    }

    const play = () => {
      // Refused without a click: the lock screen then shows nothing to keep.
      Promise.resolve(audio.play()).catch(() => {})
      if (session) session.playbackState = 'playing'
    }
    const pause = () => {
      audio.pause()
      if (session) session.playbackState = 'paused'
    }
    const handle = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        session?.setActionHandler(action, handler)
      } catch {
        // This browser doesn't offer the action.
      }
    }

    if (session) {
      try {
        if (env.MediaMetadata) session.metadata = new env.MediaMetadata({ title })
      } catch {
        // No metadata: the lock screen shows the page's own.
      }
      handle('play', () => {
        play()
        onToggle?.(true)
      })
      handle('pause', () => {
        pause()
        onToggle?.(false)
      })
    }
    play()

    const keeping: KeepAudioAlive = {
      pause,
      stop() {
        if (active !== keeping) return
        active = null
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
        env.revokeObjectURL?.(url)
        if (audioSession && typeBefore !== null) {
          try {
            audioSession.type = typeBefore
          } catch {
            // Left as playback: harmless once the track has stopped.
          }
        }
        if (session) {
          handle('play', null)
          handle('pause', null)
          session.metadata = null
          session.playbackState = 'none'
        }
      },
    }
    active = keeping
    return keeping
  }
}

let shared: ReturnType<typeof createKeepAudioAlive> | null = null

/**
 * Plays a silent looped track so iOS keeps the page's sound going with the
 * phone locked, with `title` and Pause and Play on the lock screen. Call it
 * from the click that starts the run, behind a setting that's off by default:
 * it pauses other apps' music. Where Safari has an audio session it's set to
 * "playback" meanwhile, so the ringer switch doesn't mute the cues. A no-op
 * where the browser can't play audio.
 */
export const keepAudioAlive = (options: KeepAudioAliveOptions): KeepAudioAlive => {
  if (!shared) {
    const hasWindow = typeof window !== 'undefined'
    shared = createKeepAudioAlive({
      Audio: hasWindow ? window.Audio : undefined,
      mediaSession: typeof navigator !== 'undefined' && 'mediaSession' in navigator ? navigator.mediaSession : undefined,
      MediaMetadata: hasWindow ? window.MediaMetadata : undefined,
      createObjectURL: typeof URL !== 'undefined' ? (blob) => URL.createObjectURL(blob) : undefined,
      revokeObjectURL: typeof URL !== 'undefined' ? (url) => URL.revokeObjectURL(url) : undefined,
      audioSession: typeof navigator !== 'undefined' ? (navigator as Navigator & { audioSession?: { type: string } }).audioSession : undefined,
    })
  }
  return shared(options)
}
