import type { Claim, ContestedFact } from '../../sim/types'
import { useMission } from '../../state/MissionProvider'
import { Button, Empty, Label, Panel, Tag } from '../shell/ui'

/**
 * Contested facts.
 *
 * When two units report incompatible things about the same ground, most fleet
 * software silently prefers the newer reading, or the higher-ranked sensor, and
 * shows a single confident answer. That is the failure that gets rescuers hurt:
 * the interface projects certainty it does not have.
 *
 * CAIRN raises the disagreement instead, attributes both claims, shows what
 * each choice costs in triage order, and records who decided and when.
 */

function ClaimBlock({ claim }: { claim: Claim }) {
  return (
    <div
      className="border-l-2 pl-3"
      style={{ borderColor: claim.passable ? '#62ab82' : '#e0565c' }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[12px] font-medium text-[#f4efe7]">{claim.by}</span>
        <span className="tnum font-mono text-[11px] text-[#9a8f80]">T+{claim.at.toFixed(1)}</span>
      </div>
      <p className="mt-0.5 text-[11.5px] text-[#9a8f80]">{claim.sensor}</p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#b9af9f]">{claim.text}</p>
      <p className="mt-2">
        <Tag tone={claim.passable ? 'good' : 'bad'}>
          {claim.passable ? 'Says passable' : 'Says blocked'}
        </Tag>
      </p>
    </div>
  )
}

function Fact({ fact }: { fact: ContestedFact }) {
  const { adjudicate, entries } = useMission()
  const affected = entries.filter((e) => e.counterfactual?.contestId === fact.id)

  if (fact.resolution) {
    const chosen =
      fact.resolution === 'a' ? fact.claimA.by : fact.resolution === 'b' ? fact.claimB.by : null
    const byEvidence = !!fact.resolvedBy && fact.resolvedBy !== 'command'
    return (
      <article className="border-b border-[#2b2620] px-3.5 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[12.5px] font-medium text-[#f4efe7]">{fact.subject}</p>
          <Tag tone={byEvidence ? 'good' : 'neutral'}>
            {byEvidence ? 'Settled by evidence' : 'Decided by command'}
          </Tag>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-[#62ab82]">
          {fact.resolution === 'verify'
            ? 'A unit is on the way to look. Treated as blocked until somebody physically confirms it.'
            : byEvidence
              ? `${fact.resolvedBy} drove this ground at T+${fact.resolvedAt?.toFixed(1)}, which settles it in favour of ${chosen}. Evidence outranks a judgement call.`
              : `Command backed ${chosen} at T+${fact.resolvedAt?.toFixed(1)}.`}
        </p>
      </article>
    )
  }

  return (
    <article className="space-y-3.5 border-b border-[#2b2620] px-3.5 py-4">
      <div>
        <p className="text-[13.5px] font-medium leading-snug text-[#f4efe7]">{fact.subject}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-[#9a8f80]">
          Two units looked at the same ground and disagreed. Nothing here will pick for you.
        </p>
      </div>

      <div className="space-y-3">
        <ClaimBlock claim={fact.claimA} />
        <ClaimBlock claim={fact.claimB} />
      </div>

      {affected.length > 0 && (
        <div className="space-y-1">
          <Label>What it costs</Label>
          {affected.map((e) => (
            <p key={e.survivor.id} className="text-[12.5px] leading-snug text-[#dc9a3f]">
              {e.survivor.label} — {e.counterfactual?.text}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Button onClick={() => adjudicate(fact.id, 'a')}>Back {fact.claimA.by}</Button>
        <Button onClick={() => adjudicate(fact.id, 'b')}>Back {fact.claimB.by}</Button>
        <Button variant="solid" onClick={() => adjudicate(fact.id, 'verify')}>
          Send someone to look
        </Button>
      </div>
      <p className="text-[11.5px] leading-relaxed text-[#9a8f80]">
        Looking costs time but buys a fact. Until this is settled, the ground stays impassable in
        every route we calculate — optimism is not the safe default when the downside is walking a
        team into a collapse.
      </p>
    </article>
  )
}

export function ContestPanel() {
  const { state } = useMission()
  const open = state.contests.filter((c) => !c.resolution)
  return (
    <Panel
      tour="dispute"
      title="Disputed ground"
      tone={open.length > 0 ? 'alert' : 'quiet'}
      meta={
        open.length > 0
          ? `${open.length} needs a decision`
          : state.contests.length > 0
            ? 'all settled'
            : 'none'
      }
    >
      {state.contests.length === 0 ? (
        <Empty>
          Nothing in dispute. When two units contradict each other about the same ground, the
          argument surfaces here instead of being quietly resolved behind your back.
        </Empty>
      ) : (
        state.contests.map((f) => <Fact key={f.id} fact={f} />)
      )}
    </Panel>
  )
}
