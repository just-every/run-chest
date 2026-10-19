// Chest's app icons as SVG markup, inserted by the server-rendered pages: 24 px line icons (round 1.7 px strokes),
// the coloured file-type tiles and the smiling-file mark of the Chest agent. Decorative only.
const svg = (body: string, viewBox = '0 0 24 24') => `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`

export const icons = {
  document: svg('<path d="M6.5 2.75h7.25l4.5 4.5v13a1 1 0 0 1-1 1h-10.75a1 1 0 0 1-1-1V3.75a1 1 0 0 1 1-1z"/><path d="M13.5 2.75v4.75h4.75"/>'),
  person: svg('<circle cx="12" cy="7.75" r="4"/><path d="M4.25 21.25a7.75 7.75 0 0 1 15.5 0z"/>'),
  people: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.75 20.25a6.25 6.25 0 0 1 12.5 0"/><path d="M15 4.75a3.5 3.5 0 0 1 0 6.5M17.5 14.25a6.25 6.25 0 0 1 3.75 6"/>'),
  search: svg('<circle cx="10.5" cy="10.5" r="6.75"/><path d="m15.5 15.5 5.25 5.25"/>'),
  chevron: svg('<path d="m9 5.5 6.5 6.5L9 18.5"/>'),
  down: svg('<path d="m6 9.5 6 6 6-6"/>'),
  up: svg('<path d="M12 19V5M6.5 10.5 12 5l5.5 5.5"/>'),
  alert: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/>'),
  folder: svg('<path d="M3 6.75A1.75 1.75 0 0 1 4.75 5h4.5l2 2.25h8A1.75 1.75 0 0 1 21 9v9.25A1.75 1.75 0 0 1 19.25 20H4.75A1.75 1.75 0 0 1 3 18.25z"/>'),
  clock: svg('<circle cx="12" cy="12" r="8.75"/><path d="M12 7.25V12l3.25 2.25"/>'),
  star: svg('<path d="m12 3.5 2.6 5.3 5.9.9-4.25 4.1 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.7l5.9-.9z"/>'),
  inbox: svg('<path d="M4 13.5 6.5 5h11l2.5 8.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4 13.5h4.5l1 2h5l1-2H20"/>'),
  trash: svg('<path d="M4.5 6.5h15M9.5 6.5V4.25h5V6.5M6.5 6.5l.9 13.1a1 1 0 0 0 1 .9h7.2a1 1 0 0 0 1-.9l.9-13.1M10 10.5v6M14 10.5v6"/>'),
  link: svg('<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>'),
  bell: svg('<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14zM10 20.5h4"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  upload: svg('<path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9M5 15v4.5h14V15"/>'),
  share: svg('<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  laptop: svg('<path d="M5 5.5h14v10H5zM2.5 18.5h19"/>'),
  phone: svg('<path d="M8 2.75h8a1.25 1.25 0 0 1 1.25 1.25v16A1.25 1.25 0 0 1 16 21.25H8A1.25 1.25 0 0 1 6.75 20V4A1.25 1.25 0 0 1 8 2.75zM11 18.25h2"/>'),
  devices: svg('<path d="M4 15.5V6a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v2M2.5 18.5h11M14.5 10.5h5a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z"/>'),
  cloud: svg('<path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.5 1.6 3.8 3.8 0 0 1-.4 7.4z"/>'),
  cloudOff: svg('<path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.5 1.6 3.8 3.8 0 0 1-.4 7.4zM4 4l16 16"/>'),
  sync: svg('<path d="M19.5 12a7.5 7.5 0 0 1-13 5.1M4.5 12a7.5 7.5 0 0 1 13-5.1M17.5 3.5v3.4h-3.4M6.5 20.5v-3.4h3.4"/>'),
  warn: svg('<path d="M12 4 21 19.5H3z"/><path d="M12 10v4M12 17h.01"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  books: svg('<path d="M4.5 4.5h4v15h-4zM8.5 4.5h4v15h-4zM13 5.5l3.9-1 3.6 14.5-3.9 1z"/>'),
  move: svg('<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5V18A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18zM9.5 13.75h6M13 11l2.75 2.75L13 16.5"/>'),
  audit: svg('<path d="M6.5 2.75h7.25l4.5 4.5v13a1 1 0 0 1-1 1h-10.75a1 1 0 0 1-1-1V3.75a1 1 0 0 1 1-1zM9 12.5h6M9 16h4"/>'),
  plug: svg('<path d="M9 3.5v4M15 3.5v4M6.5 7.5h11v3.5a5.5 5.5 0 0 1-11 0zM12 16.5v4"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2.75v2.5M12 18.75v2.5M2.75 12h2.5M18.75 12h2.5M5.45 5.45l1.77 1.77M16.78 16.78l1.77 1.77M5.45 18.55l1.77-1.77M16.78 7.22l1.77-1.77"/>'),
  shield: svg('<path d="M12 3 19.5 6v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z"/>'),
  sparkle: svg('<path d="M12 3.5c.8 4.4 3.3 6.9 7.5 7.6-4.2.8-6.7 3.3-7.5 7.6-.8-4.3-3.3-6.8-7.5-7.6 4.2-.7 6.7-3.2 7.5-7.6z"/>'),
  list: svg('<path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  signout: svg('<path d="M14.5 4.5h4a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-4M10 16.5 14.5 12 10 7.5M14.5 12H4"/>'),
}
export type IconName = keyof typeof icons

// File-type tiles, as the picked app look draws them: a coloured page (Word blue, Excel green, PowerPoint orange,
// PDF red) or a soft image, archive or text page. The kind comes from the file's extension.
export type FileKind = 'word' | 'sheet' | 'slides' | 'pdf' | 'image' | 'archive' | 'text' | 'file' | 'folder'
export function fileKind(name: string, type = 'file'): FileKind {
  if (type === 'folder') return 'folder'
  const ext = name.toLowerCase().split('.').at(-1) ?? ''
  return /^(docx?|odt|rtf)$/.test(ext) ? 'word' : /^(xlsx?|ods|csv|numbers)$/.test(ext) ? 'sheet' : /^(pptx?|odp|key)$/.test(ext) ? 'slides' : ext === 'pdf' ? 'pdf' : /^(jpe?g|png|gif|webp|heic|svg|tiff?)$/.test(ext) ? 'image' : /^(zip|tar|gz|7z|rar)$/.test(ext) ? 'archive' : /^(txt|md|markdown|json|log)$/.test(ext) ? 'text' : 'file'
}
const page = (fill: string, inner: string, fold = 'rgba(255,255,255,.45)') => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5.5 2h9.25L20 7.25V21a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" fill="${fill}"/><path d="M14.75 2v4.25a1 1 0 0 0 1 1H20" fill="${fold}"/>${inner}</svg>`
const letter = (l: string) => `<text x="12" y="17.6" text-anchor="middle" fill="#fff" font-family="Inter, system-ui, sans-serif" font-size="9.5" font-weight="700">${l}</text>`
const tiles: Record<FileKind, string> = {
  word: page('#2b6ff2', letter('W')),
  sheet: page('#1f9d55', letter('X')),
  slides: page('#f0602a', letter('P')),
  pdf: page('#e5484d', '<path d="M8 17.5h8M8 14.5h8M8 11.5h4.5" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>'),
  image: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="16" rx="2.5" fill="#3c8cf6"/><path d="M5 17.5l4.6-5.1 3.4 3.5 2.5-2.5 3.5 4.1z" fill="#fff" fill-opacity=".92"/><circle cx="15.6" cy="8.8" r="1.6" fill="#fff"/></svg>`,
  archive: page('#c9ccd8', '<path d="M11 4.5h2M11 7h2M11 9.5h2M11 12h2M10.5 14h3v3.5h-3z" stroke="#fff" stroke-width="1.3"/>', 'rgba(255,255,255,.6)'),
  text: page('#c9ccd8', '<path d="M8 11.5h8M8 14.5h8M8 17.5h5" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>', 'rgba(255,255,255,.6)'),
  file: page('#c9ccd8', '', 'rgba(255,255,255,.6)'),
  folder: icons.folder,
}
export const fileTile = (kind: FileKind) => `<span class="ftile ftile-${kind}" aria-hidden="true">${tiles[kind]}</span>`

// The Chest agent: a tilted file with a smile and three "look here" ticks, in the brand violet.
export const agentMark = `<svg class="agent-mark" viewBox="0 0 56 56" aria-hidden="true" focusable="false"><ellipse cx="29" cy="34" rx="20" ry="17" fill="#eeeaff"/><path d="M8 9.5 11.5 14M4.5 17.5l5 .8M14 4.5l.8 5.2" stroke="#7c48fd" stroke-width="2.4" stroke-linecap="round"/><g transform="rotate(-12 31 30)"><path d="M20 12h15.5l8.5 8.5V46a2.5 2.5 0 0 1-2.5 2.5H20a2.5 2.5 0 0 1-2.5-2.5V14.5A2.5 2.5 0 0 1 20 12z" fill="#fff" stroke="#3b2bd8" stroke-width="2.6" stroke-linejoin="round"/><path d="M35.5 12v6.5a2 2 0 0 0 2 2H44" fill="none" stroke="#3b2bd8" stroke-width="2.6" stroke-linejoin="round"/><circle cx="26.5" cy="30" r="1.9" fill="#3b2bd8"/><circle cx="35" cy="30" r="1.9" fill="#3b2bd8"/><path d="M25.5 36.5c2.8 3 7.5 3 10.2 0" fill="none" stroke="#3b2bd8" stroke-width="2.4" stroke-linecap="round"/></g></svg>`
