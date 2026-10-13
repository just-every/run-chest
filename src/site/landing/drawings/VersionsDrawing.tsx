import { folderTab } from '../../../ui/icons'
import { Icon } from '../../shell/Icon'

/** Section 3: three tabbed files, one per version; 2026 carries the cobalt Current approved tab and its fingerprint. */
export function VersionsDrawing() {
  return (
    <ol className="version-stack">
      <li className="version-file"><span className="version-tab" aria-hidden="true" dangerouslySetInnerHTML={{ __html: folderTab }} /><p><Icon name="document" /><span className="mono">liability-2025.pdf</span></p></li>
      <li className="version-file version-current"><span className="version-tab" aria-hidden="true" dangerouslySetInnerHTML={{ __html: folderTab }} /><p><Icon name="document" /><span className="mono">liability-2026.pdf</span><span className="tab tab-cobalt">Current approved</span></p><p className="mono version-hash">SHA-256 3f2e9c…a41d</p></li>
      <li className="version-file"><span className="version-tab" aria-hidden="true" dangerouslySetInnerHTML={{ __html: folderTab }} /><p><Icon name="document" /><span className="mono">liability-2027.pdf</span></p></li>
    </ol>
  )
}
