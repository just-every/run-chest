import type { CSSProperties, ReactNode } from 'react'

/**
 * One piece of a drawn collage, placed in desk pixels: the desk images were drawn at 1536 px wide, and a stage's
 * 1em is 10 of those pixels, so x, y and w are the desk's own measurements divided by ten. `r` turns it (degrees).
 * `phone` is the piece's place when a flowing stage stacks its pieces in the phone column (lower first), or false
 * to leave it out there.
 */
export function Place({ x, y, w, h, r = 0, z, phone = 0, className = '', children, style }: { x: number; y: number; w?: number; h?: number; r?: number; z?: number; phone?: number | false; className?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div className={`at${phone === false ? ' phone-out' : ''} ${className}`.trim()} style={{ left: `${x / 10}em`, top: `${y / 10}em`, width: w === undefined ? undefined : `${w / 10}em`, height: h === undefined ? undefined : `${h / 10}em`, rotate: r ? `${r}deg` : undefined, zIndex: z, ...(phone ? { '--phone-order': phone } : {}), ...style } as CSSProperties}>
      {children}
    </div>
  )
}

/**
 * A collage's stage: `w` by `h` desk pixels, scaled with the page. Below 1280 px it stacks its pieces as whole cards
 * at readable sizes and leaves the hand-drawn marks out (art.css).
 */
export function Stage({ w, h, className = '', label, children }: { w: number; h: number; className?: string; label: string; children: ReactNode }) {
  return (
    <div className="stage-flow">
      <figure className={`stage ${className}`.trim()} style={{ width: `${w / 10}em`, height: `${h / 10}em` }} role="img" aria-label={label}>
        {children}
      </figure>
    </div>
  )
}
