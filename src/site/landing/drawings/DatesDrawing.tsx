import { Folder, Icon } from '../../shell/Icon'

const work = [['Equipment hire terms', 'expiry 2026-10-20', 'Due'], ['Public liability certificate', 'review 2027-03-01', 'Upcoming'], ['Site induction checklist', 'review 2026-09-30', 'Completed with evidence']] as const

/** Section 5: the Review and expiry work card; Due is the quiet chip with a cobalt dot (no status colours on the landing). */
export function DatesDrawing() {
  return (
    <Folder className="folder-dates">
      <p className="sheet-title sheet-title-ruled">Review and expiry work</p>
      <ul className="work-rows">
        {work.map(([title, date, state]) => (
          <li key={title}><Icon name="document" /><span className="work-text"><span className="mono">{title}</span><span className="mono work-date">{date}</span></span><span className={state === 'Due' ? 'chip chip-dot' : 'chip'}>{state}</span></li>
        ))}
      </ul>
    </Folder>
  )
}
