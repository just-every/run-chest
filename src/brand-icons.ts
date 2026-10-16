// The icons every Chest page declares (the run site, the app and its refusal page): the hand-tuned 16 px and 32 px
// favicons (public/brand/favicon-16.svg, favicon-32.svg, rendered to PNG) and the 180 px touch icon.
export const iconLinks = [
  { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/brand/favicon-32.png' },
  { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/brand/favicon-16.png' },
  { rel: 'apple-touch-icon', sizes: '180x180', href: '/brand/apple-touch-icon.png' },
] as const

export const iconHead = iconLinks.map(link => `<link ${Object.entries(link).map(([name, value]) => `${name}="${value}"`).join(' ')}>`).join('')
