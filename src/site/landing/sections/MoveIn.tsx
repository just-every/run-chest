import { sectionCopy } from '../copy'
import { Icon } from '../art/icons'
import { Section } from '../Section'
import './move-in.css'

const imported: [string, string][] = [['Files', '48,212'], ['Folders', '3,906'], ['Permissions', '1,104 kept'], ['Versions', '61,870'], ['Links inside files', '312 rewritten']]

/** page-02: the weekend move from Dropbox, beside the one line that set Chest up. */
export function MoveIn() {
  return (
    <Section id="move-in" copy={sectionCopy.moveIn} layout="left" className="move-in">
      <figure className="movein-art" aria-label="rer setup reports Chest is ready; the import from Dropbox brought 48,212 files, 3,906 folders, 1,104 permissions, 61,870 versions and rewrote 312 links inside files, then renamed and retried 7 names too long for Windows.">
        <div className="terminal">
          <p className="term-dots" aria-hidden="true"><i /><i /><i /></p>
          <p className="f14"><span className="term-prompt">$</span> rer setup</p>
          <p className="f14 term-ok"><span aria-hidden="true">✓</span> Chest is ready</p>
          <p className="f14"><span className="term-prompt">$</span> <span className="term-caret" aria-hidden="true" /></p>
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
