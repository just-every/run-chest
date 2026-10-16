import { Icon } from '../art/icons'
import { Arrow, Sticky, Ticks } from '../art/marks'
import { Place, Stage } from '../art/Place'

const Drive = () => <svg viewBox="0 0 40 36" aria-hidden="true"><path d="M13.5 2h13L40 25.5H27z" fill="#fbbc04" /><path d="M13.5 2 0 25.5 6.5 34 20 10.6z" fill="#1fa463" /><path d="M6.5 34h27L40 25.5H13z" fill="#4285f4" /></svg>
const Dropbox = () => <svg viewBox="0 0 40 36" aria-hidden="true" fill="#0061fe"><path d="M10 2 0 8.6l10 6.6 10-6.6zM30 2 20 8.6l10 6.6 10-6.6zM0 21.8l10 6.6 10-6.6-10-6.6zM30 15.2l-10 6.6 10 6.6 10-6.6zM10 30.6l10 6.4 10-6.4-10-6.5z" transform="scale(1 .94)" /></svg>
const BoxMark = () => <span className="box-word" aria-hidden="true">box</span>

/** Page 6, top: three imports from the old drives, one still copying, and old shared links redirected. */
export function MoveInArt() {
  return (
    <Stage w={746} h={440} crop={{ x: 100, y: 30, w: 520, h: 400 }} className="movein-art" label="Moving in: Google Drive 12,480 files done, Dropbox 3,201 files done, Box 980 files at 71%, and 214 shared links redirected.">
      <Arrow kind="up" style={{ left: '1.6em', top: '14em', width: '7.4em', height: '5.6em' }} />
      <Ticks style={{ left: '6.8em', top: '2em', width: '4.4em', height: '4.4em' }} turn={-60} />
      <Place x={110} y={52} w={475} h={363}>
        <div className="card import-card">
          <div className="row import-row"><span className="brand-ico"><Drive /></span><span className="f19 ink">Google Drive</span><span className="f17 dim">· 12,480 files</span><span className="grow" /><span className="done"><Icon name="check" /></span></div>
          <div className="row import-row"><span className="brand-ico"><Dropbox /></span><span className="f19 ink">Dropbox</span><span className="f17 dim">· 3,201 files</span><span className="grow" /><span className="done"><Icon name="check" /></span></div>
          <div className="import-row import-busy">
            <div className="row"><span className="brand-ico"><BoxMark /></span><span className="f19 ink">Box</span><span className="f17 dim">· 980 files</span><span className="grow" /><span className="f17 ink">71%</span></div>
            <span className="bar"><i style={{ width: '68%' }} /></span>
          </div>
          <div className="row import-links"><Icon name="link" /><span className="f16 ink">Shared links redirected</span><span className="f16 dim">· 214</span></div>
        </div>
      </Place>
      <Place x={598} y={206} w={128} h={150} r={-9} z={2}><Sticky className="movein-sticky" underline>Your<br />content<br />moves<br />with you.</Sticky></Place>
    </Stage>
  )
}
