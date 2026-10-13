import { repository } from './repository'

/** The run site's header: the folder mark and wordmark home, then Docs and Source. A 1px ink rule under it from tablet width up. */
export function SiteHeader({ current }: { current?: 'docs' }) {
  return (
    <header className="site-header">
      <div className="site-bar">
        <a className="wordmark" href="/#top"><img className="wordmark-mark" src="/brand/mark.svg" alt="" width="36" height="36" />Chest</a>
        <nav aria-label="Site">
          <a href="/docs" aria-current={current === 'docs' ? 'page' : undefined}>Docs</a>
          <a href={repository}>Source</a>
        </nav>
      </div>
    </header>
  )
}
