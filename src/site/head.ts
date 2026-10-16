import { iconHead } from '../brand-icons'
import { identity } from '../identity'

export { iconLinks } from '../brand-icons'

/** The social card: the hero's headline, the mark and the collage on grid paper (public/brand/og.jpg, 1200 × 630). */
export const socialImage = `${identity.runSite}/brand/og.jpg`

/**
 * Base's Run and not-found pages link the full mark as their icon; on the run site they take the tuned favicons.
 * Base's markup is fixed (src/base/run-site.ts), so a change there fails the build here instead of passing silently.
 */
export function withChestIcons(html: string): string {
  const baseIcon = `<link rel="icon" href="${identity.mark}">`
  if (!html.includes(baseIcon)) throw new Error('Base run-site page no longer links its icon as expected; update src/site/head.ts.')
  return html.replace(baseIcon, iconHead)
}
