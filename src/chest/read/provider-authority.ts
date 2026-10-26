// Bind approved data terms to an endpoint without copying its URL into durable audit records.
export async function endpointHash(endpoint: string) {
 const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint)))
 return Array.from(digest, b => b.toString(16).padStart(2, '0')).join('')
}
