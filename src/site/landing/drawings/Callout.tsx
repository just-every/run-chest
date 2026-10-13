/** A hand-inked cobalt callout: a circled numeral (hidden from assistive tech), the note, and an arrow to its row. */
export function Callout({ n, children }: { n: number; children: string }) {
  return (
    <span className="callout">
      <span className="callout-num" aria-hidden="true">{n}</span>
      <span className="callout-text">{children}</span>
      <svg className="callout-arrow" viewBox="0 0 44 20" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M2 11c9-2.5 21-3.4 37-1.6M31 3.5l8.4 5.9-8 6.6" /></svg>
    </span>
  )
}
