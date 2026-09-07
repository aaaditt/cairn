import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { play } from './audio'
import { useMission } from '../state/MissionProvider'
import type { Cue } from './audio'

/**
 * The walkthrough.
 *
 * A command deck has a lot on it, and the fastest way to lose somebody is to
 * hand them a page of prose and hope. So this shows one thing at a time, on
 * the real interface, with the incident wound to the moment that makes the
 * point.
 *
 * Constraints that keep it from becoming the thing it is trying to fix:
 *
 * - **One sentence per step.** If a step needs two, the step is wrong.
 * - **Seven steps.** Long enough to cover the four ideas, short enough that
 *   nobody feels trapped.
 * - **Skippable from the first frame**, and it never runs twice.
 *
 * The spotlight is a single box shadow spread far enough to cover the
 * viewport, which dims everything except the element being discussed without
 * needing a mask, a portal, or a second render tree.
 */

interface Step {
  /** Element to spotlight, matched on `data-tour`. Centre-screen if omitted. */
  target?: string
  /** Mission minute to wind the incident to. */
  at: number
  title: string
  line: string
  cue?: Cue
}

const STEPS: Step[] = [
  {
    target: 'map',
    at: 0,
    title: 'This is a belief, not a map',
    line: 'Six robots, one district. Almost none of it has actually been seen.',
  },
  {
    target: 'legend',
    at: 0,
    title: 'Texture is trust',
    line: 'Solid means somebody stood there. Hatched means nobody has ever been.',
  },
  {
    target: 'triage',
    at: 2,
    title: 'Somebody is found',
    line: 'Discoveries queue up to be ranked — never a popup that disappears.',
    cue: 'found',
  },
  {
    target: 'dispute',
    at: 4,
    title: 'The robots disagree',
    line: 'One says the street is clear, one says it is blocked. You decide.',
    cue: 'dispute',
  },
  {
    target: 'verified',
    at: 6,
    title: 'An aftershock hits',
    line: 'Everything we had confirmed just became a rumour again.',
    cue: 'quake',
  },
  {
    target: 'fleet',
    at: 8,
    title: 'A robot goes quiet',
    line: 'It stays on the map, and your orders wait instead of failing.',
    cue: 'linkLost',
  },
  {
    target: 'comms',
    at: 11,
    title: 'It comes back',
    line: 'Three minutes of the past arrive at once, and settle the argument.',
    cue: 'linkBack',
  },
]

const SEEN = 'cairn.tour'
const PAD = 8

type Rect = { top: number; left: number; width: number; height: number }

export function hasSeenTour() {
  try {
    return localStorage.getItem(SEEN) === '1'
  } catch {
    return false
  }
}

export function Tour({ onDone }: { onDone: () => void }) {
  const { setNow, setPlaying } = useMission()
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const step = STEPS[i]
  const last = i === STEPS.length - 1

  const finish = useCallback(() => {
    try {
      localStorage.setItem(SEEN, '1')
    } catch {
      /* nothing to persist to */
    }
    setPlaying(true)
    onDone()
  }, [onDone, setPlaying])

  // Wind the incident to this step's moment and hold it there.
  useEffect(() => {
    setPlaying(false)
    setNow(step.at)
    if (step.cue) {
      const h = window.setTimeout(() => play(step.cue!), 220)
      return () => window.clearTimeout(h)
    }
  }, [step, setNow, setPlaying])

  // Measure after paint, and keep measuring briefly: the panels re-flow when
  // the mission clock moves, so a single measurement can land on stale layout.
  useLayoutEffect(() => {
    let raf = 0
    let tries = 0
    const measure = () => {
      if (!step.target) {
        setRect(null)
      } else {
        // The fleet list and the key are rendered twice — once in the desktop
        // rail, once in the stacked mobile column — and one of the two is
        // always display:none. Taking the first match would spotlight a 0x0
        // box in the corner on a phone, so pick the copy that is laid out.
        const all = Array.from(
          document.querySelectorAll<HTMLElement>(`[data-tour="${step.target}"]`),
        )
        const el = all.find((n) => {
          const r = n.getBoundingClientRect()
          return r.width > 0 && r.height > 0
        })
        if (el) {
          const r = el.getBoundingClientRect()
          // Bring it into view on narrow screens, where the target may be far
          // below the fold. Ignored when it is already visible.
          if (r.top < 0 || r.bottom > window.innerHeight) {
            el.scrollIntoView({ block: 'center', behavior: 'smooth' })
          }
          const r2 = el.getBoundingClientRect()
          setRect({ top: r2.top, left: r2.left, width: r2.width, height: r2.height })
        } else {
          setRect(null)
        }
      }
      if (tries++ < 40) raf = requestAnimationFrame(measure)
    }
    measure()
    const onResize = () => {
      tries = 0
      measure()
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [step])

  const next = useCallback(() => {
    play('tick')
    if (last) finish()
    else setI((n) => n + 1)
  }, [last, finish])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        next()
      }
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1))
    }
    window.addEventListener('keydown', onKey)
    cardRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [next, finish])

  // Place the card in whichever gap around the spotlight actually fits.
  //
  // The naive "below, else above" rule breaks on a target the size of the map:
  // there is no gap on any side, so the card lands on top of the very thing it
  // is pointing at. When nothing fits outside, it sits inside the spotlight
  // instead and reads as an annotation on it.
  const vw = typeof window === 'undefined' ? 1200 : window.innerWidth
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight
  const CARD_W = Math.min(320, vw - 32)
  const CARD_H = 190
  const M = 16

  const clampX = (x: number) => Math.min(Math.max(M, x), vw - CARD_W - M)
  const clampY = (y: number) => Math.min(Math.max(M, y), vh - CARD_H - M)

  let cardStyle: React.CSSProperties = {
    left: clampX(vw / 2 - CARD_W / 2),
    top: clampY(vh / 2 - CARD_H / 2),
  }

  if (rect) {
    const gapBelow = vh - (rect.top + rect.height)
    const gapAbove = rect.top
    const gapRight = vw - (rect.left + rect.width)
    const gapLeft = rect.left

    if (gapBelow > CARD_H + 24) {
      cardStyle = { left: clampX(rect.left), top: clampY(rect.top + rect.height + 14) }
    } else if (gapAbove > CARD_H + 24) {
      cardStyle = { left: clampX(rect.left), top: clampY(rect.top - CARD_H - 14) }
    } else if (gapRight > CARD_W + 24) {
      cardStyle = {
        left: clampX(rect.left + rect.width + 14),
        top: clampY(rect.top + rect.height / 2 - CARD_H / 2),
      }
    } else if (gapLeft > CARD_W + 24) {
      cardStyle = {
        left: clampX(rect.left - CARD_W - 14),
        top: clampY(rect.top + rect.height / 2 - CARD_H / 2),
      }
    } else {
      // Nothing fits beside it: annotate from inside, bottom-left of the target.
      cardStyle = {
        left: clampX(rect.left + 20),
        top: clampY(rect.top + rect.height - CARD_H - 20),
      }
    }
  }

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Guided walkthrough">
      {/* Spotlight: one element, one huge spread shadow, everything else dims. */}
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-[3px] transition-all duration-300 ease-out"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(10,8,7,0.76)',
            outline: '1.5px solid rgba(244,239,231,0.55)',
          }}
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[rgba(10,8,7,0.76)]" />
      )}

      {/* Click-through guard so the deck cannot be poked mid-explanation. */}
      <div className="absolute inset-0" onClick={next} />

      <div
        ref={cardRef}
        tabIndex={-1}
        className="absolute max-w-[calc(100vw-32px)] border border-[#3a342c] bg-[#17140f] p-4 shadow-2xl transition-all duration-300 ease-out"
        style={{ ...cardStyle, width: CARD_W }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, n) => (
            <span
              key={n}
              className="h-[3px] flex-1 rounded-full transition-colors"
              style={{ background: n <= i ? '#f4efe7' : '#3a342c' }}
            />
          ))}
        </div>

        <h2 className="mt-3.5 text-[15px] font-semibold leading-snug text-[#f4efe7]">
          {step.title}
        </h2>
        <p className="mt-1.5 text-[13px] leading-[1.6] text-[#b9af9f]">{step.line}</p>

        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={finish}
            className="text-[12.5px] text-[#9a8f80] underline-offset-2 hover:text-[#e8e1d6] hover:underline"
          >
            Skip
          </button>
          <button
            onClick={next}
            className="bg-[#f4efe7] px-3.5 py-1.5 text-[12.5px] font-medium text-[#17140f] transition-colors hover:bg-white"
          >
            {last ? 'Take over' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
