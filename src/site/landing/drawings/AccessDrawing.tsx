import { Folder, Icon } from '../../shell/Icon'

const readers = [['person', 'Maria Chen', 'reviewer'], ['person', 'Dan Hale', 'editor'], ['people', 'Accounts team', 'reader']] as const

/** Section 4: the Effective readers card. */
export function AccessDrawing() {
  return (
    <Folder className="folder-access">
      <p className="mono sheet-label">Effective readers</p>
      <ul className="reader-rows">
        {readers.map(([icon, name, role]) => <li key={name}><Icon name={icon} className="icon icon-badge" /><span className="mono">{name}</span><span aria-hidden="true">·</span><span className="mono reader-role">{role}</span></li>)}
      </ul>
    </Folder>
  )
}
