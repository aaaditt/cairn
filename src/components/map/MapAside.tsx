import { ageLabel, certainty, decayed, minutesToDecay } from '../../sim/decay'
import { useMission } from '../../state/MissionProvider'
import { Label } from '../shell/ui'

/**
 * The key, and the provenance inspector.
 *
 * The key is not decoration. If certainty is encoded as material and units are
 * encoded as shape, the key to that encoding has to be permanently on screen —
 * hidden behind a help icon it becomes a private joke between the designer and
 * the data. The inspector answers the question every operator asks about any
 * patch of a disaster map: who says so, and when did they say it?
 */

const GROUND = [
  { label: 'Confirmed', hint: 'A unit physically went there', pattern: null, alpha: 1 },
  { label: 'Reported', hint: 'Seen from a distance, unverified', pattern: 'url(#kStipple)', alpha: 0.58 },
  { label: 'Inferred', hint: 'Pre-quake city data, never checked', pattern: 'url(#kHatch)', alpha: 0.36 },
  { label: 'Unknown', hint: 'Nothing has ever looked here', pattern: 'url(#kVoid)', alpha: 0.12 },
]

function KeyPatterns() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <defs>
        <pattern id="kHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#6b6055" strokeWidth="1.1" opacity="0.55" />
        </pattern>
        <pattern id="kStipple" width="4" height="4" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.75" fill="#8a7f72" opacity="0.5" />
        </pattern>
        <pattern id="kVoid" width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.6" fill="#4a423a" opacity="0.55" />
        </pattern>
      </defs>
    </svg>
  )
}

/** Unit glyphs, so shape is a real encoding rather than a private one. */
const GLYPHS = [
  { d: <polygon points="11,3 19,17 3,17" />, label: 'Aerial scout' },
  { d: <polygon points="11,3 19,11 11,19 3,11" />, label: 'Crawler' },
  { d: <polygon points="3,6 19,6 20,16 2,16" />, label: 'Quadruped' },
  { d: <rect x="4" y="4" width="14" height="14" />, label: 'Tracked rover' },
]

function Key() {
  return (
    <div data-tour="legend" className="space-y-3 border-b border-[#2b2620] px-3.5 py-3">
      <KeyPatterns />

      <div className="space-y-1.5">
        <Label>How sure we are</Label>
        <ul className="space-y-1.5">
          {GROUND.map((g) => (
            <li key={g.label} className="flex items-start gap-2.5">
              <svg width="22" height="22" className="mt-px shrink-0 border border-[#3a342c]" aria-hidden="true">
                <rect width="22" height="22" fill="#8a7f70" opacity={g.alpha} />
                {g.pattern && <rect width="22" height="22" fill={g.pattern} />}
              </svg>
              <span className="min-w-0">
                <span className="block text-[12.5px] leading-tight text-[#e8e1d6]">{g.label}</span>
                <span className="block text-[11.5px] leading-snug text-[#9a8f80]">{g.hint}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="pt-1 text-[11.5px] leading-relaxed text-[#9a8f80]">
          Ground fades as its last look ages. Nobody re-checks it for you.
        </p>
      </div>

      <div className="space-y-1.5 border-t border-[#2b2620] pt-3">
        <Label>What the marks mean</Label>
        <ul className="grid grid-cols-2 gap-x-2 gap-y-1.5">
          {GLYPHS.map((g) => (
            <li key={g.label} className="flex items-center gap-1.5">
              <svg width="22" height="22" className="shrink-0" fill="#f4efe7" aria-hidden="true">
                {g.d}
              </svg>
              <span className="text-[11.5px] leading-tight text-[#9a8f80]">{g.label}</span>
            </li>
          ))}
        </ul>
        <ul className="space-y-1.5 pt-1">
          <li className="flex items-center gap-1.5">
            <svg width="22" height="22" className="shrink-0" aria-hidden="true">
              <circle cx="11" cy="11" r="8" fill="none" stroke="#e0565c" strokeWidth="2.2" />
            </svg>
            <span className="text-[11.5px] leading-tight text-[#9a8f80]">
              A person, numbered by triage order
            </span>
          </li>
          <li className="flex items-center gap-1.5">
            <svg width="22" height="22" className="shrink-0" aria-hidden="true">
              <circle cx="11" cy="11" r="9" fill="none" stroke="#9a8f80" strokeWidth="1.2" strokeDasharray="3 3" />
            </svg>
            <span className="text-[11.5px] leading-tight text-[#9a8f80]">
              Where a silent unit might be
            </span>
          </li>
          <li className="flex items-center gap-1.5">
            <svg width="22" height="22" className="shrink-0" aria-hidden="true">
              <rect x="2" y="2" width="18" height="18" fill="none" stroke="#dc9a3f" strokeWidth="1.4" strokeDasharray="4 3" />
            </svg>
            <span className="text-[11.5px] leading-tight text-[#9a8f80]">Ground in dispute</span>
          </li>
        </ul>
      </div>
    </div>
  )
}

function Inspector() {
  const { inspect, state } = useMission()

  if (!inspect) {
    return (
      <div className="px-3.5 py-3">
        <Label>Where does this come from?</Label>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#9a8f80]">
          Click anywhere on the map to see who reported that ground and how long ago.
        </p>
      </div>
    )
  }

  const cell = state.grid[inspect.y]?.[inspect.x]
  if (!cell) return null
  const conf = decayed(cell.conf, cell.observedAt, state.now)
  const left = minutesToDecay(cell, state.now)
  const sure = certainty(cell, state.now)
  const contested = state.contests.find(
    (f) => !f.resolution && f.cells.some(([x, y]) => x === inspect.x && y === inspect.y),
  )

  return (
    <div className="px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <Label>Where does this come from?</Label>
        <span className="tnum font-mono text-[11px] text-[#9a8f80]">
          {inspect.x}, {inspect.y}
        </span>
      </div>

      <dl className="mt-2.5 space-y-1.5 text-[12.5px]">
        <div className="flex justify-between gap-2">
          <dt className="text-[#9a8f80]">We believe</dt>
          <dd className="text-[#f4efe7]">{conf}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[#9a8f80]">Can we cross it</dt>
          <dd style={{ color: cell.passable ? '#62ab82' : '#e0565c' }}>
            {cell.passable ? 'yes' : 'no'}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[#9a8f80]">Who says so</dt>
          <dd className="font-mono text-[11.5px] text-[#f4efe7]">{cell.observedBy ?? 'nobody'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[#9a8f80]">Last looked</dt>
          <dd className="text-[#f4efe7]">{ageLabel(cell.observedAt, state.now)}</dd>
        </div>
      </dl>

      {left !== null && (
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11.5px] text-[#9a8f80]">Downgrades in</span>
            <span className="tnum text-[11.5px] text-[#dc9a3f]">{left} min</span>
          </div>
          <div className="mt-1.5 h-[3px] w-full overflow-hidden bg-[#2b2620]">
            <div className="h-full bg-[#dc9a3f]" style={{ width: `${(1 - sure) * 100}%` }} />
          </div>
        </div>
      )}

      {contested && (
        <p className="mt-3 border-l-2 border-[#dc9a3f] pl-2.5 text-[11.5px] leading-relaxed text-[#dc9a3f]">
          Two units disagree about this ground. Every route treats it as blocked until somebody
          settles it.
        </p>
      )}
    </div>
  )
}

export function MapAside() {
  return (
    <aside className="flex flex-1 flex-col border-t border-[#2b2620] bg-[#17140f]">
      <Key />
      <Inspector />
    </aside>
  )
}
