/** "Run Chest →" (to /run) and "Read the docs": the hero's and the closing section's two actions.
 * The hero also links the hosted demo ("Try the demo"). */
export function Actions({ stacked = false, demo = false }: { stacked?: boolean; demo?: boolean }) {
  return (
    <div className={stacked ? 'actions actions-stacked' : 'actions'}>
      <a className="btn btn-lg" href="/run">Run Chest <span className="arrow" aria-hidden="true">→</span></a>
      {demo ? <a className="btn btn-lg btn-outline" href="https://demo.run-chest.com/">Try the demo</a> : null}
      <a className="link actions-docs" href="/docs">Read the docs</a>
    </div>
  )
}
