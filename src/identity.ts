import branding from './branding.json'
import type { EditionIdentity } from './base/identity'

export const identity: EditionIdentity = {
  product: 'Chest', deployment: branding.name,
  purpose: '{deployment}’s approved business records, with accountable review and controlled access.',
  tagline: 'Chest is a free, open source document library. File every document, keep every original, and show everyone the approved version.',
  signInPath: '/signin', runSite: 'https://run-chest.com', installedHome: 'lobby',
  accentColor: branding.primaryColor, theme: '/rer-theme.css', fonts: '/fonts/fonts.css', mark: '/brand/mark.svg', band: '/brand/band.svg',
}
