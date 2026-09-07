/**
 * Mission audio.
 *
 * Every cue is synthesised at runtime — no files, no network, nothing to fail
 * on a judge's laptop. The whole module is about 150 lines and adds nothing to
 * the bundle but code.
 *
 * Two rules govern the design:
 *
 * 1. **Sound reports events, never decorates.** There is no ambience, no hum,
 *    no background bed. A tone means something happened: somebody was found,
 *    a unit stopped answering, the ground moved. If nothing is happening the
 *    room is silent, which is what makes the tones informative.
 * 2. **Quiet and short.** Peak gain is 0.12 and the longest cue is under a
 *    second. This has to be survivable for somebody demoing on a laptop
 *    speaker in a quiet room.
 *
 * Audio can only start after a user gesture — browsers require it and it is
 * also just good manners — so the context is created lazily on first
 * interaction and the mute state is remembered.
 */

export type Cue =
  | 'found' // a person located
  | 'dispute' // two units contradict each other
  | 'quake' // aftershock
  | 'linkLost' // a unit stops answering
  | 'linkBack' // a unit returns, carrying the past
  | 'resolve' // a dispute settled
  | 'tick' // small confirmation on a control

const STORE = 'cairn.muted'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = false

try {
  muted = localStorage.getItem(STORE) === '1'
} catch {
  /* private window; default to audible */
}

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.12
    master.connect(ctx.destination)
  }
  // Chrome suspends the context until a gesture; resume is a no-op otherwise.
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** One enveloped oscillator. `at` is an offset in seconds from now. */
function tone(
  freq: number,
  {
    at = 0,
    dur = 0.12,
    type = 'sine',
    gain = 1,
    glideTo,
  }: { at?: number; dur?: number; type?: OscillatorType; gain?: number; glideTo?: number } = {},
) {
  const c = ctx
  if (!c || !master) return
  const t0 = c.currentTime + at
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur)

  // Short attack, exponential tail: reads as a percussive report rather than a note.
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

  osc.connect(g).connect(master)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

/** Filtered noise burst — used for the ground moving. */
function rumble(dur = 0.7, gain = 0.9) {
  const c = ctx
  if (!c || !master) return
  const frames = Math.floor(c.sampleRate * dur)
  const buf = c.createBuffer(1, frames, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < frames; i++) {
    // Brown-ish noise: integrated white, which sits low without being a hum.
    data[i] = (data[i - 1] || 0) * 0.96 + (Math.random() * 2 - 1) * 0.08
  }
  const src = c.createBufferSource()
  src.buffer = buf
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 220
  const g = c.createGain()
  const t0 = c.currentTime
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.06)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(lp).connect(g).connect(master)
  src.start(t0)
  src.stop(t0 + dur)
}

export function play(cue: Cue) {
  if (muted) return
  if (!ensure()) return

  switch (cue) {
    // A person: rising, warm, the only cue that resolves upward twice.
    case 'found':
      tone(523.25, { dur: 0.1, gain: 0.7 })
      tone(659.25, { at: 0.08, dur: 0.16, gain: 0.6 })
      return
    // A contradiction: two dry knocks, deliberately unmusical.
    case 'dispute':
      tone(196, { dur: 0.07, type: 'triangle', gain: 0.8 })
      tone(185, { at: 0.11, dur: 0.07, type: 'triangle', gain: 0.8 })
      return
    case 'quake':
      rumble(0.8, 1)
      tone(70, { dur: 0.5, type: 'sine', gain: 0.5, glideTo: 46 })
      return
    // Losing a unit falls away; getting it back climbs.
    case 'linkLost':
      tone(392, { dur: 0.16, type: 'sine', gain: 0.55, glideTo: 262 })
      return
    case 'linkBack':
      tone(392, { dur: 0.1, gain: 0.5 })
      tone(523.25, { at: 0.09, dur: 0.1, gain: 0.5 })
      tone(783.99, { at: 0.18, dur: 0.22, gain: 0.45 })
      return
    case 'resolve':
      tone(587.33, { dur: 0.12, gain: 0.5 })
      tone(880, { at: 0.1, dur: 0.2, gain: 0.4 })
      return
    case 'tick':
      tone(1400, { dur: 0.03, type: 'square', gain: 0.16 })
      return
  }
}

export function isMuted() {
  return muted
}

export function setMuted(next: boolean) {
  muted = next
  try {
    localStorage.setItem(STORE, next ? '1' : '0')
  } catch {
    /* nothing to persist to; the session still respects the choice */
  }
  if (!next) {
    // Confirm audibly that sound is back on.
    ensure()
    play('tick')
  }
}

/** Called on the first real interaction so the context exists and is running. */
export function warm() {
  ensure()
}
