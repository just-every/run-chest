import { sectionCopy } from '../copy'
import { FileTile, Icon } from '../art/icons'
import { Avatar } from '../art/marks'
import { keep } from '../Prose'
import { Section } from '../Section'
import './close-out.css'

const reached: { name: string; sub: string; initial: string; tone: 'violet' | 'green' | 'peach' | 'blue' | 'amber'; fixed?: boolean }[] = [
  { name: 'Dana', sub: 'manager', initial: 'D', tone: 'violet' },
  { name: 'Luis', sub: 'contributor', initial: 'L', tone: 'green' },
  { name: 'Priya', sub: 'Acme Supply', initial: 'P', tone: 'peach' },
  { name: 'accounts@', sub: 'acme.example', initial: 'A', tone: 'blue' },
  { name: 'Warehouse', sub: 'Ops', initial: 'W', tone: 'amber', fixed: true },
]

const fixedLinks = ['Warehouse still opened v5 · sent them v7', '2 links open to a former contractor · revoked']
const checked = ['Broken link in Ops handbook.docx · now points to\u00a0v7', '3 invoices filed · 0 duplicates', '63 files · 0 public links']

/**
 * page-09: the close-out, in its own form: who holds the signed v7, the two exceptions put right, the folder's state.
 * On phones the title's folder and the banner's "nothing left open" drop to their own line (.then), whole.
 */
export function CloseOut() {
  return (
    <Section id="close-out" copy={sectionCopy.closeOut} layout="center" className="close-out">
      <figure className="card close-card" aria-label="Close-out check for Vendors / Acme Supply on Mon, Nov 30: the signed Contract.docx v7 reached Dana, Luis, Priya, accounts@acme.example and the warehouse. Two exceptions were put right: the warehouse still opened v5 and was sent v7, and 2 links open to a former contractor were revoked. The broken link in Ops handbook.docx now points to v7, 3 invoices are filed with 0 duplicates, and 63 files have 0 public links. Right version everywhere, nothing left open.">
        <p className="close-head"><Icon name="sparkle" className="ico sparkle" /><b className="f26 ink">Close-out check<span className="then"><span className="sep">{keep(' · ')}</span>{keep('Vendors / Acme\u00a0Supply')}</span></b></p>
        <div className="signed">
          <span className="signed-doc"><FileTile kind="doc" /><span className="stack"><b className="f17 ink">Contract.docx</b><span className="f14 mid">{keep('v7 · signed Oct 28')}</span></span></span>
          <span className="signed-fan" aria-hidden="true" />
          <ul className="recipients">
            {reached.map(person => (
              <li key={person.name} className={person.fixed ? 'is-fixed' : undefined}>
                <Avatar initial={person.initial} tone={person.tone} />
                <b className="f15 ink">{person.name}</b>
                <span className="f13 dim">{person.sub}</span>
                <span className={`chip f13 ${person.fixed ? 'chip-amber' : 'chip-ok'}`}>{person.fixed ? <>v5 <Icon name="arrowRight" className="ico chip-to" /> v7</> : 'v7'}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="close-lists">
          <div>
            <p className="f13 list-label">Put right</p>
            <ul className="close-rows is-amber">{fixedLinks.map(line => <li key={line}><Icon name="checkFill" className="ico" /><span className="f16">{keep(line)}</span></li>)}</ul>
          </div>
          <div>
            <p className="f13 list-label">Checked</p>
            <ul className="close-rows">{checked.map(line => <li key={line}><Icon name="checkFill" className="ico" /><span className="f16">{keep(line)}</span></li>)}</ul>
          </div>
        </div>
        <p className="close-done"><Icon name="checkFill" className="ico" /><b className="f20">Right version everywhere<span className="then"><span className="sep">{keep(' · ')}</span>nothing left open</span></b></p>
      </figure>
    </Section>
  )
}
