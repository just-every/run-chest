import type { ReactNode } from 'react'
import { Actions } from './Actions'

export type SectionProps = { id: string; heading: string; line?: string; drawing: ReactNode; label: string; closing?: boolean; side: 'left' | 'right' }

/** One section: a heading, one line (or the closing actions), and one drawing that alternates sides at 1440. */
export function Section({ id, heading, line, drawing, label, closing, side }: SectionProps) {
  return (
    <section id={id} className={`band band-${side}`} aria-labelledby={`${id}-title`}>
      <div className="band-copy">
        <h2 id={`${id}-title`}>{heading}</h2>
        {line ? <p className="band-line">{line}</p> : null}
        {closing ? <Actions stacked /> : null}
      </div>
      <figure className={`drawing drawing-${id}`} aria-label={label}>{drawing}</figure>
    </section>
  )
}
