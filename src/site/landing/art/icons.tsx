// The drawn product screens' line icons and coloured file-type tiles, from Chest's one set of shapes (src/ui/icons.ts).
import { fileGlyphs, lines, type FileKind, type LineName } from '../../../ui/icons'

export type IconName = LineName
export type { FileKind }

/** A line icon; decorative unless given a label. */
export function Icon({ name, className = 'ico', label }: { name: IconName; className?: string; label?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === 'dots' ? 3.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d={lines[name]} />
    </svg>
  )
}

/** "…": the row menu on every drawn file row. */
export const More = () => <Icon name="dots" className="ico more" />

/** A file-type tile: a coloured page (or folder) glyph on a soft square, as the desk draws them. */
export function FileTile({ kind, className = '' }: { kind: FileKind; className?: string }) {
  return <span className={`tile tile-${kind} ${className}`.trim()} aria-hidden="true" dangerouslySetInnerHTML={{ __html: fileGlyphs[kind] }} />
}
