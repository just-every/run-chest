import { Icon } from '../art/icons'
import { Arrow, Cursor, Ticks } from '../art/marks'
import { Place, Stage } from '../art/Place'

const spaces = [
  { name: 'Finance', count: 4, tone: '#a58cf9' },
  { name: 'Legal', count: 3, tone: '#4d97f6' },
  { name: 'Clients', count: 12, tone: '#36b56b' },
]

/** Page 6, bottom: single sign-on through Okta, 42 people synced, three team spaces and a storage limit. */
export function TeamsArt() {
  return (
    <Stage w={680} h={470} flow className="teams-art" label="Team settings: single sign-on with Okta on, user sync for 42 people, team spaces Finance, Legal and Clients, and storage at 1.2 TB of 5 TB.">
      <Place x={131} y={7} w={418} h={433}>
        <div className="card teams-card">
          <div className="row teams-row"><span className="soft-ico"><Icon name="shield" /></span><span className="f165 ink"><b>Single sign-on</b><span className="mid then"><span className="sep dim"> · </span>Okta</span></span><span className="grow" /><span className="done"><Icon name="check" /></span></div>
          <div className="row teams-row"><span className="soft-ico"><Icon name="users" /></span><span className="f165 ink"><b>User sync</b><span className="mid then"><span className="sep dim"> · </span>42 people</span></span></div>
          <p className="f155 mid teams-label">Team spaces</p>
          <div className="spaces">
            {spaces.map(space => (
              <div className="row space" key={space.name}><svg className="space-folder" viewBox="0 0 24 20" aria-hidden="true"><path d="M1 3a2 2 0 0 1 2-2h5.5l2 2.2H21a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2z" fill={space.tone} /></svg><span className="f155 ink grow">{space.name}</span><span className="f15 mid">{space.count}</span></div>
            ))}
          </div>
          <div className="storage"><div className="row"><span className="f155 ink grow">Storage</span><span className="f15 ink">1.2 TB of 5 TB</span></div><span className="bar"><i style={{ width: '36%' }} /></span></div>
        </div>
      </Place>
      <Place x={14} y={102} w={100} h={64} r={-12} phone={false}><p className="handnote">Set it<br />up once.</p></Place>
      <Arrow kind="hook" style={{ left: '6.4em', top: '16em', width: '4.6em', height: '6em' }} />
      <Cursor name="Alex" tone="lilac" style={{ left: '56.4em', top: '34.4em' }} />
      <Ticks style={{ left: '57.6em', top: '31.6em', width: '3.2em', height: '3.6em' }} turn={-30} />
    </Stage>
  )
}
