import type { CSSProperties, ReactNode } from 'react'

/**
 * One piece of a drawn collage, placed in desk pixels: the desk images were drawn at 1536 px wide, and a stage's
 * 1em is 10 of those pixels, so x, y and w are the desk's own measurements divided by ten. `r` turns it (degrees).
 */
export function Place({ x, y, w, h, r = 0, z, className = '', children, style }: { x: number; y: number; w?: number; h?: number; r?: number; z?: number; className?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div className={`at ${className}`.trim()} style={{ left: `${x / 10}em`, top: `${y / 10}em`, width: w === undefined ? undefined : `${w / 10}em`, height: h === undefined ? undefined : `${h / 10}em`, rotate: r ? `${r}deg` : undefined, zIndex: z, ...style }}>
      {children}
    </div>
  )
}

/** A window onto part of a stage, in desk pixels, for the phone layout. */
export type Crop = { x: number; y?: number; w: number; h: number }

/**
 * A collage's stage: `w` by `h` desk pixels, scaled with the page. In the phone column it scales to the column's
 * width; with `crop` it shows only that window of the drawing (the art cropped, the cards kept legible).
 */
export function Stage({ w, h, crop, className = '', label, children }: { w: number; h: number; crop?: Crop; className?: string; label: string; children: ReactNode }) {
  const window = crop ?? { x: 0, y: 0, w, h }
  const vars = { '--sw': window.w / 10, '--sh': window.h / 10, '--sx': window.x / 10, '--sy': (window.y ?? 0) / 10 } as CSSProperties
  return (
    <div className={crop ? 'stage-window stage-cropped' : 'stage-window'} style={vars}>
      <figure className={`stage ${className}`.trim()} style={{ width: `${w / 10}em`, height: `${h / 10}em` }} role="img" aria-label={label}>
        {children}
      </figure>
    </div>
  )
}
