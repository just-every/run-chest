import { FileTile, Icon, More } from '../art/icons'
import { Arrow, Ticks } from '../art/marks'
import { Place, Stage } from '../art/Place'

/** Page 4, top: v7 approved by Dana Ortiz, v6 and v5 kept, and a whole folder restored to Oct 12. */
export function VersionsArt() {
  return (
    <Stage w={760} h={400} flow className="versions-art" label="Acme Supply Contract.pdf: v7 approved by Dana Ortiz on Oct 14, v6 from Oct 10 and v5 from Oct 3, with Restore; beside it, Restore Clients / Harbor Freight to Oct 12.">
      <Place x={23} y={13} w={470} h={367}>
        <div className="card versions-card">
          <div className="row versions-head"><FileTile kind="doc" /><b className="f18 ink grow">Acme Supply Contract.pdf</b><More /></div>
          <div className="row ver-row ver-current"><FileTile kind="doc" className="tile-sm" /><span className="f14 mid grow nowrap ver-meta"><b className="ink">v7</b> · Oct 14<span className="then"><span className="sep"> · </span>approved by Dana Ortiz</span></span><span className="chip chip-ok f135">approved</span></div>
          <div className="row ver-row"><FileTile kind="doc" className="tile-sm" /><span className="f15 mid grow"><b className="ink">v6</b> · Oct 10</span></div>
          <div className="row ver-row"><FileTile kind="doc" className="tile-sm" /><span className="f15 mid grow"><b className="ink">v5</b> · Oct 3</span></div>
          <span className="restore-btn f17">Restore</span>
        </div>
      </Place>
      <Place x={411} y={272} w={315} h={103} z={2}>
        <div className="card restore-toast row"><span className="round-ico"><Icon name="clock" /></span><span className="f16 ink">Restore Clients /<br />Harbor Freight to Oct 12</span></div>
      </Place>
      <Arrow kind="drop" style={{ left: '49.6em', top: '14.4em', width: '10.4em', height: '10.4em', zIndex: 3 }} />
      <Ticks style={{ left: '68em', top: '20.6em', width: '4.6em', height: '4.6em' }} turn={20} />
    </Stage>
  )
}
