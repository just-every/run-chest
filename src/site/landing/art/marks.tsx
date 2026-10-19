// The desk's hand-drawn layer, as inline SVG: the three-stroke "look here" ticks, the looping arrows, the
// lilac sticky notes in handwriting, and the named collaborator cursors.
import type { CSSProperties, ReactNode } from 'react'

type Placed = { className?: string; style?: CSSProperties }

/** Three short violet strokes fanning out from a corner. `turn` rotates the fan (degrees). */
export function Ticks({ className = '', style, turn = 0 }: Placed & { turn?: number }) {
  return (
    <svg className={`ticks ${className}`.trim()} style={{ ...style, rotate: `${turn}deg` }} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M9 23 12 5M15 27 29 13M17 33l18-4" />
    </svg>
  )
}

const arrows = {
  // a short dash with a head, slightly bowed
  short: { box: '0 0 60 30', d: 'M3 21c14-2 32-6 48-11', head: 'M42 5l10 5-7 9' },
  // a C-shaped loop coming down then right
  hook: { box: '0 0 60 100', d: 'M40 4C14 18 4 52 18 78c4 8 12 12 26 12', head: 'M35 82l10 8-11 6' },
  // a two-headed swoop
  both: { box: '0 0 110 60', d: 'M8 46c26 8 64 6 92-36', head: 'M90 13l11-4 1 12M19 37l-11 9 13 4' },
} as const

/** A hand-drawn violet arrow. */
export function Arrow({ kind, className = '', style }: Placed & { kind: keyof typeof arrows }) {
  const a = arrows[kind]
  return (
    <svg className={`arrow-ink arrow-${kind} ${className}`.trim()} style={style} viewBox={a.box} aria-hidden="true">
      <path d={a.d} /><path d={a.head} />
    </svg>
  )
}

/** A lilac sticky note in handwriting. */
export function Sticky({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`sticky ${className}`.trim()}><span>{children}</span></p>
}

/** A collaborator's pointer and name tag (violet Dana, green Luis). */
export function Cursor({ name, tone, className = '', style }: Placed & { name: string; tone: 'violet' | 'green' }) {
  return (
    <span className={`cursor cursor-${tone} ${className}`.trim()} style={style} aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M4 2.5l15 9.5-6.8 1.4-3.6 6.4z" /></svg>
      <b>{name}</b>
    </span>
  )
}

/** A round initial avatar. */
export function Avatar({ initial, tone }: { initial: string; tone: 'violet' | 'green' | 'blue' | 'peach' | 'amber' }) {
  return <span className={`avatar avatar-${tone}`} aria-hidden="true">{initial}</span>
}
