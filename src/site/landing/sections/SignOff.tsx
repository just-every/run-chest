import { sectionCopy } from '../copy'
import { Icon } from '../art/icons'
import { keep } from '../Prose'
import { Section } from '../Section'
import './sign-off.css'

/**
 * Contract.docx's history (page-s1/STRUCTURE.md records): v7 approved, v8 saved over it, v5 the resolved conflict.
 * No-break spaces keep each time with its AM/PM and "3 and 4" whole when the detail wraps on a phone.
 */
const versions: { v: string; at: string; note?: string; state?: 'not' | 'approved' }[] = [
  { v: 'v8', at: 'Oct 28, 4:52\u00a0PM', note: 'Luis · saved over sections 3\u00a0and\u00a04', state: 'not' },
  { v: 'v7', at: 'Oct 28, 11:06\u00a0AM', note: 'signed off by Dana and Priya', state: 'approved' },
  { v: 'v6', at: 'Oct 24, 3:15\u00a0PM', note: 'Priya' },
  { v: 'v5', at: 'Oct 9, 7:40\u00a0PM', note: 'Luis · offline edits, conflict resolved' },
  { v: 'v4', at: 'Oct 2' },
  { v: 'v3', at: 'Oct 2' },
]

/** page-08: v8 saved over the approved v7, and one click puts v7 back with v8 kept in history. */
export function SignOff() {
  return (
    <Section id="sign-off" copy={sectionCopy.signOff} layout="left" className="sign-off">
      <figure className="sign-art" aria-label="Contract.docx versions: v8 on Oct 28 at 4:52 PM by Luis, saved over sections 3 and 4, not approved; v7 on Oct 28 at 11:06 AM, signed off by Dana and Priya, approved, with Restore v7; v6 Oct 24 by Priya; v5 Oct 9 by Luis, offline edits with the conflict resolved; v4 and v3 Oct 2. After restoring, v7 is current again and v8 is kept in history.">
        <div className="card history">
          <p className="history-title"><Icon name="docLines" className="ico history-ico" /><b className="f26 ink">Contract.docx</b></p>
          <ol>
            {versions.map(row => (
              <li key={row.v} className={row.state === 'not' ? 'is-over' : row.state === 'approved' ? 'is-approved' : undefined}>
                <span className="ver-ico"><Icon name="docLines" /></span>
                <span className="ver-text mid"><b className="ver-v">{row.v}</b><span className="ver-detail">{keep([row.at, row.note].filter(Boolean).join(' · '))}</span></span>
                {row.state === 'not' ? <span className="chip chip-grey f15">not approved</span> : null}
                {row.state === 'approved' ? <><span className="chip chip-ok f16">approved</span><span className="restore f18">Restore v7</span></> : null}
              </li>
            ))}
          </ol>
        </div>
        <svg className="restore-arrow" viewBox="0 0 160 460" aria-hidden="true"><path d="M86 12C132 28 156 130 152 250C149 340 128 392 82 420" /><path d="M100 420H82l9-16" /></svg>
        <p className="card restored"><Icon name="checkFill" className="ico" /><span className="f20"><b>v7</b>{keep(' is current again · v8 kept in\u00a0history')}</span></p>
      </figure>
    </Section>
  )
}
