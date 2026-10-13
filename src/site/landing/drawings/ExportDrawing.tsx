import { folderTab } from '../../../ui/icons'

/** Section 7: the closed manila bundle tabbed library.rer, its three sheets' edges showing at the top, a cobalt band round it. */
export function ExportDrawing() {
  return (
    <div className="bundle">
      <span className="bundle-stack" aria-hidden="true" />
      <span className="bundle-tab"><span className="bundle-tab-shape" aria-hidden="true" dangerouslySetInnerHTML={{ __html: folderTab }} /><span className="mono">library.rer</span></span>
      <span className="bundle-back" aria-hidden="true" />
      <span className="bundle-sheets" aria-hidden="true"><i /><i /><i /></span>
      <span className="bundle-body" aria-hidden="true" />
      <span className="bundle-band" aria-hidden="true" />
    </div>
  )
}
