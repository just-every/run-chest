import { Folder, Icon } from '../../shell/Icon'

const files = [['liability-2027.pdf', 'Submitted'], ['contract-2026.pdf', 'Approved'], ['invoice-2025.pdf', 'Approved']] as const

/** Section 8: a small tabbed folder of filed records. */
export function StartDrawing() {
  return (
    <Folder className="folder-start">
      <ul className="start-rows">
        {files.map(([file, state]) => <li key={file}><Icon name="document" /><span className="mono">{file}</span><span className="chip">{state}</span></li>)}
      </ul>
    </Folder>
  )
}
