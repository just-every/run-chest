import { Folder, Icon } from '../../shell/Icon'

const rows = [['document', 'Document type', 'Insurance'], ['building', 'Supplier', 'Kestrel Freight'], ['person', 'Owner', 'maria@kestrel-freight.example'], ['calendar', 'Review', '2027-03-01']] as const

/** Section 2: the library search field above a record card's filing rows. */
export function FilingDrawing() {
  return (
    <Folder className="folder-filing">
      <p className="drawing-search"><Icon name="search" /><span className="mono">Search titles, fields and extracted UTF-8 text</span></p>
      <dl className="field-rows">
        {rows.map(([icon, label, value]) => (
          <div key={label}><dt><Icon name={icon} /><span className="mono">{label}</span></dt><dd className="mono">{value}</dd></div>
        ))}
      </dl>
    </Folder>
  )
}
