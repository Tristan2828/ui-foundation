// Sound cues for timed screens, with no audio files: a sine-tone chime
// (a short attack, a slow fade) from Web Audio, spoken lines from the
// browser's speech synthesis, and a vibration on Android.
//
// Browsers block sound until the person has clicked or tapped, so a
// session's start button calls unlockAudio() from its click; every cue
// before that is silently dropped rather than played late. Everything
// here is a no-op where the browser can't make the sound
// (docs/foundation/timed-screens.md "Sound").
//
// A chime can be booked ahead (`at`, #193): it's scheduled on the Web
// Audio clock, so it strikes on time in a background tab, whose timers
// and frames the browser slows or stops. cancelCues() takes back every
// booked strike that hasn't sounded yet (on pause, skip or leaving), so a
// screen rebooks from its new position.
//
// On iOS the audio clock stops whenever the context is interrupted (speech
// speaking, a call, the lock screen) and booked strikes go silent or late.
// The context is resumed as soon as it stops, and once it runs again every
// booking is taken back and onCuesRecovered() callbacks fire, so the screen
// rebooks from where its run is now (#217). cuesInSync() catches the case
// where no statechange came, by comparing the audio clock with Date.now().
//
// createAudioCues takes the browser's APIs, so the rules are unit tested
// against fakes (tests/audio-cues.test.ts); the functions exported below
// are one shared instance over the real ones.

export type ChimeOptions = {
  /** Frequency in Hz (default 660, an E5). */
  pitch?: number
  /** 0 to 1 at the chime's peak (default 0.25). */
  volume?: number
  /** Milliseconds from strike to silence (default 1200). */
  duration?: number
}

export type CueTime = {
  /**
   * When to strike, in `Date.now()` milliseconds, booked on the audio
   * clock so it's on time in a background tab. Left out, or already past,
   * it strikes now.
   */
  at?: number
}

export type SequenceOptions = CueTime & {
  /** Milliseconds between one chime's strike and the next's (default 180). */
  spacing?: number
}

/** A chime or sequence as booked. */
export type Cue = {
  /** Takes back its strikes that haven't sounded yet; one already sounding rings out. */
  cancel: () => void
}

export type SayOptions = {
  /** A BCP 47 tag; the browser's default voice when left out. */
  lang?: string
  /** 0.1 to 10 (default 1). */
  rate?: number
  /** 0 to 1 (default 1). */
  volume?: number
}

export type AudioCuesEnvironment = {
  AudioContext?: new () => AudioContext
  speechSynthesis?: Pick<SpeechSynthesis, 'speak' | 'cancel'>
  SpeechSynthesisUtterance?: new (text?: string) => SpeechSynthesisUtterance
  vibrate?: (pattern: number | number[]) => boolean
  /** The clock `at` is read on (default `Date.now`). */
  now?: () => number
  /** The page, for noticing it's visible again after the audio stopped. */
  document?: Pick<Document, 'addEventListener' | 'visibilityState'>
}

export type AudioCues = {
  /** Call from the click or tap that starts a session; sound is allowed from then on. */
  unlockAudio: () => void
  chime: (options?: ChimeOptions & CueTime) => Cue
  /** Several chimes in a row (a closing pair), `spacing` apart, from `at`. */
  sequence: (chimes: ChimeOptions[], options?: SequenceOptions) => Cue
  /** Takes back every booked strike that hasn't sounded yet. */
  cancelCues: () => void
  /**
   * Calls `callback` when the audio runs again after something stopped it (a
   * call, a notification, speech, the lock screen on iOS). The package has
   * already taken back every booked strike by then, since they would strike
   * late, so the callback books again from where the run is now. Returns the
   * unsubscribe.
   */
  onCuesRecovered: (callback: () => void) => () => void
  /**
   * False when the audio clock has drifted from `Date.now()` by more than
   * 250 ms since the bookings were made, or the audio is stopped: rebook
   * (`cancelCues()`, then book again). True when nothing is booked. Check it
   * on a tick, for where no recovery was announced. `now` is for tests.
   */
  cuesInSync: (now?: number) => boolean
  /** Speaks `text`, cutting off any line still being spoken. */
  say: (text: string, options?: SayOptions) => void
  /** Stops whatever is being spoken. */
  hush: () => void
  /** A vibration pattern in milliseconds; Android only, a no-op elsewhere. */
  vibrate: (pattern: number | number[]) => void
}

const ATTACK = 0.015
// An exponential ramp can't reach zero, so a chime starts and ends here.
const SILENT = 0.0001
// How far the audio clock may drift from Date.now() before cuesInSync() says so.
const SYNC_MARGIN = 250

type Strike = { start: number; end: number; oscillator: OscillatorNode; gain: GainNode }

const NO_CUE: Cue = { cancel: () => {} }

export function createAudioCues(env: AudioCuesEnvironment): AudioCues {
  const now = env.now ?? Date.now
  let context: AudioContext | null = null
  // Strikes booked and not yet over, so a cancel can reach them.
  const booked = new Set<Strike>()
  // A resume asked for from a click: the context is still "suspended" for
  // a moment, and a chime from that same click should still play.
  let resuming = false
  // Whether the context has run, and whether it has stopped since: a context
  // that never ran is just waiting for the click.
  let everRan = false
  let stopped = false
  let watchingPage = false
  const recovered = new Set<() => void>()
  // The audio clock against Date.now() when the first of the current bookings
  // was made, for cuesInSync().
  let anchor: { audio: number; wall: number } | null = null

  const playable = () => context !== null && (context.state === 'running' || resuming)

  const strike = (
    ctx: AudioContext,
    { pitch = 660, volume = 0.25, duration = 1200 }: ChimeOptions,
    delay: number,
  ): Strike => {
    const start = ctx.currentTime + Math.max(delay, 0) / 1000
    const end = start + Math.max(duration, 50) / 1000
    const peak = Math.min(Math.max(volume, SILENT), 1)
    const oscillator = ctx.createOscillator()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(pitch, start)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(SILENT, start)
    gain.gain.exponentialRampToValueAtTime(peak, start + ATTACK)
    gain.gain.exponentialRampToValueAtTime(SILENT, end)
    oscillator.connect(gain).connect(ctx.destination)
    oscillator.start(start)
    oscillator.stop(end + 0.05)
    const booking: Strike = { start, end, oscillator, gain }
    for (const old of booked) if (old.end < ctx.currentTime) booked.delete(old)
    if (booked.size === 0) anchor = { audio: ctx.currentTime, wall: now() }
    booked.add(booking)
    oscillator.onended = () => booked.delete(booking)
    return booking
  }

  // Silences a strike that hasn't sounded yet: one already sounding rings out,
  // unless `force`, for a clock that stood still (what was sounding is long over).
  const unbook = (ctx: AudioContext, booking: Strike, force = false) => {
    if (!booked.has(booking)) return
    if (!force && booking.start <= ctx.currentTime) return
    booked.delete(booking)
    try {
      booking.gain.disconnect()
      booking.oscillator.stop()
    } catch {
      // Already stopped.
    }
  }

  const book = (ctx: AudioContext, strikes: Strike[]): Cue => ({
    cancel: () => strikes.forEach((booking) => unbook(ctx, booking)),
  })

  const delayUntil = (at: number | undefined) => (at === undefined ? 0 : at - now())

  const resume = (ctx: AudioContext) => {
    try {
      Promise.resolve(ctx.resume()).catch(() => {})
    } catch {
      // Not allowed yet: the next click or return to the page tries again.
    }
  }

  // Safari's own "interrupted" isn't in the DOM types, hence the string.
  const stoppedState = (state: string) => state !== 'running' && state !== 'closed'

  // Called on every statechange, on the page becoming visible again and
  // after unlockAudio()'s resume: notices the audio stopping (and resumes
  // it) and running again (and says so).
  const check = () => {
    const ctx = context
    if (!ctx) return
    if (ctx.state === 'running') {
      everRan = true
      if (!stopped) return
      stopped = false
      for (const booking of [...booked]) unbook(ctx, booking, true)
      anchor = null
      for (const callback of [...recovered]) {
        try {
          callback()
        } catch {
          // One screen's callback failing mustn't keep the others from rebooking.
        }
      }
    } else if (everRan && stoppedState(ctx.state)) {
      stopped = true
      resume(ctx)
    }
  }

  const watch = (ctx: AudioContext) => {
    ctx.addEventListener?.('statechange', check)
    const page = env.document
    if (page && !watchingPage) {
      watchingPage = true
      page.addEventListener('visibilitychange', () => {
        if (page.visibilityState === 'visible') check()
      })
    }
  }

  return {
    unlockAudio() {
      if (env.AudioContext) {
        try {
          if (!context) {
            context = new env.AudioContext()
            watch(context)
          }
          check()
          if (context.state !== 'running' && context.state !== 'closed') {
            resuming = true
            const done = () => {
              resuming = false
              check()
            }
            context.resume().then(done, done)
          }
        } catch {
          context = null
        }
      }
      // iOS speaks only once speech has started from a gesture: a silent,
      // empty line here lets later cues through.
      if (env.speechSynthesis && env.SpeechSynthesisUtterance) {
        try {
          const primer = new env.SpeechSynthesisUtterance('')
          primer.volume = 0
          env.speechSynthesis.speak(primer)
        } catch {
          // No speech: say() stays a no-op.
        }
      }
    },
    chime({ at, ...options } = {}) {
      if (!playable() || !context) return NO_CUE
      return book(context, [strike(context, options, delayUntil(at))])
    },
    sequence(chimes, { spacing = 180, at } = {}) {
      if (!playable() || !context) return NO_CUE
      const ctx = context
      const delay = Math.max(delayUntil(at), 0)
      return book(
        ctx,
        chimes.map((options, index) => strike(ctx, options, delay + index * spacing)),
      )
    },
    cancelCues() {
      if (!context) return
      const ctx = context
      for (const booking of [...booked]) unbook(ctx, booking)
    },
    onCuesRecovered(callback) {
      recovered.add(callback)
      return () => void recovered.delete(callback)
    },
    cuesInSync(at = now()) {
      if (!context || !anchor || booked.size === 0) return true
      if (stopped) return false
      const audioElapsed = (context.currentTime - anchor.audio) * 1000
      return Math.abs(audioElapsed - (at - anchor.wall)) <= SYNC_MARGIN
    },
    say(text, { lang, rate, volume } = {}) {
      if (!env.speechSynthesis || !env.SpeechSynthesisUtterance) return
      try {
        env.speechSynthesis.cancel()
        const line = new env.SpeechSynthesisUtterance(text)
        if (lang) line.lang = lang
        if (rate !== undefined) line.rate = rate
        if (volume !== undefined) line.volume = volume
        env.speechSynthesis.speak(line)
      } catch {
        // Speech unavailable: the cue is dropped.
      }
    },
    hush() {
      try {
        env.speechSynthesis?.cancel()
      } catch {
        // Nothing to stop.
      }
    },
    vibrate(pattern) {
      try {
        env.vibrate?.(pattern)
      } catch {
        // No vibration motor, or not allowed here.
      }
    },
  }
}

/**
 * Whether this browser can vibrate: Android browsers can, iPhone browsers
 * can't. The same test vibrate() makes, so a Vibrate setting offered only
 * where this is true never sets something that does nothing. Read it once;
 * it doesn't change during a session.
 */
export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

let shared: AudioCues | null = null

function browserCues(): AudioCues {
  if (shared) return shared
  const win: (typeof window & { webkitAudioContext?: new () => AudioContext }) | undefined =
    typeof window === 'undefined' ? undefined : window
  shared = createAudioCues({
    AudioContext: win?.AudioContext ?? win?.webkitAudioContext,
    speechSynthesis: win?.speechSynthesis,
    SpeechSynthesisUtterance: win?.SpeechSynthesisUtterance,
    document: typeof document === 'undefined' ? undefined : document,
    vibrate: canVibrate() ? (pattern) => navigator.vibrate(pattern) : undefined,
  })
  return shared
}

/** Call from the click or tap that starts a session; sound is allowed from then on. */
export const unlockAudio: AudioCues['unlockAudio'] = () => browserCues().unlockAudio()
/**
 * A soft sine chime, now or booked `at` a `Date.now()` time; dropped before
 * unlockAudio() or where there's no Web Audio.
 */
export const chime: AudioCues['chime'] = (options) => browserCues().chime(options)
/** Several chimes `spacing` ms apart (a closing pair), now or from `at`. */
export const sequence: AudioCues['sequence'] = (chimes, options) => browserCues().sequence(chimes, options)
/** Takes back every booked chime that hasn't sounded yet: on pause, skip, back or leaving. */
export const cancelCues: AudioCues['cancelCues'] = () => browserCues().cancelCues()
/**
 * Calls back when the audio runs again after an interruption, with every
 * booked chime already taken back: book again from where the run is now.
 * Returns the unsubscribe (call it in an effect's cleanup).
 */
export const onCuesRecovered: AudioCues['onCuesRecovered'] = (callback) => browserCues().onCuesRecovered(callback)
/** False when booked chimes have drifted from `Date.now()` (or the audio is stopped): rebook. */
export const cuesInSync: AudioCues['cuesInSync'] = (now) => browserCues().cuesInSync(now)
/** Speaks a line, cutting off the one before. A no-op without speech synthesis. */
export const say: AudioCues['say'] = (text, options) => browserCues().say(text, options)
/** Stops whatever is being spoken. */
export const hush: AudioCues['hush'] = () => browserCues().hush()
/** A vibration pattern in ms; Android only, a no-op elsewhere. */
export const vibrate: AudioCues['vibrate'] = (pattern) => browserCues().vibrate(pattern)
