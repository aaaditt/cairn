import { useMemo } from 'react'
import { certainty, decayed, uncertaintyRadius } from '../../sim/decay'
import { GRID_H, GRID_W } from '../../sim/seed'
import type { Confidence, Robot } from '../../sim/types'
import { useMission } from '../../state/MissionProvider'

/**
 * The belief map.
 *
 * Not a picture of the district — a picture of what we currently believe about
 * the district. Certainty is drawn as MATERIAL (solid / stipple / hatch / void)
 * rather than as colour: it survives greyscale and colour blindness, and it
 * makes "we have not looked here" feel like absence instead of clear ground.
 * Colour in this view is reserved for risk alone.
 *
 * Opacity is continuous rather than stepped, so ground dims gradually as its
 * last observation ages instead of snapping a shade darker every fourteen
 * minutes. Watching the map fade is the argument the whole product is making.
 *
 * Plain SVG on purpose. A WebGL basemap renders nothing at all if anything
 * goes wrong on a judge's laptop, and hand-drawing the map is what makes this
 * encoding possible in the first place.
 */

const CELL = 26
const W = GRID_W * CELL
const H = GRID_H * CELL

/** Leader-line offset for a casualty rank badge, in SVG units. */
const OFF_X = 17
const OFF_Y = -17

/** Base tone by what the ground IS, before we account for how sure we are. */
/**
 * Base tone by what the ground IS, before we account for how sure we are.
 *
 * Kind is tested before passability on purpose. An earlier version checked
 * `!passable` first, which meant every intact building rendered in the rubble
 * tone - so a district that had barely been touched looked like it had
 * pancaked end to end. Standing and fallen must not look the same.
 */
function baseFill(kind: string, passable: boolean): string {
  if (kind === 'rubble') return '#4a3128'
  if (kind === 'street') return '#8a7f70'
  if (kind === 'plaza') return '#75695b'
  if (kind === 'block') return '#2f2822'
  return passable ? '#443a31' : '#2f2822'
}

/** In the age view, recency reads as warmth — fresh is bright, old is cold. */
function ageFill(minutes: number | null): string {
  if (minutes === null) return '#14110e'
  if (minutes < 2) return '#e8d9b8'
  if (minutes < 5) return '#b9a184'
  if (minutes < 10) return '#8a7259'
  if (minutes < 20) return '#5c4a3c'
  return '#382d26'
}

function Defs() {
  return (
    <defs>
      {/* inferred — pre-quake data nobody ever verified */}
      <pattern
        id="hatch"
        width="6"
        height="6"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <line x1="0" y1="0" x2="0" y2="6" stroke="#6b6055" strokeWidth="1.1" opacity="0.55" />
      </pattern>
      {/* reported — seen, but at distance and unverified */}
      <pattern id="stipple" width="4" height="4" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="0.75" fill="#8a7f72" opacity="0.5" />
      </pattern>
      {/* unknown — never observed by anything */}
      <pattern id="void" width="10" height="10" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="0.6" fill="#4a423a" opacity="0.55" />
      </pattern>
      {/* impassable */}
      <pattern
        id="rubble"
        width="5"
        height="5"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <line x1="0" y1="0" x2="0" y2="5" stroke="#e0565c" strokeWidth="1" opacity="0.34" />
      </pattern>
      <radialGradient id="hazardFade">
        <stop offset="0%" stopColor="#dc9a3f" stopOpacity="0.28" />
        <stop offset="100%" stopColor="#dc9a3f" stopOpacity="0" />
      </radialGradient>
    </defs>
  )
}

function texture(conf: Confidence): string | null {
  if (conf === 'inferred') return 'url(#hatch)'
  if (conf === 'reported') return 'url(#stipple)'
  if (conf === 'unknown') return 'url(#void)'
  return null
}

function RobotGlyph({ r, selected }: { r: Robot; selected: boolean }) {
  const s = 9
  const out = r.link === 'dark' || r.link === 'lost'
  const stroke = out ? '#9a8f80' : '#f4efe7'
  const fill = out ? 'none' : r.link === 'degraded' ? '#9a8f80' : '#f4efe7'
  const dash = r.link === 'degraded' ? '3 2' : out ? '2 2' : undefined

  const shape =
    r.cls === 'aerial' ? (
      <polygon points={`0,${-s} ${s * 0.9},${s * 0.7} ${-s * 0.9},${s * 0.7}`} />
    ) : r.cls === 'crawler' ? (
      <polygon points={`0,${-s} ${s},0 0,${s} ${-s},0`} />
    ) : r.cls === 'quadruped' ? (
      <polygon
        points={`${-s * 0.9},${-s * 0.6} ${s * 0.9},${-s * 0.6} ${s},${s * 0.6} ${-s},${s * 0.6}`}
      />
    ) : (
      <rect x={-s * 0.8} y={-s * 0.8} width={s * 1.6} height={s * 1.6} />
    )

  return (
    <g>
      {selected && <circle r={s + 7} fill="none" stroke="#f4efe7" strokeWidth="1.5" />}
      {/* a dark halo so a unit reads over any ground beneath it */}
      <circle r={s + 2} fill="#14110e" opacity="0.72" />
      <g fill={fill} stroke={stroke} strokeWidth="1.6" strokeDasharray={dash}>
        {shape}
      </g>
    </g>
  )
}

export function CityMap() {
  const {
    state,
    entries,
    setInspect,
    inspect,
    selectedRobot,
    setSelectedRobot,
    selectedSurvivor,
    setSelectedSurvivor,
    mapView,
    setMapView,
  } = useMission()

  const contestedCells = useMemo(() => {
    const m = new Set<string>()
    for (const f of state.contests) {
      if (f.resolution) continue
      for (const [x, y] of f.cells) m.add(`${x},${y}`)
    }
    return m
  }, [state.contests])

  const rank = useMemo(() => {
    const m = new Map<string, number>()
    entries.forEach((e, i) => m.set(e.survivor.id, i + 1))
    return m
  }, [entries])

  const showingAge = mapView === 'age'
  const openContests = state.contests.filter((c) => !c.resolution).length

  return (
    <div data-tour="map" className="relative h-full w-full overflow-hidden bg-[#0f0d0b]">
      {/* Two readings of the same data, overlaid on the map itself so the
          second one is actually findable. The age view is the decay argument
          made undeniable: it shows nothing but how old the picture is. */}
      <div className="absolute left-3 top-3 z-10 flex border border-[#3a342c] bg-[#17140f]/95">
        {(
          [
            ['belief', 'What is there'],
            ['age', 'How old it is'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setMapView(key)}
            aria-pressed={mapView === key}
            className={`px-2.5 py-1.5 text-[12px] transition-colors ${
              mapView === key
                ? 'bg-[#f4efe7] text-[#17140f] font-medium'
                : 'text-[#b9af9f] hover:bg-[#201c17]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {showingAge && (
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 border border-[#3a342c] bg-[#17140f]/95 px-2.5 py-1.5">
          <span className="text-[11.5px] text-[#9a8f80]">Observed</span>
          {[
            ['#e8d9b8', 'now'],
            ['#b9a184', '5 min'],
            ['#8a7259', '10 min'],
            ['#5c4a3c', '20 min'],
            ['#14110e', 'never'],
          ].map(([c, l]) => (
            <span key={l} className="flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 border border-[#3a342c]"
                style={{ background: c }}
              />
              <span className="tnum text-[11px] text-[#9a8f80]">{l}</span>
            </span>
          ))}
        </div>
      )}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-full w-full"
        role="img"
        aria-label={
          showingAge
            ? `Information age across Sector 4. Brighter ground was observed more recently.`
            : `Belief map of Sector 4. ${state.survivors.length} ${state.survivors.length === 1 ? "person" : "people"} located, ${openContests} ${openContests === 1 ? "fact" : "facts"} in dispute.`
        }
      >
        <Defs />
        <rect width={W} height={H} fill="#0f0d0b" />
        <rect
          x="0.5"
          y="0.5"
          width={W - 1}
          height={H - 1}
          fill="none"
          stroke="#3a342c"
          strokeWidth="1"
        />

        {/* ── ground ───────────────────────────────────────────────── */}
        <g>
          {state.grid.map((row) =>
            row.map((cell) => {
              const conf = decayed(cell.conf, cell.observedAt, state.now)
              const sure = certainty(cell, state.now)
              const tex = texture(conf)
              const contested = contestedCells.has(`${cell.x},${cell.y}`)
              const inspected = inspect?.x === cell.x && inspect?.y === cell.y
              const age = cell.observedAt === null ? null : state.now - cell.observedAt
              return (
                <g key={`${cell.x},${cell.y}`}>
                  <rect
                    x={cell.x * CELL}
                    y={cell.y * CELL}
                    width={CELL}
                    height={CELL}
                    fill={showingAge ? ageFill(age) : baseFill(cell.kind, cell.passable)}
                    opacity={showingAge ? 1 : sure}
                  />
                  {!showingAge && cell.kind === 'block' && (
                    <line
                      x1={cell.x * CELL}
                      y1={cell.y * CELL + 0.5}
                      x2={cell.x * CELL + CELL}
                      y2={cell.y * CELL + 0.5}
                      stroke="#6d6154"
                      strokeWidth="1"
                      opacity={sure * 0.55}
                      pointerEvents="none"
                    />
                  )}
                  {!showingAge && tex && (
                    <rect
                      x={cell.x * CELL}
                      y={cell.y * CELL}
                      width={CELL}
                      height={CELL}
                      fill={tex}
                      pointerEvents="none"
                    />
                  )}
                  {!showingAge && cell.kind === 'rubble' && (
                    <rect
                      x={cell.x * CELL}
                      y={cell.y * CELL}
                      width={CELL}
                      height={CELL}
                      fill="url(#rubble)"
                      pointerEvents="none"
                    />
                  )}
                  {contested && (
                    <rect
                      x={cell.x * CELL + 1}
                      y={cell.y * CELL + 1}
                      width={CELL - 2}
                      height={CELL - 2}
                      fill="none"
                      stroke="#dc9a3f"
                      strokeWidth="1.4"
                      strokeDasharray="4 3"
                      pointerEvents="none"
                    />
                  )}
                  {inspected && (
                    <rect
                      x={cell.x * CELL}
                      y={cell.y * CELL}
                      width={CELL}
                      height={CELL}
                      fill="none"
                      stroke="#f4efe7"
                      strokeWidth="2"
                      pointerEvents="none"
                    />
                  )}
                  <rect
                    x={cell.x * CELL}
                    y={cell.y * CELL}
                    width={CELL}
                    height={CELL}
                    fill="transparent"
                    className="cursor-crosshair"
                    onClick={() => setInspect({ x: cell.x, y: cell.y })}
                  />
                </g>
              )
            }),
          )}
        </g>

        {/* ── hazards ──────────────────────────────────────────────── */}
        <g pointerEvents="none">
          {state.hazards.map((h) => (
            <g key={h.id} transform={`translate(${h.x * CELL + CELL / 2} ${h.y * CELL + CELL / 2})`}>
              <circle r={h.radius * CELL} fill="url(#hazardFade)" />
              <circle
                r={h.radius * CELL}
                fill="none"
                stroke="#dc9a3f"
                strokeWidth="1"
                strokeDasharray={h.kind === 'collapse' ? '2 3' : '5 4'}
                opacity="0.6"
              />
              <polygon points="0,-8 7,5 -7,5" fill="#14110e" stroke="#dc9a3f" strokeWidth="1.6" />
              <text y="4" textAnchor="middle" fontSize="8" fill="#dc9a3f" fontWeight="700">
                !
              </text>
            </g>
          ))}
        </g>

        {/* ── assigned routes ──────────────────────────────────────── */}
        <g pointerEvents="none">
          {entries.map((e) =>
            e.survivor.assignedTo && e.bestRobot ? (
              <line
                key={`r-${e.survivor.id}`}
                x1={e.bestRobot.x * CELL + CELL / 2}
                y1={e.bestRobot.y * CELL + CELL / 2}
                x2={e.survivor.x * CELL + CELL / 2}
                y2={e.survivor.y * CELL + CELL / 2}
                stroke="#f4efe7"
                strokeWidth="1.4"
                strokeDasharray="6 4"
                opacity="0.5"
              />
            ) : null,
          )}
        </g>

        {/* ── units, with honest uncertainty ───────────────────────── */}
        <g>
          {state.robots.map((r, i) => {
            const rad = uncertaintyRadius(r, state.now)
            const labelY = i % 2 === 0 ? 22 : -15
            return (
              <g key={r.id} transform={`translate(${r.x * CELL + CELL / 2} ${r.y * CELL + CELL / 2})`}>
                {rad > 0.05 && (
                  <>
                    <circle r={rad * CELL} fill="#9a8f80" opacity="0.08" />
                    <circle
                      r={rad * CELL}
                      fill="none"
                      stroke="#9a8f80"
                      strokeWidth="1.2"
                      strokeDasharray="4 5"
                      opacity="0.7"
                    />
                  </>
                )}
                <g
                  className="cursor-pointer"
                  onClick={() => setSelectedRobot(selectedRobot === r.id ? null : r.id)}
                >
                  <RobotGlyph r={r} selected={selectedRobot === r.id} />
                  <text
                    y={labelY}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#b9af9f"
                    className="font-mono"
                    stroke="#14110e"
                    strokeWidth="2.6"
                    paintOrder="stroke"
                  >
                    {r.name}
                  </text>
                </g>
              </g>
            )
          })}
        </g>

        {/* ── people, ranked ───────────────────────────────────────── */}
        <g>
          {state.survivors.map((s) => {
            const n = rank.get(s.id) ?? 0
            const isTop = n === 1
            const sel = selectedSurvivor === s.id
            return (
              <g
                key={s.id}
                transform={`translate(${s.x * CELL + CELL / 2} ${s.y * CELL + CELL / 2})`}
                className="cursor-pointer"
                onClick={() => setSelectedSurvivor(sel ? null : s.id)}
              >
                {/* The casualty sits at the exact cell; the rank badge is offset
                    on a leader line so it never collides with a unit glyph in an
                    adjacent cell. Keeps the position honest. */}
                <circle r="3" fill={isTop ? '#e0565c' : '#dc9a3f'} />
                <line
                  x1="2"
                  y1="-2"
                  x2={OFF_X - 8}
                  y2={OFF_Y + 8}
                  stroke={isTop ? '#e0565c' : '#dc9a3f'}
                  strokeWidth="1.2"
                  opacity="0.75"
                />
                <g transform={`translate(${OFF_X} ${OFF_Y})`}>
                  {sel && <circle r="18" fill="none" stroke="#f4efe7" strokeWidth="1.5" />}
                  {s.status === 'assigned' && (
                    <circle
                      r="16"
                      fill="none"
                      stroke="#62ab82"
                      strokeWidth="1.4"
                      strokeDasharray="3 3"
                    />
                  )}
                  <circle r="12" fill="#14110e" stroke={isTop ? '#e0565c' : '#dc9a3f'} strokeWidth="2.6" />
                  {/* the rank numeral: ordering is legible with no colour at all */}
                  <text
                    y="4.4"
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="600"
                    fill={isTop ? '#e0565c' : '#f4efe7'}
                  >
                    {n}
                  </text>
                </g>
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
