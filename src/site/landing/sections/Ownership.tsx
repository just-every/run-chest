import { featureCopy, ownershipList } from '../copy'
import { prose } from '../Prose'
import { Icon, type IconName } from '../art/icons'
import { Arrow, Sticky, Ticks } from '../art/marks'
import { Place, Stage } from '../art/Place'
import './ownership.css'

const icons: IconName[] = ['database', 'monitor', 'share']
const command = 'npx -y @runeditrun/rer dev just-every/run-chest'
const comment = '# clones, installs and starts Chest on your computer'

/** Page 7: "Yours, start to finish." with the one command that starts Chest on your own computer. */
export function Ownership() {
  const copy = featureCopy.ownership
  return (
    <section id="ownership" className="feature ownership" style={{ height: '102.4em' }} aria-labelledby="ownership-title">
      <span className="panel" aria-hidden="true" style={{ left: '5em', top: '19.2em', width: '99.2em', height: '72em' }} />
      <span className="panel" aria-hidden="true" style={{ left: '65em', top: '62.6em', width: '54.4em', height: '25.4em' }} />
      <div className="feature-copy" style={{ left: '10.2em', top: '24em', width: '62em' }}>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h2 id="ownership-title" className="two-tone" style={{ fontSize: '10.2em' }}><span className="ink-part">Yours,</span><br />start to finish.</h2>
        <p className="lead" style={{ fontSize: '2.5em' }}>{prose(copy.lead)}</p>
        <ul className="own-list">
          {ownershipList.map((item, index) => <li key={item}><Icon name={icons[index]} />{item}</li>)}
        </ul>
      </div>
      <div className="feature-art" style={{ left: '74em', top: '24em' }}>
        <Stage w={780} h={520} crop={{ x: 20, y: 40, w: 730, h: 440 }} label={`A terminal: ${command}, then the comment ${comment}; a sticky note says that's it.`}>
          <Place x={30} y={66} w={686} h={372} r={-2}>
            <div className="terminal">
              <div className="terminal-bar"><i /><i /><i /></div>
              <pre className="terminal-body"><span><b>$</b> {command}{'\n'}</span><span>{comment}{'\n'}</span></pre>
            </div>
          </Place>
          <Place x={556} y={282} w={190} h={184} r={4} z={2}><Sticky tone="butter" className="own-sticky" underline>that’s it</Sticky></Place>
          <Arrow kind="hook" style={{ left: '49.4em', top: '31.6em', width: '6em', height: '6.4em', zIndex: 3, rotate: '-70deg' }} />
          <Ticks style={{ left: '66.4em', top: '2.4em', width: '6em', height: '6.4em' }} turn={-40} />
        </Stage>
      </div>
    </section>
  )
}
