import { ageLabel } from '../../sim/decay'
import type { TriageEntry } from '../../sim/scoring'
import { useMission } from '../../state/MissionProvider'
import { Button, Empty, Label, Meter, Panel, Tag } from '../shell/ui'

/**
 * Triage, not notifications.
 *
 * Discoveries arrive here as candidates that must be triaged in — they never
 * appear as a toast that steals focus and then disappears carrying the only
 * copy of the information. The ranking shows its arithmetic, because a
 * commander cannot act on a number they do not believe, and it shows what
 * would change it, because that is what turns an argument about a street into
 * a decision about a person.
 */

function Row({ entry, index }: { entry: TriageEntry; index: number }) {
  const { selectedSurvivor, setSelectedSurvivor, assign, state } = useMission()
  const s = entry.survivor
  const open = selectedSurvivor === s.id
  const isTop = index === 0
  // Anything received in the last few seconds of mission time marks itself once.
  const fresh = state.now - s.detectedAt < 0.5

  return (
    <article
      className={`border-b border-[#2b2620] ${open ? 'bg-[#201c17]' : ''} ${fresh ? 'landed' : ''}`}
    >
      <button
        onClick={() => setSelectedSurvivor(open ? null : s.id)}
        className="flex w-full items-start gap-3 px-3.5 py-3 text-left hover:bg-[#201c17]"
        aria-expanded={open}
      >
        <span
          className="tnum mt-px flex h-[26px] w-[26px] shrink-0 items-center justify-center border text-[13px] font-semibold"
          style={{
            borderColor: isTop ? '#e0565c' : '#3a342c',
            color: isTop ? '#e0565c' : '#b9af9f',
          }}
        >
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-medium leading-snug text-[#f4efe7]">
            {s.label}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {s.status === 'candidate' && <Tag tone="warn">Unverified</Tag>}
            {s.status === 'assigned' && <Tag tone="good">Assigned</Tag>}
            {!entry.route.reachable && <Tag tone="bad">No route</Tag>}
            <span className="text-[11.5px] text-[#9a8f80]">
              Found by <span className="font-mono">{s.detectedBy}</span>,{' '}
              {ageLabel(s.detectedAt, state.now)}
            </span>
          </span>
        </span>
      </button>

      {open && (
        <div className="space-y-4 px-3.5 pb-4">
          <p className="text-[12.5px] leading-relaxed text-[#b9af9f]">{s.note}</p>

          <div className="space-y-2.5">
            <Label>Why this rank</Label>
            {entry.factors.map((f) => (
              <div key={f.label} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] text-[#e8e1d6]">{f.label}</span>
                  <span className="tnum text-[12px] text-[#9a8f80]">
                    {Math.round(f.value * 100)}%
                  </span>
                </div>
                <Meter
                  value={f.value}
                  tone={f.value < 0.4 ? 'bad' : f.value < 0.7 ? 'warn' : 'neutral'}
                />
                <p className="text-[11.5px] leading-snug text-[#9a8f80]">{f.detail}</p>
              </div>
            ))}
          </div>

          {entry.counterfactual && (
            <div className="border-l-2 border-[#dc9a3f] py-1 pl-3">
              <p className="text-[12.5px] leading-snug text-[#dc9a3f]">{entry.counterfactual.text}</p>
              <p className="mt-1 text-[11.5px] leading-snug text-[#9a8f80]">
                Settling that dispute changes who we reach first.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Send a unit</Label>
            <div className="flex flex-wrap gap-1.5">
              {state.robots
                .filter((r) => r.cls !== 'aerial')
                .map((r) => {
                  const unheard = r.link === 'dark' || r.link === 'lost'
                  return (
                    <Button
                      key={r.id}
                      variant={s.assignedTo === r.id ? 'solid' : 'ghost'}
                      onClick={() => assign(s.id, r.id)}
                    >
                      <span className="font-mono text-[12px]">{r.name}</span>
                      {unheard && (
                        <span className="ml-1.5 text-[11px] text-[#dc9a3f]">{'· dark'}</span>
                      )}
                    </Button>
                  )
                })}
            </div>
            {s.assignedTo && state.robots.find((r) => r.id === s.assignedTo)?.link === 'dark' && (
              <p className="text-[11.5px] leading-snug text-[#dc9a3f]">
                Order held. This unit cannot hear us — it will be delivered the moment contact
                returns.
              </p>
            )}
          </div>
        </div>
      )}
    </article>
  )
}

export function TriagePanel() {
  const { entries } = useMission()
  const unverified = entries.filter((e) => e.survivor.status === 'candidate').length
  return (
    <Panel
      tour="triage"
      title="Triage"
      meta={
        entries.length === 0
          ? 'nobody located yet'
          : `${entries.length} located, ${unverified} unverified`
      }
    >
      {entries.length === 0 ? (
        <Empty>
          No life signals yet. The swarm is still building a picture — anything it finds arrives
          here to be ranked, not as an alert that disappears.
        </Empty>
      ) : (
        entries.map((e, i) => <Row key={e.survivor.id} entry={e} index={i} />)
      )}
    </Panel>
  )
}
