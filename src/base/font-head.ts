// Shared by the root renderer, the no-JavaScript first-run document, the app's
// documents and the sign-in pages. Chest preloads its Latin Inter file (every
// heading and body line) and links its look (public/fonts/fonts.css: Chest's own
// tokens and the rules that dress Base's pages; the faces are in the theme).
export const fontLinks = [
  { rel: 'preload', href: '/fonts/inter/inter-latin-opsz-normal.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
  { rel: 'stylesheet', href: '/fonts/fonts.css' },
] as const

export const fontHead = fontLinks.map(link => `<link ${Object.entries(link).map(([name, value]) => `${name.toLowerCase()}="${value}"`).join(' ')}>`).join('')
