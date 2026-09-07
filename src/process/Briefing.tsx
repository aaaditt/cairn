import { useMemo } from 'react'
import { stateAt } from '../sim/reducer'
import { GRID_H, GRID_W } from '../sim/seed'

/**
 * The way in.
 *
 * An earlier version of this screen explained the three mechanics in prose
 * before letting anybody through. The walkthrough now does that job properly —
 * one idea at a time, on the real interface — so the prose came out. What is
 * left is the premise, the picture, and a way in.
 *
 * The picture is not a render. It is the real mission state folded to eleven
 * minutes and drawn as information age: every patch six units have observed,
 * and nothing else. The emptiness is the whole argument, and it does not need
 * a caption to land.
 */

const CELL = 8

function ageFill(minutes: number | null): string {
  if (minutes === null) return '#131110'
  if (minutes < 2) return '#efe0bd'
  if (minutes < 5) return '#c0a888'
  if (minutes < 10) return '#8d745b'
  if (minutes < 20) return '#5e4c3e'
  return '#3a2f28'
}

function SeenSoFar() {
  const grid = useMemo(() => stateAt(11).grid, [])
  const W = GRID_W * CELL
  const H = GRID_H * CELL

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label="Everything six robots have observed after eleven minutes: a few scattered patches in an otherwise unseen district."
    >
      <rect width={W} height={H} fill="#0f0d0b" />
      {grid.map((row) =>
        row.map((c) => (
          <rect
            key={`${c.x},${c.y}`}
            x={c.x * CELL}
            y={c.y * CELL}
            width={CELL}
            height={CELL}
            fill={ageFill(c.observedAt === null ? null : 11 - c.observedAt)}
          />
        )),
      )}
      <rect x="0.5" y="0.5" width={W - 1} height={H - 1} fill="none" stroke="#3a342c" />
    </svg>
  )
}

export function Briefing({
  onEnter,
  tourSeen,
}: {
  onEnter: (withTour: boolean) => void
  tourSeen: boolean
}) {
  return (
    <main className="flex min-h-full items-center bg-[#0f0d0b]">
      <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
        <div className="max-w-lg">
          <p className="text-[14px] font-semibold tracking-[0.32em] text-[#f4efe7]">CAIRN</p>

          <h1 className="mt-6 text-[34px] font-semibold leading-[1.12] text-[#f4efe7] sm:text-[40px]">
            Command a rescue swarm through a city you cannot see.
          </h1>

          <p className="mt-5 text-[15px] leading-[1.7] text-[#b9af9f]">
            Six robots are working a collapsed district. The map is mostly a guess and the radio
            keeps dropping. Your job is not to drive them — it is to decide what to believe.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onEnter(true)}
              className="bg-[#f4efe7] px-5 py-3 text-[14px] font-medium text-[#17140f] transition-colors hover:bg-white"
            >
              {tourSeen ? 'Replay the walkthrough' : 'Show me around'}
            </button>
            <button
              onClick={() => onEnter(false)}
              className="border border-[#3a342c] px-5 py-3 text-[14px] text-[#e8e1d6] transition-colors hover:border-[#554d43] hover:bg-[#201c17]"
            >
              Skip to the deck
            </button>
          </div>

          <p className="mt-4 text-[12.5px] leading-relaxed text-[#9a8f80]">
            Seven steps, about a minute. Or skip it and watch the incident play itself.
          </p>
        </div>

        <div>
          <SeenSoFar />
          <p className="mt-4 text-[13px] leading-[1.65] text-[#9a8f80]">
            <span className="text-[#e8e1d6]">Eleven minutes in, this is everything seen so far.</span>{' '}
            Bright was moments ago, dim was minutes ago, black is nobody has ever been.
          </p>
        </div>
      </div>
    </main>
  )
}
