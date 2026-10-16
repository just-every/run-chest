import { FileTile } from '../art/icons'
import { Arrow, Sticky, Ticks } from '../art/marks'
import { Place, Stage } from '../art/Place'
import { ContractCard, ShareLinkCard, VersionStack } from './cards'
import { PhotosCard } from './PhotosCard'

/** Option F: the live folder collage, every card a real piece of a business's files. Stage origin: desk (280, 84). */
export function HeroCollage() {
  return (
    <Stage w={1256} h={900} crop={{ x: 410, y: 20, w: 520, h: 790 }} className="hero-collage" label="A team's files in Chest: a contract two people are editing, a receipt uploading, a share link, a version history, a scanned NDA read into fields, and a W-9 filed on its own.">
      <Place x={427} y={39} w={420} h={432} r={-5} z={3}><ContractCard /></Place>
      <Place x={900} y={44} w={252} h={292} r={6} z={2}>
        <div className="card receipt-frame"><img className="photo" src="/site/receipt.webp" alt="" width="212" height="244" /></div>
      </Place>
      <Place x={874} y={313} w={272} h={94} r={4} z={4}>
        <div className="card upload-card row">
          <svg className="ring" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="19" /><circle className="ring-done" cx="24" cy="24" r="19" pathLength="100" strokeDasharray="62 100" /></svg>
          <div className="stack"><b className="f165 ink nowrap">Uploading 62%</b><span className="f14 dim nowrap">Receipt 2024-10-14.jpg</span></div>
        </div>
      </Place>
      <Place x={816} y={440} w={372} h={362} r={4} z={2}>
        <div className="card nda-card">
          <div className="row nda-head"><FileTile kind="pdf" /><div className="stack"><b className="f16 ink">NDA.pdf</b><span className="f13 dim">Scanned · 3 pages</span></div></div>
          <div className="scan">
            <p className="scan-title">Non-disclosure agreement</p>
            <span className="scan-bar" style={{ width: '88%' }} /><span className="scan-bar" style={{ width: '70%' }} />
            <dl className="scan-fields">
              <div><dt>Date:</dt><dd><span className="field">Oct 1, 2024</span></dd></div>
              <div><dt>Party:</dt><dd><span className="field field-wide">Acme Supply Co.</span></dd></div>
              <div><dt>Amount:</dt><dd><span className="field">$50,000</span></dd></div>
            </dl>
            <span className="scan-bar" style={{ width: '92%' }} /><span className="scan-bar" style={{ width: '64%' }} />
          </div>
        </div>
      </Place>
      <Place x={455} y={480} w={346} h={86} r={-2.5} z={4}><ShareLinkCard /></Place>
      <Place x={456} y={592} w={340} h={192} r={-1} z={3}><VersionStack /></Place>
      <Place x={618} y={808} w={348} h={74} z={5}>
        <div className="card toast row">
          <FileTile kind="doc" className="tile-sm" />
          <div className="stack grow"><span className="f14 ink nowrap">Filed W-9 Acme Supply.pdf <span aria-hidden="true">→</span></span><span className="f13 dim nowrap">Vendors / Acme / Tax</span></div>
          <span className="f14 undo">Undo</span>
        </div>
      </Place>
      <Place x={152} y={600} w={240} h={254} r={-7.5} z={3}><PhotosCard /></Place>
      <Place x={20} y={674} w={122} h={134} r={-11} z={4}><Sticky className="hero-sticky">Q4<br />launch<br />assets</Sticky></Place>
      <Arrow kind="short" style={{ left: '12.4em', top: '72.6em', width: '4.6em', height: '2.6em', zIndex: 5 }} />
      <Arrow kind="hook" style={{ left: '40.4em', top: '46.4em', width: '4.6em', height: '9em', zIndex: 5 }} />
      <Arrow kind="both" style={{ left: '97.6em', top: '80.4em', width: '10.6em', height: '5.8em', zIndex: 5 }} />
      <Ticks style={{ left: '117.4em', top: '8.4em' }} turn={20} />
      <Ticks style={{ left: '114.6em', top: '50.2em' }} turn={10} />
      <Ticks style={{ left: '57.6em', top: '80.6em', width: '3.4em', height: '5em' }} turn={-100} />
    </Stage>
  )
}

