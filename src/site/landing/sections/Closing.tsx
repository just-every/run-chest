import { closingCopy } from '../copy'
import { Ticks } from '../art/marks'
import { Place, Stage } from '../art/Place'
import { ContractCard, ShareLinkCard, VersionStack } from '../hero/cards'
import { PhotosCard } from '../hero/PhotosCard'
import './closing.css'

/** Page 9: "Everything in its place." among the hero's cards, the mascot peeking up at the footer. */
export function Closing() {
  return (
    <section id="start" className="closing" aria-labelledby="closing-title">
      <div className="closing-art" aria-hidden="true">
        <Stage w={1536} h={855} label="">
          <Place x={18} y={70} w={420} h={432} r={-6}><ContractCard cursors={false} /></Place>
          <Place x={48} y={570} w={380} h={86} r={-5}><ShareLinkCard /></Place>
          <Place x={1182} y={66} w={300} h={286} r={6}><PhotosCard /></Place>
          <Place x={1166} y={398} w={372} h={196} r={5}><VersionStack /></Place>
          <Place x={1108} y={660} w={300} h={300} r={-4} className="peek"><img className="mascot-peek" src="/brand/mark.svg" alt="" width="300" height="300" /></Place>
          <Ticks style={{ left: '141.6em', top: '67.4em', width: '5.4em', height: '7.6em' }} turn={-30} />
        </Stage>
      </div>
      <div className="closing-copy">
        <h2 id="closing-title" className="two-tone"><span className="ink-part">Everything</span><br />in its place.</h2>
        <p className="closing-line">{closingCopy.line}</p>
        <div className="closing-actions">
          <a className="btn" href="/run">Run Chest <span className="arrow" aria-hidden="true">→</span></a>
          <a className="text-link" href="/docs">Read the docs</a>
        </div>
        <p className="closing-licence">{closingCopy.licence}</p>
      </div>
    </section>
  )
}
