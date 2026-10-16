import { Lockup } from './Lockup'
import { licenceUrl, repository } from './repository'

/** The lockup, then Docs · Source · MIT licensed, and nothing else. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-bar">
        <Lockup />
        <nav aria-label="Footer">
          <a href="/docs">Docs</a>
          <a href={repository}>Source</a>
          <a href={licenceUrl}>MIT licensed</a>
        </nav>
      </div>
    </footer>
  )
}
