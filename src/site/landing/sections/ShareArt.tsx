import { Icon, More } from '../art/icons'
import { Arrow, Sticky, Ticks } from '../art/marks'
import { Place, Stage } from '../art/Place'

/** Page 2, bottom: a share link with a password, an expiry and a download limit; a file request for a W-9. */
export function ShareArt() {
  return (
    <Stage w={800} h={440} flow className="share-art" label="A share link for Harbor Freight site photos with a password on, expiry Nov 30 and 3 of 10 downloads, a Revoke button, and a file request: Upload your W-9, 2 files received.">
      <Place x={50} y={38} w={400} h={305} z={3}>
        <div className="card share-card">
          <div className="row share-head"><span className="round-ico"><Icon name="link" /></span><b className="f17 ink grow">Harbor Freight site photos</b><More /></div>
          <div className="row share-row"><Icon name="lock" /><span className="f16 ink grow">Password</span><span className="toggle" aria-hidden="true"><i /></span><span className="f16 mid">on</span></div>
          <div className="row share-row"><Icon name="calendar" /><span className="f16 ink grow">Expires</span><span className="f16 mid">Nov 30</span></div>
          <div className="row share-row"><Icon name="download" /><span className="f16 ink grow">Downloads</span><span className="f16 mid">3 of 10</span></div>
          <span className="revoke f17">Revoke</span>
        </div>
      </Place>
      <Place x={448} y={50} w={176} h={226} r={13} z={1} phone={false}><div className="card print"><img className="photo" src="/site/site.webp" alt="" width="124" height="168" style={{ objectPosition: '30% 50%' }} /></div></Place>
      <Place x={428} y={78} w={176} h={226} r={8} z={2} phone={false}><div className="card print"><img className="photo" src="/site/site.webp" alt="" width="124" height="168" /></div></Place>
      <Place x={330} y={306} w={386} h={82} z={4}>
        <div className="card request row">
          <span className="request-ico"><Icon name="arrowUp" /></span>
          <div className="stack grow"><span className="f16 ink nowrap">Upload your W-9 <span aria-hidden="true">→</span></span><span className="f135 dim nowrap">Vendors / Acme / Tax · 2 files received</span></div>
          <More />
        </div>
      </Place>
      <Place x={662} y={212} w={114} h={106} r={-6} z={4} phone={false}><Sticky className="share-sticky">Collect<br />files from<br />anyone</Sticky></Place>
      <Arrow kind="downLeft" style={{ left: '60.4em', top: '25.6em', width: '5.4em', height: '5em', zIndex: 5 }} />
      <Ticks style={{ left: '0.6em', top: '1.4em' }} turn={-75} />
    </Stage>
  )
}
