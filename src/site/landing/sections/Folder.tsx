import { sectionCopy } from '../copy'
import { FileTile, Icon, More, type IconName } from '../art/icons'
import { Avatar } from '../art/marks'
import { Section } from '../Section'
import './folder.css'

const places: { name: string; icon: IconName; tone: string; current?: boolean; team?: boolean }[] = [
  { name: 'My files', icon: 'folder', tone: 'blue' },
  { name: 'Shared with me', icon: 'users', tone: 'grey' },
  { name: 'Recent', icon: 'clock', tone: 'grey' },
  { name: 'Finance', icon: 'chart', tone: 'green', team: true },
  { name: 'Ops', icon: 'grid', tone: 'peach', team: true },
  { name: 'Sales', icon: 'users', tone: 'sky', team: true },
  { name: 'Vendors', icon: 'folderFill', tone: 'violet', team: true, current: true },
]

const rows: { name: string; kind: 'folder' | 'image' | 'sheet' | 'doc'; meta?: [string, string] | [string]; approved?: boolean }[] = [
  { name: 'Legal', kind: 'folder', meta: ['6 files', 'Oct 28'] },
  { name: 'Tax', kind: 'folder', meta: ['2 files', 'Oct 2'] },
  { name: 'Onboarding', kind: 'folder', meta: ['2 files', 'Oct 20'] },
  { name: 'Invoices', kind: 'folder', meta: ['3 files', 'Nov 28'] },
  { name: 'Delivery photos', kind: 'image', meta: ['48 photos', 'Oct 9'] },
  { name: 'Pricing.xlsx', kind: 'sheet', meta: ['Oct 14'] },
  { name: 'Contract.docx · v7', kind: 'doc', approved: true },
]

const timeline: [string, string][] = [['Oct 2', 'Filed'], ['Oct 9', 'Synced'], ['Oct 14', 'Priced'], ['Oct 20', 'Sent'], ['Oct 28', 'Signed off'], ['Nov 30', 'Checked']]

/** page-03: Vendors / Acme Supply inside the company drive, its people and roles, and the folder's dates. */
export function Folder() {
  return (
    <Section id="folder" copy={sectionCopy.folder} layout="center" className="folder">
      <figure className="card drive" aria-label="The company drive at Vendors / Acme Supply, shared with Dana (manager), Luis (contributor) and Priya (guest): Legal 6 files, Tax 2, Onboarding 2, Invoices 3, Delivery photos 48, Pricing.xlsx and Contract.docx v7 approved; the folder's dates from Oct 2 filed to Nov 30 checked.">
        <nav className="drive-side" aria-hidden="true">
          {places.map((place, index) => (
            <span key={place.name} className={`drive-place${place.current ? ' is-current' : ''}${place.team && !places[index - 1].team ? ' first-team' : ''}`}>
              <span className={`place-ico tone-${place.tone}`}><Icon name={place.icon} /></span><span className="f18">{place.name}</span>
            </span>
          ))}
        </nav>
        <div className="drive-main">
          <div className="drive-head">
            <p className="f22 drive-path"><span className="dim">Vendors</span> <span className="dim">/</span> <b>Acme Supply</b></p>
            <ul className="roles">
              <li><Avatar initial="D" tone="violet" /><span className="f13"><b>Dana</b> · manager</span></li>
              <li><Avatar initial="L" tone="green" /><span className="f13"><b>Luis</b> · contributor</span></li>
              <li><Avatar initial="P" tone="peach" /><span className="f13"><b>Priya</b> · guest</span></li>
            </ul>
            <p className="f14 mid shared-with">Shared with 4 people</p>
          </div>
          <ul className="drive-rows">
            {rows.map(row => (
              <li key={row.name}>
                <FileTile kind={row.kind} />
                <span className="f19 ink row-name">{row.name}</span>
                {row.meta ? <span className="f16 dim row-meta">{row.meta[0]}{row.meta[1] ? <><span className="sep"> · </span>{row.meta[1]}</> : null}</span> : null}
                {row.approved ? <span className="row-meta"><span className="chip chip-ok f16">approved</span></span> : null}
                <More />
              </li>
            ))}
          </ul>
          <ol className="timeline">
            {timeline.map(([date, event]) => <li key={date}><span className="f15 mid">{date}</span><span className="f15 mid">{event}</span></li>)}
          </ol>
        </div>
      </figure>
    </Section>
  )
}
