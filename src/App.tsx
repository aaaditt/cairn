import { useEffect, useRef, useState } from 'react'
import { ContestPanel } from './components/contest/ContestPanel'
import { FleetPanel } from './components/fleet/FleetPanel'
import { CityMap } from './components/map/CityMap'
import { MapAside } from './components/map/MapAside'
import { CommandBar } from './components/shell/CommandBar'
import { LogFeed } from './components/shell/LogFeed'
import { Timeline } from './components/time/Timeline'
import { TriagePanel } from './components/triage/TriagePanel'
import { Briefing } from './process/Briefing'
import { CaseStudy } from './process/CaseStudy'
import { play, warm } from './shell/audio'
import { Tour, hasSeenTour } from './shell/Tour'
import { BEATS } from './sim/script'
import { MissionProvider, useMission } from './state/MissionProvider'

function Shortcuts() {
  const { setPlaying, playing, setNow, setSelectedRobot, setSelectedSurvivor, setInspect } =
    useMission()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return
      if (e.code === 'Space') {
        e.preventDefault()
        setPlaying(!playing)
      }
      if (e.key === 'Escape') {
        setSelectedRobot(null)
        setSelectedSurvivor(null)
        setInspect(null)
      }
      const n = Number(e.key)
      if (n >= 1 && n <= BEATS.length) {
        setPlaying(false)
        setNow(BEATS[n - 1].t)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playing, setPlaying, setNow, setSelectedRobot, setSelectedSurvivor, setInspect])

  return null
}

/**
 * Sound reports what changed, never what is.
 *
 * This watches the folded state for transitions rather than hooking the event
 * log directly, which means scrubbing backwards stays silent — you only hear a
 * thing the first time the picture actually crosses it. There is no ambience:
 * if nothing is happening the room is quiet, and that is what makes a tone
 * worth listening to.
 */
function MissionAudio() {
  const { state } = useMission()
  const prev = useRef({ found: 0, open: 0, dark: 0, settled: 0, quake: false })

  useEffect(() => {
    const found = state.survivors.length
    const open = state.contests.filter((c) => !c.resolution).length
    const settled = state.contests.filter((c) => c.resolution).length
    const dark = state.robots.filter((r) => r.link === 'dark' || r.link === 'lost').length
    const quake = state.now >= 6
    const p = prev.current

    if (found > p.found) play('found')
    if (open > p.open) play('dispute')
    if (settled > p.settled) play('resolve')
    if (dark > p.dark) play('linkLost')
    if (dark < p.dark) play('linkBack')
    if (quake && !p.quake) play('quake')

    prev.current = { found, open, dark, settled, quake }
  }, [state])

  return null
}

function Deck({ showTour, onTourDone }: { showTour: boolean; onTourDone: () => void }) {
  const [showCase, setShowCase] = useState(false)

  return (
    <div className="flex h-full flex-col bg-[#0f0d0b]">
      <Shortcuts />
      <MissionAudio />
      <CommandBar onOpenProcess={() => setShowCase(true)} />

      <div className="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[252px_minmax(0,1fr)_340px]">
        {/* left rail: what we have, and what the map is saying */}
        <div className="hidden min-h-0 flex-col overflow-y-auto lg:flex">
          <FleetPanel />
          <MapAside />
        </div>

        {/* the map is the hero and gets the whole centre column. On narrow
            screens a flex child collapses to zero height, so it takes an
            explicit viewport-relative height there instead. */}
        <div className="flex flex-col border-[#2b2620] lg:min-h-0 lg:border-x">
          <div className="h-[58svh] min-w-0 lg:h-auto lg:min-h-0 lg:flex-1">
            <CityMap />
          </div>
          <Timeline />
        </div>

        {/* right rail: the decisions */}
        <div className="flex flex-col lg:min-h-0 lg:overflow-y-auto">
          <TriagePanel />
          <ContestPanel />
          <LogFeed />
        </div>
      </div>

      {/* narrow viewports get the rest stacked below */}
      <div className="grid grid-cols-1 lg:hidden">
        <FleetPanel />
        <MapAside />
      </div>

      {showCase && <CaseStudy onClose={() => setShowCase(false)} />}
      {showTour && <Tour onDone={onTourDone} />}
    </div>
  )
}

export default function App() {
  const [entered, setEntered] = useState(false)
  const [tour, setTour] = useState(false)

  // The deck mounts only after the briefing, so the incident starts playing
  // when somebody is actually watching it rather than in a background tab.
  if (!entered) {
    return (
      <Briefing
        onEnter={(withTour) => {
          // Entering is the first gesture, which is what lets audio start at all.
          warm()
          setTour(withTour)
          setEntered(true)
        }}
        tourSeen={hasSeenTour()}
      />
    )
  }

  return (
    <MissionProvider>
      <Deck showTour={tour} onTourDone={() => setTour(false)} />
    </MissionProvider>
  )
}
