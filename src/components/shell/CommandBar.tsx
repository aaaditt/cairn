import { useState } from 'react'
import { isMuted, play, setMuted } from '../../shell/audio'
import { INCIDENT } from '../../sim/seed'
import { useMission } from '../../state/MissionProvider'

/**
 * The command bar.
 *
 * Most dashboards put reassuring metrics in this position. This one carries
 * the gaps — how little of the sector is verified, how many units cannot hear
 * us, how many orders have not landed — and each figure escalates from dormant
 * grey to amber as it goes wrong. A commander should be able to read how bad
 * it is from the top strip alone, without parsing a single label.
 */

function clock(minutes: number, offset: number) {
  const total = minutes + offset
  const h = Math.floor(total / 60)
  const m = Math.floor(total % 60)
  const s = Math.floor((total % 1) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function Gap({
  value,
  label,
  active,
  className = '',
  tour,
}: {
  value: string
  label: string
  active: boolean
  className?: string
  tour?: string
}) {
  return (
    <div data-tour={tour} className={`flex flex-col ${className}`}>
      <span
        className="tnum text-[15px] font-semibold leading-none"
        style={{ color: active ? '#dc9a3f' : '#6f665b' }}
      >
        {value}
      </span>
      <span className="mt-1.5 text-[11.5px] leading-none text-[#9a8f80]">{label}</span>
    </div>
  )
}

function SoundToggle() {
  const [off, setOff] = useState(isMuted())
  return (
    <button
      onClick={() => {
        const next = !off
        setMuted(next)
        setOff(next)
        if (!next) play('found')
      }}
      aria-pressed={!off}
      title={off ? 'Turn mission audio on' : 'Turn mission audio off'}
      className="ml-auto border border-[#3a342c] px-2.5 py-1.5 text-[12.5px] text-[#e8e1d6] transition-colors hover:border-[#554d43] hover:bg-[#201c17]"
    >
      {off ? 'Sound off' : 'Sound on'}
    </button>
  )
}

export function CommandBar({ onOpenProcess }: { onOpenProcess: () => void }) {
  const { state, cover, entries } = useMission()

  const dark = state.robots.filter((r) => r.link === 'dark' || r.link === 'lost').length
  const open = state.contests.filter((c) => !c.resolution).length
  const queued = state.robots.reduce(
    (n, r) => n + r.orders.filter((o) => o.acknowledgedAt === null).length,
    0,
  )

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-3 border-b border-[#2b2620] bg-[#17140f] px-4 py-3">
      <div className="flex items-baseline gap-3">
        <span className="text-[16px] font-semibold tracking-[0.22em] text-[#f4efe7]">CAIRN</span>
        <span className="hidden text-[12px] text-[#9a8f80] sm:inline">
          {INCIDENT.name}, {INCIDENT.sector}
        </span>
      </div>

      {/* The clock is the one number that is never in doubt. */}
      <div className="flex items-baseline gap-2">
        <span className="tnum font-mono text-[19px] font-medium leading-none text-[#f4efe7]">
          {clock(state.now, INCIDENT.sinceQuake)}
        </span>
        <span className="text-[11.5px] text-[#9a8f80]">since the quake</span>
      </div>

      <div className="flex flex-1 flex-wrap items-end gap-x-5 gap-y-3">
        <Gap value={`${cover.pct}%`} label="sector verified" active={cover.pct < 15} tour="verified" />
        <Gap
          value={`${entries.length}`}
          label={entries.length === 1 ? 'person found' : 'people found'}
          active={false}
        />
        <Gap
          value={`${dark}`}
          label={dark === 1 ? 'unit out of contact' : 'units out of contact'}
          active={dark > 0}
          className="hidden md:flex"
        />
        <Gap
          value={`${queued}`}
          label={queued === 1 ? 'order undelivered' : 'orders undelivered'}
          active={queued > 0}
          className="hidden lg:flex"
        />
        <Gap
          value={`${open}`}
          label={open === 1 ? 'fact disputed' : 'facts disputed'}
          active={open > 0}
        />
      </div>

      <SoundToggle />

      <button
        onClick={onOpenProcess}
        className="border border-[#3a342c] px-3 py-1.5 text-[12.5px] text-[#e8e1d6] transition-colors hover:border-[#554d43] hover:bg-[#201c17]"
      >
        Read the design case
      </button>
    </header>
  )
}
