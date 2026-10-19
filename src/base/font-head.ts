// Shared by the root renderer and the no-JavaScript first-run document.
// Chest preloads its Latin Inter file (every heading and body line) and links
// the one stylesheet that declares its faces (public/fonts/fonts.css).
export const fontLinks = [
  { rel: 'preload', href: '/fonts/inter/inter-latin-opsz-normal.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
  { rel: 'stylesheet', href: '/fonts/fonts.css' },
] as const

export const fontHead = fontLinks.map(link => `<link ${Object.entries(link).map(([name, value]) => `${name.toLowerCase()}="${value}"`).join(' ')}>`).join('')
