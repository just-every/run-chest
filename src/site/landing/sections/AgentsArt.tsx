import { FileTile, Icon } from '../art/icons'
import { Arrow, Sticky, Ticks } from '../art/marks'
import { Place, Stage } from '../art/Place'

/** Page 4, bottom: what the agents did today: filed a W-9, merged three logo copies, flagged a public payroll link. */
export function AgentsArt() {
  return (
    <Stage w={720} h={450} crop={{ x: 54, y: 40, w: 600, h: 400 }} className="agents-art" label="Agents at work: Filed W-9 Acme Supply.pdf to Vendors / Acme / Tax with Undo; merged 3 copies of Logo_final.png; Payroll 2026 is shared publicly, with Make private.">
      <Place x={63} y={56} w={579} h={258}>
        <div className="card agents-card">
          <div className="row agent-row"><FileTile kind="doc" /><div className="stack grow"><span className="f16 ink">Filed W-9 Acme Supply.pdf <span aria-hidden="true">→</span></span><span className="f15 dim">Vendors / Acme / Tax · <span className="undo">Undo</span></span></div></div>
          <div className="row agent-row"><span className="tile agent-merge"><Icon name="merge" /></span><span className="f16 ink grow">Merged 3 copies of Logo_final.png</span></div>
          <div className="row agent-row"><span className="tile agent-alert"><Icon name="link" /></span><span className="f16 ink grow">Payroll 2026 is shared publicly <span className="dim">·</span></span><span className="private-btn f16">Make private</span></div>
        </div>
      </Place>
      <Place x={576} y={288} w={126} h={120} r={-9} z={3}><Sticky className="agents-sticky" underline>Agents<br />keep things<br />tidy</Sticky></Place>
      <Arrow kind="curlLeft" style={{ left: '64.6em', top: '24.6em', width: '6em', height: '4.6em', zIndex: 4 }} />
      <Ticks style={{ left: '1em', top: '1em', width: '5.4em', height: '5.4em' }} turn={-80} />
    </Stage>
  )
}
