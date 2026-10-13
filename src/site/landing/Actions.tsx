/** "Run Chest →" (to /run) and "Read the docs": the hero's and the closing section's two actions. */
export function Actions({ stacked = false }: { stacked?: boolean }) {
  return (
    <div className={stacked ? 'actions actions-stacked' : 'actions'}>
      <a className="btn btn-lg" href="/run">Run Chest <span className="arrow" aria-hidden="true">→</span></a>
      <a className="link actions-docs" href="/docs">Read the docs</a>
    </div>
  )
}
