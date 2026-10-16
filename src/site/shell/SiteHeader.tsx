import { Lockup } from './Lockup'
import { repository } from './repository'

/** The run site's header: the lockup home, then Docs and Source, over a hairline. */
export function SiteHeader({ current }: { current?: 'docs' }) {
  return (
    <header className="site-header">
      <div className="site-bar">
        <Lockup />
        <nav aria-label="Site">
          <a href="/docs" aria-current={current === 'docs' ? 'page' : undefined}>Docs</a>
          <a href={repository}>Source</a>
        </nav>
      </div>
    </header>
  )
}
