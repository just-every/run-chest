import { SMALL } from '../blobs'
// Capacity bounds apply independently of the budgets a person authorizes.
export const requestBytes = 20_000_000
export const originalBytes = SMALL
export const pageItems = 100
export const capacityNotice = `Installation capacity: originals up to ${originalBytes.toLocaleString('en-US')} bytes, request bodies below ${requestBytes.toLocaleString('en-US')} bytes and pages up to ${pageItems} items. No fixed requests-per-minute throttle is configured in this edition. Send requests one at a time and back off on capacity refusals. Storage quota, security pauses and current access still apply independently of grant budgets.`
