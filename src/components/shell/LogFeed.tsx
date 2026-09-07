import { useMission } from '../../state/MissionProvider'
import { Empty, Panel } from './ui'

/**
 * The log reads in arrival order, not occurrence order, because that is the
 * order a commander actually lived through the incident. Anything delivered
 * late is stamped with both clocks, so nobody can later claim Command knew
 * something at the moment it happened.
 */
export function LogFeed() {
  const { state } = useMission()

  const tone = { info: '#b9af9f', warn: '#dc9a3f', good: '#62ab82' }
  const late = state.log.filter((l) => l.backfilled).length

  return (
    <Panel
      grow
      tour="comms"
      title="Comms"
      meta={late > 0 ? `${state.log.length} received, ${late} late` : `${state.log.length} received`}
    >
      {state.log.length === 0 ? (
        <Empty>Nothing has come in yet.</Empty>
      ) : (
        <ol>
          {state.log.map((l, i) => (
            <li
              key={`${l.known}-${l.t}-${i}`}
              className={`border-b border-[#2b2620] px-3.5 py-2.5 ${i === 0 ? 'landed' : ''}`}
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="tnum shrink-0 font-mono text-[11px] text-[#9a8f80]">
                  T+{l.known.toFixed(1)}
                </span>
                {l.backfilled && (
                  <span className="tnum shrink-0 border border-[#dc9a3f]/55 px-1.5 text-[10.5px] leading-tight text-[#dc9a3f]">
                    happened at T+{l.t.toFixed(1)}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: tone[l.tone] }}>
                {l.text}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}
