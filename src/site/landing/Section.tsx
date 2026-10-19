import type { ReactNode } from 'react'
import type { SectionCopy } from './copy'
import { prose } from './Prose'

const lines = (text: string) => text.split('\n').flatMap((line, index) => (index ? [<br key={index} className="desk-br" />, line] : [line]))

/**
 * One day in the supplier's folder: a date eyebrow, a two-tone heading, one paragraph and the drawn screen. `layout`
 * puts the copy left of the drawing, right of it, or centred above it, as the desk drew each page; below 1280 px
 * every section is a column, copy first.
 */
export function Section({ id, copy, layout, className, children }: { id: string; copy: SectionCopy; layout: 'left' | 'right' | 'center'; className: string; children: ReactNode }) {
  const { eyebrow, ink, grad, lead } = copy
  return (
    <section id={id} className={`sec sec-${layout} ${className}`} aria-labelledby={`${id}-title`}>
      <div className="sec-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={`${id}-title`}><span className="ink-part">{lines(ink)}</span>{ink.endsWith('\n') ? ' ' : null}<span className="grad-part">{lines(grad)}</span></h2>
        <p className="lead">{prose(lead)}</p>
      </div>
      <div className="sec-art">{children}</div>
    </section>
  )
}
