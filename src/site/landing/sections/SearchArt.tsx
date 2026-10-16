import { FileTile, Icon } from '../art/icons'
import { Arrow, Ticks } from '../art/marks'
import { Place, Stage } from '../art/Place'

/** Page 3, top: a search for "indemnification" finding the sentence in a Word file and in a scanned NDA. */
export function SearchArt() {
  return (
    <Stage w={760} h={470} crop={{ x: 66, w: 540, h: 470 }} className="search-art" label="Search for indemnification: 4 results in 0.2 s, the sentence on page 4 of MSA_2026_v7.docx and, boxed, clause 7 on page 2 of a scanned NDA.">
      <Arrow kind="up" style={{ left: '1em', top: '6em', width: '5.6em', height: '5.2em' }} />
      <Ticks style={{ left: '1.2em', top: '0.8em', width: '3.2em', height: '3.2em' }} turn={-40} />
      <Ticks style={{ left: '70.6em', top: '22em', width: '3.2em', height: '3.2em' }} turn={40} />
      <Place x={72} y={8} w={626} h={452}>
        <div className="card search-card">
          <div className="row search-field"><Icon name="search" /><span className="f18 ink grow">indemnification</span><Icon name="close" /></div>
          <p className="f14 dim search-count">4 results · 0.2 s</p>
          <div className="search-hit row">
            <FileTile kind="word" />
            <div className="stack grow">
              <span className="f16 ink">MSA_2026_v7.docx <span className="dim">· page 4</span></span>
              <span className="f15 mid search-snippet">... each&nbsp; party shall defend, <mark className="hl-search">indemnification</mark> and hold harmless the other party from and against any and all claims, losses, damages ...</span>
            </div>
          </div>
          <div className="search-hit search-hit-scan row">
            <FileTile kind="pdf" />
            <div className="stack grow">
              <span className="f16 ink">NDA_scan.pdf <span className="dim">· scanned · page 2</span></span>
              <div className="scan scan-excerpt">
                <p><span className="clause-no">7.</span> <span className="scan-hit">Indemnification.</span></p>
                <p>Each party agrees to indemnify, defend and hold harmless the other party, its affiliates and their respective officers, directors, employees and agents from and against any and all claims, losses, damages, liabilities and expenses (including reasonable attorneys’ fees) arising out of or relating to this Agreement.</p>
              </div>
            </div>
          </div>
        </div>
      </Place>
    </Stage>
  )
}
