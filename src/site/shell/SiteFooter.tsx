import { licenceUrl, repository } from './repository'

/** Chest · Docs · Source · MIT licence, and nothing else. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-bar">
        <a className="wordmark" href="/#top">Chest</a>
        <nav aria-label="Footer">
          <a href="/docs">Docs</a>
          <a href={repository}>Source</a>
          <a href={licenceUrl}>MIT licence</a>
        </nav>
      </div>
    </footer>
  )
}
