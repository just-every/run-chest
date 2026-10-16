import type { ReactNode } from 'react'
import { prose } from './Prose'

export type Box = { x: number; y: number; w: number; h?: number }

export type FeatureProps = {
  id: string
  eyebrow: string
  /** The heading as two parts: ink, then the violet-to-blue gradient. `<br>` breaks are given as "\n". */
  ink: string
  grad: string
  lead: string
  art: ReactNode
  /** Desk-pixel geometry at 1536 wide: the section's height, where its copy and art sit, and optional panels. */
  height: number
  copy: Box
  at: { x: number; y: number }
  size?: number
  leadSize?: number
  /** Where the paragraph wraps on the desk, in desk pixels. */
  leadWidth?: number
  tracked?: boolean
  panels?: Box[]
  /** Which side the art takes when the section reflows to a column (phones): it always follows the copy. */
  side: 'left' | 'right'
}

const lines = (text: string) => text.split('\n').flatMap((line, index) => (index ? [<br key={index} />, line] : [line]))

/** One idea: an eyebrow, a two-tone heading, one paragraph and its drawn screen, placed as on the desk page. */
export function Feature({ id, eyebrow, ink, grad, lead, art, height, copy, at, size = 88, leadSize = 24, leadWidth, tracked = false, panels = [], side }: FeatureProps) {
  return (
    <section id={id} className={`feature feature-art-${side}`} style={{ height: `${height / 10}em` }} aria-labelledby={`${id}-title`}>
      {panels.map((panel, index) => <span key={index} className="panel" aria-hidden="true" style={{ left: `${panel.x / 10}em`, top: `${panel.y / 10}em`, width: `${panel.w / 10}em`, height: `${(panel.h ?? 0) / 10}em` }} />)}
      <div className="feature-copy" style={{ left: `${copy.x / 10}em`, top: `${copy.y / 10}em`, width: `${copy.w / 10}em` }}>
        <p className={tracked ? 'eyebrow eyebrow-wide' : 'eyebrow'}>{eyebrow}</p>
        <h2 id={`${id}-title`} className="two-tone" style={{ fontSize: `${size / 10}em` }}><span className="ink-part">{lines(ink)}</span>{ink.endsWith('\n') ? null : ' '}{lines(grad)}</h2>
        <p className="lead" style={{ fontSize: `${leadSize / 10}em`, maxWidth: leadWidth ? `${leadWidth / leadSize}em` : undefined }}>{prose(lead)}</p>
      </div>
      <div className="feature-art" style={{ left: `${at.x / 10}em`, top: `${at.y / 10}em` }}>{art}</div>
    </section>
  )
}
