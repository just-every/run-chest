import { iconHead } from '../brand-icons'
import { identity } from '../identity'

export { iconLinks } from '../brand-icons'

/** The social card: the hero's headline, the mark and the collage on grid paper (public/brand/og.jpg, 1200 × 630). */
export const socialImage = `${identity.runSite}/brand/og.jpg`

/**
 * Base's Run and not-found pages link the icons that seedIcons() finds in public/ (one `<link rel="icon" href=…>` per file); on the run site
 * they take the tuned favicons instead. Base's markup is fixed (src/base/icon-head.ts), so a change there fails the build here instead of passing silently.
 */
const baseIcons = /<link rel="(?:icon|apple-touch-icon)" href="[^"]*"[^>]*>/g

export function withChestIcons(html: string): string {
  if (!html.match(baseIcons)) throw new Error('Base run-site page no longer links its icons as expected; update src/site/head.ts.')
  let first = true
  return html.replace(baseIcons, () => (first ? ((first = false), iconHead) : ''))
}
