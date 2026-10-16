import branding from './branding.json'
import type { EditionIdentity } from './base/identity'

export const identity: EditionIdentity = {
  product: 'Chest', deployment: branding.name,
  purpose: '{deployment}’s approved business records, with accountable review and controlled access.',
  tagline: 'Chest stores, syncs and shares your team’s files, reads every scan, and quietly files what arrives. 100% free, open source alternative to Google Drive, Dropbox and Box.',
  signInPath: '/signin', runSite: 'https://run-chest.com', installedHome: 'lobby',
  accentColor: branding.primaryColor, theme: '/rer-theme.css', fonts: '/fonts/fonts.css', mark: '/brand/mark.svg', band: '/brand/band.svg',
}
