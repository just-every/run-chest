import { FileTile, Icon } from '../art/icons'
import { Arrow, Sticky, Ticks } from '../art/marks'
import { Place, Stage } from '../art/Place'

const rows = [
  { kind: 'doc', name: 'MSA_2026_v7.docx', state: <span className="sync-state sync-ok f14">synced <Icon name="check" /></span> },
  { kind: 'folder', name: 'site-photos', sub: '48 items', state: <span className="sync-state sync-cloud f14"><Icon name="cloud" /> on demand</span> },
  { kind: 'sheet', name: 'Q3-budget.xlsx', state: <span className="sync-state sync-busy f14"><svg className="spin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" pathLength="100" strokeDasharray="62 100" /></svg> syncing 62%</span> },
  { kind: 'slides', name: 'Proposal.key', state: <span className="sync-state sync-warn f14"><Icon name="alert" /> conflict, kept both</span> },
] as const

/** Page 2, top: the menu-bar Chest with four files in four sync states, and a phone that just uploaded a photo. */
export function SyncArt() {
  return (
    <Stage w={976} h={490} crop={{ x: 128, y: 30, w: 520, h: 460 }} className="sync-art" label="Chest in the Mac menu bar: a contract synced, a photo folder on demand, a budget syncing at 62% and a conflict kept as both copies; a phone shows IMG_4827.jpg uploaded.">
      <Place x={175} y={40} w={440} h={46} z={2}>
        <div className="menubar row">
          <span className="menubar-blank" />
          <span className="menubar-app"><img src="/brand/favicon-32.svg" alt="" width="24" height="24" /></span>
          <Icon name="wifi" /><Icon name="search" />
          <svg className="battery" viewBox="0 0 30 16" aria-hidden="true"><rect x="1" y="2" width="24" height="12" rx="3" /><rect x="3.5" y="4.5" width="17" height="7" rx="1.5" className="battery-fill" /><path d="M27 6v4" /></svg>
          <span className="f14 ink nowrap">Mon Oct 14&nbsp;&nbsp;9:41 AM</span>
        </div>
      </Place>
      <Place x={145} y={96} w={440} h={336} z={3}>
        <div className="card sync-panel">
          <div className="row sync-head"><span className="sync-app"><img src="/brand/mark.svg" alt="" width="30" height="30" /></span><span className="f17 ink"><b>Chest</b> <span className="dim">· Up to date</span></span><span className="dot-ok" /></div>
          {rows.map(row => (
            <div className="row sync-row" key={row.name}>
              <FileTile kind={row.kind} className="tile-sm" />
              <div className="stack grow"><span className="f155 ink">{row.name}</span>{'sub' in row ? <span className="f13 dim">{row.sub}</span> : null}</div>
              {row.state}
            </div>
          ))}
        </div>
      </Place>
      <Place x={12} y={370} w={122} h={120} r={-14} z={4}><Sticky className="sync-sticky">Same<br />files<br />everywhere</Sticky></Place>
      <Arrow kind="up" style={{ left: '15.6em', top: '42.4em', width: '7.4em', height: '5.2em', zIndex: 4 }} />
      <Ticks style={{ left: '8.6em', top: '4em' }} turn={-60} />
      <Place x={606} y={60} w={272} h={560} r={7} z={2}>
        <div className="phone">
          <div className="phone-screen">
            <div className="row phone-status"><span className="f12">9:41</span><span className="phone-island" /><span className="phone-icons" /></div>
            <div className="phone-card">
              <span className="sync-app"><img src="/brand/mark.svg" alt="" width="34" height="34" /></span>
              <span className="phone-check"><Icon name="check" /></span>
              <b className="f19 ink">IMG_4827.jpg</b>
              <span className="f16 dim">uploaded</span>
            </div>
          </div>
        </div>
      </Place>
      <Ticks style={{ left: '90em', top: '15.4em' }} turn={-20} />
    </Stage>
  )
}
