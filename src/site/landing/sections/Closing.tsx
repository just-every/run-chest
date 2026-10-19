import { closingCopy } from '../copy'
import { Icon } from '../art/icons'
import { Sticky, Ticks } from '../art/marks'
import { keep } from '../Prose'
import './closing.css'

/** page-11: what Chest leaves out, then "Everything in its place." between the next supplier and the checked folder. */
export function Closing() {
  return (
    <section id="start" className="closing" aria-labelledby="closing-title">
      <p className="card limits">
        <span className="limits-ico"><Icon name="chestOutline" /></span>
        <span className="stack"><b className="f22 ink">{closingCopy.limitsTitle}</b><span className="f18 mid">{closingCopy.limits}</span></span>
      </p>
      <div className="closing-stage">
        <div className="closing-note" aria-hidden="true">
          <Sticky className="closing-sticky">next:<br />Bayline<br />Packaging</Sticky>
          <svg className="closing-arrow" viewBox="0 0 80 40"><path d="M4 12c22-10 46-8 66 16" /><path d="M58 28l12 2 1-12" /></svg>
        </div>
        <div className="closing-copy">
          <h2 id="closing-title" className="two-tone"><span className="ink-part">Everything</span><br />in its place.</h2>
          <p className="closing-line">{closingCopy.line}</p>
          <a className="btn" href="/run">Run Chest <span className="arrow" aria-hidden="true">→</span></a>
          <a className="text-link" href="/docs">Read the docs</a>
          <p className="closing-licence">{closingCopy.licence}</p>
        </div>
        <div className="closing-check">
          <p className="card checked-card"><Icon name="checkFill" className="ico" /><span className="stack"><b className="f20 ink">{keep('Vendors / Acme Supply')}</b><span className="f16 mid">63 files · checked Nov 30</span></span></p>
          <Ticks className="checked-ticks" turn={20} />
        </div>
      </div>
    </section>
  )
}
