import { sectionCopy } from '../copy'
import { FileTile, Icon, type IconName } from '../art/icons'
import { keep } from '../Prose'
import { Section } from '../Section'
import './arrivals.css'

const sources: [IconName, string][] = [['mail', 'Email'], ['phone', 'Phone'], ['laptop', 'Laptop']]

/** `from` follows `read` after a dot, and drops under it on narrow phones (arrivals.css). */
const arrivals: { name: string; kind: 'pdf' | 'sheet'; read: string; from?: string; done: string; renamed?: boolean; flag?: boolean }[] = [
  { name: 'NDA.pdf', kind: 'pdf', read: 'scanned, 3 pages', from: 'from legal@acme.example', done: 'Vendors / Acme Supply / Legal' },
  { name: 'Insurance_certificate.pdf', kind: 'pdf', read: 'expires Sep 30, 2027 · reminder set', done: 'Legal' },
  { name: 'Invoice-0042.pdf', kind: 'pdf', read: 'read: $4,180.00 due Nov 1', done: 'Invoices' },
  { name: 'scan_0931.pdf', kind: 'pdf', read: 'read: W-9 · Acme Supply Co.', done: 'renamed W-9 Acme Supply.pdf → Tax', renamed: true },
  { name: 'Rate card.xlsx', kind: 'sheet', read: 'public link · opened 41 times', done: 'limited to the Acme team', flag: true },
]

/** page-04: the chest mascot takes in the day's arrivals and the agent's log shows each one filed, with Undo. */
export function Arrivals() {
  return (
    <Section id="arrivals" copy={sectionCopy.arrivals} layout="right" className="arrivals">
      <figure className="arrivals-art" aria-label="Chest's mascot takes in files from email, a phone and a laptop. The Chest agent's log for Fri, Oct 2: NDA.pdf filed to Vendors / Acme Supply / Legal, the insurance certificate to Legal with a reminder before it expires, Invoice-0042 to Invoices, scan_0931.pdf renamed W-9 Acme Supply.pdf in Tax, and the public link on Rate card.xlsx limited to the Acme team, each with Undo.">
        <div className="intake" aria-hidden="true">
          <ul className="sources">
            {sources.map(([icon, label]) => <li key={label} className="card source-card"><Icon name={icon} /><span className="f16">{label}</span></li>)}
          </ul>
          <svg className="intake-paths" viewBox="0 0 220 460"><path d="M4 60c58 0 98 40 112 116" /><path d="M4 240c46-8 80 10 102 34" /><path d="M4 418c34-6 58-30 70-72" /><path d="M108 162l8 16 10-14M98 262l10 12 12-8M66 356l8-12 12 6" /></svg>
          <span className="mascot-glow" />
          <img className="mascot" src="/brand/mark.svg" alt="" width="320" height="320" />
        </div>
        <div className="card agent-log">
          <div className="agent-head">
            <Icon name="sparkle" className="ico sparkle" />
            <div className="stack"><b className="f20 ink">Chest agent · Fri, Oct 2</b><span className="f16 dim">4 filed · 1 link limited</span></div>
          </div>
          <ul>
            {arrivals.map(row => (
              <li key={row.name} className={row.flag ? 'is-flag' : undefined}>
                <FileTile kind={row.kind} />
                <div className="arrival-text">
                  <b className="f17 ink">{row.name}</b>
                  <span className="f15 dim">{keep(row.read)}{row.from ? <span className="then"><span className="sep">{keep(' · ')}</span>{row.from}</span> : null}</span>
                  <span className="arrival-done"><Icon name="checkCircle" className="ico" /><span className="f145 mid">{row.renamed ? null : <Icon name="arrowRight" className="ico to-ico" />}{keep(row.done)}</span><span className="f145 undo">Undo</span></span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </figure>
    </Section>
  )
}
