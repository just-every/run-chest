import { sectionCopy } from '../copy'
import { Icon } from '../art/icons'
import { Section } from '../Section'
import './move-in.css'

const imported: [string, string][] = [['Files', '48,212'], ['Folders', '3,906'], ['Permissions', '1,104 kept'], ['Versions', '61,870'], ['Links inside files', '312 rewritten']]

// The one start line every Run Edit Run page shows, and the alternative for people who already have Node.
const START = 'curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-chest'
const ALTERNATIVE = 'Already have Node 22 or later? npx -y @runeditrun/rer dev just-every/run-chest'

/** A command that wraps only between words, keeping the installer's `install.sh | sh` together. */
function words(line: string) {
  return line.split(/(\S*install\.sh \| sh|\S+)/).map((part, index) => {
    const pipe = /^(.*\/)(install\.sh \| sh)$/.exec(part)
    if (pipe) return <span key={index}><span className="term-word">{pipe[1]}</span><wbr /><span className="term-word">{pipe[2]}</span></span>
    return part.trim() ? <span key={index} className="term-word">{part}</span> : part
  })
}

/** page-02: the weekend move from Dropbox, beside the one line that set Chest up. */
export function MoveIn() {
  return (
    <Section id="move-in" copy={sectionCopy.moveIn} layout="left" className="move-in">
      <figure className="movein-art" aria-label={`${START} installs and starts Chest (already have Node 22 or later? npx -y @runeditrun/rer dev just-every/run-chest does the same) and reports Chest is ready; the import from Dropbox brought 48,212 files, 3,906 folders, 1,104 permissions, 61,870 versions and rewrote 312 links inside files, then renamed and retried 7 names too long for Windows.`}>
        <div className="terminal">
          <p className="term-dots" aria-hidden="true"><i /><i /><i /></p>
          <p className="term-cmd"><span className="term-prompt">$</span> {words(START)}</p>
          <p className="term-cmd term-comment"><span className="term-prompt">#</span> {words(ALTERNATIVE)}</p>
          <p className="f14 term-ok"><span aria-hidden="true">✓</span> Chest is ready</p>
        </div>
        <div className="card ledger">
          <div className="ledger-head">
            <span className="ledger-ico"><Icon name="download" /></span>
            <div className="stack">
              <b className="f20 ink">Import from Dropbox</b>
              <span className="f14 dim ledger-when">Started Sat 2:14 AM<span className="sep"> · </span><span className="then">finished Sun 9:40 AM</span><span className="sep"> · </span><span className="then">1.2 TB</span></span>
            </div>
          </div>
          <span className="ledger-bar" aria-hidden="true" />
          <dl className="ledger-rows">
            {imported.map(([label, value]) => <div key={label}><dt className="f15">{label}</dt><dd className="f15">{value}<Icon name="check" className="ico ok-ico" /></dd></div>)}
          </dl>
          <p className="ledger-note ledger-alert"><span className="note-ico" aria-hidden="true">!</span><span className="f15">7 file names too long for Windows</span></p>
          <p className="ledger-note ledger-fixed"><Icon name="checkCircle" className="ico" /><span className="f15">Renamed and retried<span className="sep"> · </span><span className="then">7 of 7 imported</span></span></p>
          <svg className="ledger-arrow" viewBox="0 0 30 50" aria-hidden="true"><path d="M8 3c12 10 14 26 4 42" /><path d="M5 36l7 9 9-6" /></svg>
        </div>
      </figure>
    </Section>
  )
}
