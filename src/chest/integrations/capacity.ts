// Capacity bounds apply independently of the budgets a person authorizes.
export const requestBytes = 20_000_000
export const originalBytes = 512 * 1024
export const pageItems = 100
export const capacityNotice = `Installation capacity: originals up to ${originalBytes.toLocaleString('en-US')} bytes, request bodies below ${requestBytes.toLocaleString('en-US')} bytes and pages up to ${pageItems} items. The shared agent door allows up to 600 calls per minute for each app/person pair. Send requests one at a time and back off on capacity refusals. Storage quota, security pauses and current access still apply independently of grant budgets.`
