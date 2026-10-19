// Line icons for the drawn product screens (24 px grid, round 1.8 px strokes), a few filled glyphs, the coloured
// file-type tiles and the large Office file badges.

const lines = {
  link: 'M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2',
  download: 'M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  checkCircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.3l2.8 2.8L16.2 9.6',
  clock: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 7.5V12l3 2.5',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c.5-3.5 3-5.5 6-5.5s5.5 2 6 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.8c1.7.7 2.8 2.5 3 5.2',
  folder: 'M3.5 6.5h6l2 2h9v10h-17z',
  chart: 'M6 19.5v-6M12 19.5V8M18 19.5V4.5',
  grid: 'M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z',
  mail: 'M3 6h18v12.5H3zM3.5 6.5l8.5 6.5 8.5-6.5',
  phone: 'M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5zM10.5 5h3M11 18.5h2',
  laptop: 'M5 5.5h14v10H5zM2.5 18.5h19l-1.5-3H4z',
  cloud: 'M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.5 1.6 3.8 3.8 0 0 1-.4 7.4z',
  wifi: 'M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01',
  chevronLeft: 'M15 5.5 8.5 12l6.5 6.5',
  arrowRight: 'M4.5 12h14M13.5 7l5 5-5 5',
  bold: 'M7 4.5h6a3.5 3.5 0 0 1 0 7H7zM7 11.5h7a3.8 3.8 0 0 1 0 7.5H7z',
  italic: 'M14 4.5h-4M14 19.5h-4M14.5 4.5l-5 15',
  underline: 'M7 4.5v6a5 5 0 0 0 10 0v-6M5.5 20h13',
  alignLeft: 'M4 6h16M4 10h10M4 14h16M4 18h10',
  bullets: 'M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01',
  table: 'M4 5h16v14H4zM4 10h16M4 14.5h16M10 5v14',
  docLines: 'M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8zM14 3.5V8h4.5M9 12.5h6M9 16h6',
  // the approved mark's open chest, as an outline: lid, box and the file peeking out
  chestOutline: 'M5 10.5h14v9H5zM5 10.5 6.5 5h11l1.5 5.5M9 10.5V7.5h6v3M10.5 14h3',
  dots: 'M5.5 12h.01M12 12h.01M18.5 12h.01',
} as const

/** Filled glyphs: the agent's sparkle, a solid folder and a solid check badge (white tick on the colour). */
const fills = {
  sparkle: { d: 'M12 2.5c.9 4.8 3.7 7.6 8.5 8.5-4.8.9-7.6 3.7-8.5 8.5-.9-4.8-3.7-7.6-8.5-8.5 4.8-.9 7.6-3.7 8.5-8.5z' },
  folderFill: { d: 'M2.5 6.5A1.5 1.5 0 0 1 4 5h5l2 2h9a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 20 20H4a1.5 1.5 0 0 1-1.5-1.5z' },
  checkFill: { d: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', tick: 'M7.6 12.4l3 3 5.8-6.2' },
} as const

export type IconName = keyof typeof lines | keyof typeof fills

/** An icon; decorative unless given a label. */
export function Icon({ name, className = 'ico', label }: { name: IconName; className?: string; label?: string }) {
  const a11y = { role: label ? 'img' : undefined, 'aria-label': label, 'aria-hidden': label ? undefined : true } as const
  if (name in fills) {
    const glyph: { d: string; tick?: string } = fills[name as keyof typeof fills]
    return (
      <svg className={className} viewBox="0 0 24 24" {...a11y}>
        <path d={glyph.d} fill="currentColor" />
        {glyph.tick ? <path d={glyph.tick} fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /> : null}
      </svg>
    )
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === 'dots' ? 3.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" {...a11y}>
      <path d={lines[name as keyof typeof lines]} />
    </svg>
  )
}

/** "…": the row menu on every drawn file row. */
export const More = () => <Icon name="dots" className="ico more" />

export type FileKind = 'doc' | 'sheet' | 'pdf' | 'image' | 'folder'

/** A file-type tile: a coloured page (or folder) glyph on a soft square, as the desk draws them. */
export function FileTile({ kind, className = '' }: { kind: FileKind; className?: string }) {
  return <span className={`tile tile-${kind} ${className}`.trim()} aria-hidden="true"><FileGlyph kind={kind} /></span>
}

function FileGlyph({ kind }: { kind: FileKind }) {
  switch (kind) {
    case 'doc': return <svg viewBox="0 0 24 24"><path d="M6.5 2.5h8l5 5v13a1 1 0 0 1-1 1h-12a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1z" fill="currentColor" /><path d="M14.5 2.5v4a1 1 0 0 0 1 1h4" fill="#fff" fillOpacity=".45" /><path d="M8.5 12h7M8.5 15h7M8.5 18h4.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" /></svg>
    case 'sheet': return <svg viewBox="0 0 24 24"><path d="M8 7.5l8 9M16 7.5l-8 9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
    case 'pdf': return <svg viewBox="0 0 24 24"><path d="M12.2 4.2c-1.4 0-1.2 3 .5 6.3 1.4 2.8 3.4 5 5.4 5.6 2.1.6 2.7-1.1.9-1.6-2.6-.7-7.8.2-11.1 2.2-2.6 1.6-2.4 3.4-.8 2.8 1.8-.7 4.2-5.6 5.1-9.5.6-2.8.8-5.8 0-5.8z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
    case 'image': return <svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" fill="currentColor" /><path d="M5.5 17.5l4.5-5 3.5 3.5 2.5-2.5 3 4" fill="#fff" fillOpacity=".9" /><circle cx="15.5" cy="9" r="1.6" fill="#fff" /></svg>
    case 'folder': return <svg viewBox="0 0 24 24"><path d="M2.5 6.5a1.5 1.5 0 0 1 1.5-1.5h5l2 2h9a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5z" fill="currentColor" /><path d="M2.5 9.5h19" stroke="#fff" strokeOpacity=".35" /></svg>
  }
}

const office = { word: { fill: '#2b6ff2', letter: 'W' }, sheet: { fill: '#1f9d55', letter: 'X' }, slides: { fill: '#f0602a', letter: 'P' } } as const

/** A large Word, Excel or PowerPoint file badge: a page in the app's colour with its folded corner and letter. */
export function AppFile({ kind, className = '' }: { kind: keyof typeof office; className?: string }) {
  const { fill, letter } = office[kind]
  return (
    <svg className={`app-file ${className}`.trim()} viewBox="0 0 40 44" aria-hidden="true">
      <path d="M4 1h23l12 12v28a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2z" fill={fill} />
      <path d="M27 1v10a2 2 0 0 0 2 2h10" fill="#fff" fillOpacity=".4" />
      <text x="19" y="32" textAnchor="middle" fill="#fff" fontFamily="Inter, system-ui, sans-serif" fontSize="19" fontWeight="700">{letter}</text>
    </svg>
  )
}
