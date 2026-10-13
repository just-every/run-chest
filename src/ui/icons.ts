// Chest's line icons and the folder tab outline, as SVG markup: the app's server-rendered pages and the
// run site's React drawings both insert these strings, so each shape is drawn once. Decorative only.
const svg = (body: string, viewBox = '0 0 24 24') => `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`

export const icons = {
  document: svg('<path d="M6.5 2.75h7.25l4.5 4.5v13a1 1 0 0 1-1 1h-10.75a1 1 0 0 1-1-1V3.75a1 1 0 0 1 1-1z"/><path d="M13.5 2.75v4.75h4.75"/><path d="M8.75 12.5h6.5M8.75 16h6.5"/>'),
  building: svg('<path d="M4.5 21.25V3.75a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17.5"/><path d="M14.5 9.25h4a1 1 0 0 1 1 1v11"/><path d="M3 21.25h18"/><path d="M7.75 6.5h1.5M10.75 6.5h1.5M7.75 10h1.5M10.75 10h1.5M7.75 13.5h1.5M10.75 13.5h1.5M8.5 21.25V17.5h3v3.75M16.75 13h.5M16.75 16.5h.5"/>'),
  person: svg('<circle cx="12" cy="7.75" r="4"/><path d="M4.25 21.25a7.75 7.75 0 0 1 15.5 0z"/>'),
  people: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.75 20.25a6.25 6.25 0 0 1 12.5 0z"/><path d="M15 4.75a3.5 3.5 0 0 1 0 6.5M17.5 14.25a6.25 6.25 0 0 1 3.75 6h-3"/>'),
  calendar: svg('<rect x="3.25" y="4.75" width="17.5" height="16.5" rx="1.5"/><path d="M3.25 9.75h17.5M8 2.75v4M16 2.75v4"/><path d="M7.5 13.5h1M11.5 13.5h1M15.5 13.5h1M7.5 17h1M11.5 17h1M15.5 17h1"/>'),
  search: svg('<circle cx="10.5" cy="10.5" r="6.75"/><path d="m15.5 15.5 5.25 5.25"/>'),
  chevron: svg('<path d="m9 5.5 6.5 6.5L9 18.5"/>'),
  alert: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/>'),
}

/** The manila folder's index tab: shoulders at 45°, top corners rounded; stretched to its box. */
export const folderTab = '<svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 31V30c3 0 4.2-1.6 5-3.6L12.4 4C13.3 1.6 15 0 18 0h64c3 0 4.7 1.6 5.6 4l7.4 22.4c.8 2 2 3.6 5 3.6v1"/></svg>'
