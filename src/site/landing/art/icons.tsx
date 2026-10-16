// Line icons for the drawn product screens (24 px grid, round 1.8 px strokes), and the coloured file-type tiles.

const lines = {
  link: 'M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  calendar: 'M4.5 6.5h15v13h-15zM4.5 10.5h15M8.5 4v4M15.5 4v4',
  download: 'M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14',
  upload: 'M12 16V5M7.5 9.5 12 5l4.5 4.5M5 19.5h14',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  clock: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 7.5V12l3 2.5M3.5 12H2',
  history: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9M4.5 4.5V9H9M12 8v4l3 2',
  merge: 'M7 5.5a2 2 0 1 0 0 .01M17 5.5a2 2 0 1 0 0 .01M12 19a2 2 0 1 0 0 .01M7 7.5c0 4 5 4 5 9.5M17 7.5c0 4-5 4-5 9.5',
  shield: 'M12 3.5 5 6v5.5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c.5-3.5 3-5.5 6-5.5s5.5 2 6 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.8c1.7.7 2.8 2.5 3 5.2',
  database: 'M12 3.5c4.4 0 7.5 1.3 7.5 3s-3.1 3-7.5 3-7.5-1.3-7.5-3 3.1-3 7.5-3zM4.5 6.5v11c0 1.7 3.1 3 7.5 3s7.5-1.3 7.5-3v-11M4.5 12c0 1.7 3.1 3 7.5 3s7.5-1.3 7.5-3',
  monitor: 'M3.5 4.5h17v11h-17zM12 15.5v4M8 19.5h8',
  share: 'M12 15V3.5M7.5 8 12 3.5 16.5 8M6 11H4.5v9.5h15V11H18',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  trash: 'M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 14h9l1-14M10 10.5v6.5M14 10.5v6.5',
  list: 'M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01',
  cloudUp: 'M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.5 1.6A3.8 3.8 0 0 1 17.5 18.5M12 20v-7.5M9 15l3-3 3 3',
  fileCheck: 'M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8zM14 3.5V8h4.5M9 14l2 2 4-4',
  undo: 'M9 14 4.5 9.5 9 5M4.5 9.5h9a5.5 5.5 0 0 1 0 11H11',
  wifi: 'M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01',
  chevronDown: 'M6 9.5l6 6 6-6',
  plus: 'M12 5v14M5 12h14',
  arrowRight: 'M4.5 12h14M13.5 7l5 5-5 5',
  alert: 'M12 4 2.8 19.5h18.4zM12 10v4.5M12 17.2h.01',
  comment: 'M4.5 5h15v11h-9l-4.5 3.5V16h-1.5z',
  bold: 'M7 4.5h6a3.5 3.5 0 0 1 0 7H7zM7 11.5h7a3.8 3.8 0 0 1 0 7.5H7z',
  italic: 'M14 4.5h-4M14 19.5h-4M14.5 4.5l-5 15',
  underline: 'M7 4.5v6a5 5 0 0 0 10 0v-6M5.5 20h13',
  alignLeft: 'M4 6h16M4 10h10M4 14h16M4 18h10',
  alignCenter: 'M4 6h16M7 10h10M4 14h16M7 18h10',
  alignRight: 'M4 6h16M10 10h10M4 14h16M10 18h10',
  bullets: 'M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01',
  image: 'M4 5h16v14H4zM4 15.5l4.5-4.5 4 4 3-3 4.5 4.5M15.5 9.5h.01',
  folder: 'M3.5 6.5h6l2 2h9v10h-17z',
  cloud: 'M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.5 1.6 3.8 3.8 0 0 1-.4 7.4z',
  dots: 'M5.5 12h.01M12 12h.01M18.5 12h.01',
} as const

export type IconName = keyof typeof lines

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

export type FileKind = 'doc' | 'word' | 'sheet' | 'slides' | 'pdf' | 'image' | 'folder'

/** A file-type tile: a coloured page (or folder) glyph on a soft square, as the desk draws them. */
export function FileTile({ kind, className = '' }: { kind: FileKind; className?: string }) {
  return <span className={`tile tile-${kind} ${className}`.trim()} aria-hidden="true"><FileGlyph kind={kind} /></span>
}

export function FileGlyph({ kind }: { kind: FileKind }) {
  switch (kind) {
    case 'doc': return <svg viewBox="0 0 24 24"><path d="M6.5 2.5h8l5 5v13a1 1 0 0 1-1 1h-12a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1z" fill="currentColor" /><path d="M14.5 2.5v4a1 1 0 0 0 1 1h4" fill="#fff" fillOpacity=".45" /><path d="M8.5 12h7M8.5 15h7M8.5 18h4.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" /></svg>
    case 'word': return <svg viewBox="0 0 24 24"><path d="M8 2.5h9l4 4v14a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1z" fill="#fff" stroke="#c9d6f3" /><path d="M11 10h7M11 13h7M11 16h7" stroke="#9db6ea" strokeWidth="1.2" strokeLinecap="round" /><rect x="2.5" y="7" width="10" height="10" rx="1.6" fill="#2b5fd9" /><path d="M4.6 9.4l1.1 5.2 1.8-4.4 1.8 4.4 1.1-5.2" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    case 'sheet': return <svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="3" fill="currentColor" /><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>
    case 'slides': return <svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="3" fill="currentColor" /><rect x="8" y="7.5" width="8" height="6" rx="1" fill="none" stroke="#fff" strokeWidth="1.6" /><path d="M12 13.5V17M9.5 17h5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" /></svg>
    case 'pdf': return <svg viewBox="0 0 24 24"><path d="M12.2 4.2c-1.4 0-1.2 3 .5 6.3 1.4 2.8 3.4 5 5.4 5.6 2.1.6 2.7-1.1.9-1.6-2.6-.7-7.8.2-11.1 2.2-2.6 1.6-2.4 3.4-.8 2.8 1.8-.7 4.2-5.6 5.1-9.5.6-2.8.8-5.8 0-5.8z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
    case 'image': return <svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" fill="currentColor" /><path d="M5.5 17.5l4.5-5 3.5 3.5 2.5-2.5 3 4" fill="#fff" fillOpacity=".9" /><circle cx="15.5" cy="9" r="1.6" fill="#fff" /></svg>
    case 'folder': return <svg viewBox="0 0 24 24"><path d="M2.5 6.5a1.5 1.5 0 0 1 1.5-1.5h5l2 2h9a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5z" fill="currentColor" /><path d="M2.5 9.5h19" stroke="#fff" strokeOpacity=".35" /></svg>
  }
}
