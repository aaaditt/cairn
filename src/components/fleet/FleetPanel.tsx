import { ageLabel, uncertaintyRadius } from '../../sim/decay'
import type { LinkState, Robot } from '../../sim/types'
import { useMission } from '../../state/MissionProvider'
import { Panel, Tag } from '../shell/ui'

/**
 * The fleet, with an honest link model.
 *
 * A binary online/offline flag is the most common lie in fleet software: it
 * makes a unit vanish, and a commander who cannot see a unit re-tasks its
 * sector and duplicates a search already under way. So a dark unit stays on
 * this list and on the map, with its position uncertainty written in plain
 * language and its undelivered orders counted.
 */

const LINK: Record<LinkState, { label: string; tone: 'neutral' | 'warn' | 'bad' | 'good' }> = {
  live: { label: 'On the net', tone: 'good' },
  degraded: { label: 'Patchy', tone: 'warn' },
  dark: { label: 'Cannot hear us', tone: 'bad' },
  lost: { label: 'Lost', tone: 'bad' },
}

const CLASS_COPY: Record<Robot['cls'], string> = {
  aerial: 'Aerial scout',
  ground: 'Tracked rover',
  crawler: 'Crawler',
  quadruped: 'Quadruped',
}

function Unit({ r }: { r: Robot }) {
  const { state, selectedRobot, setSelectedRobot } = useMission()
  const open = selectedRobot === r.id
  const link = LINK[r.link]
  const unheard = r.orders.filter((o) => o.acknowledgedAt === null)
  const radius = uncertaintyRadius(r, state.now)

  return (
    <article className={`border-b border-[#2b2620] ${open ? 'bg-[#201c17]' : ''}`}>
      <button
        onClick={() => setSelectedRobot(open ? null : r.id)}
        className="w-full px-3.5 py-2.5 text-left hover:bg-[#201c17]"
        aria-expanded={open}
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-[12.5px] font-medium text-[#f4efe7]">{r.name}</span>
          <Tag tone={link.tone}>{link.label}</Tag>
        </span>
        <span className="mt-1 flex items-baseline justify-between gap-2">
          <span className="text-[11.5px] text-[#9a8f80]">{CLASS_COPY[r.cls]}</span>
          <span className="tnum text-[11.5px] text-[#9a8f80]">{r.battery}% battery</span>
        </span>
        {unheard.length > 0 && (
          <span className="mt-2 block text-[11.5px] leading-snug text-[#dc9a3f]">
            {unheard.length === 1
              ? 'One order this unit does not know about yet'
              : `${unheard.length} orders this unit does not know about yet`}
          </span>
        )}
      </button>

      {open && (
        <div className="space-y-2 px-3.5 pb-3.5 text-[11.5px] leading-relaxed text-[#9a8f80]">
          <p>Carries {r.sensor}.</p>
          <p>
            Last heard from {ageLabel(r.lastContact, state.now)}
            {radius > 0.05 && (
              <>
                . It could be anywhere within{' '}
                <span className="tnum text-[#dc9a3f]">{radius.toFixed(1)} cells</span> of where the
                marker sits
              </>
            )}
            .
          </p>
          {r.orders.length > 0 && (
            <div className="space-y-1 pt-0.5">
              {r.orders.map((o) => (
                <p key={o.id} className="flex items-baseline gap-2">
                  <span
                    className="shrink-0 text-[11px]"
                    style={{ color: o.acknowledgedAt === null ? '#dc9a3f' : '#62ab82' }}
                  >
                    {o.acknowledgedAt === null ? 'Held' : 'Received'}
                  </span>
                  <span className="text-[#b9af9f]">{o.summary}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  )
}

export function FleetPanel() {
  const { state } = useMission()
  const dark = state.robots.filter((r) => r.link === 'dark' || r.link === 'lost').length
  return (
    <Panel
      tour="fleet"
      title="Fleet"
      tone={dark > 0 ? 'alert' : 'quiet'}
      meta={dark > 0 ? `${dark} out of contact` : `all ${state.robots.length} reachable`}
    >
      {state.robots.map((r) => (
        <Unit key={r.id} r={r} />
      ))}
    </Panel>
  )
}
