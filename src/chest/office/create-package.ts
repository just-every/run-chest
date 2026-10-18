import { strToU8, zipSync, type Zippable } from 'fflate/browser'
import { escape } from './xml'
export const xml = (source: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${source}`
export const x = escape
export const ns = 'http://schemas.openxmlformats.org'
export function pack(parts: Record<string, string>, stored: string[] = []) {
 const files: Zippable = {}
 for (const [path, content] of Object.entries(parts)) files[path] = [strToU8(content), { level: stored.includes(path) ? 0 : 6 }]
 return zipSync(files)
}
export function rels(relationships: [string, string, string][]) {
 return xml(`<Relationships xmlns="${ns}/package/2006/relationships">${relationships.map(([id, type, target]) => `<Relationship Id="${id}" Type="${ns}/officeDocument/2006/relationships/${type}" Target="${x(target)}"/>`).join('')}</Relationships>`)
}
export function types(overrides: [string, string][]) {
 return xml(`<Types xmlns="${ns}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${overrides.map(([path, type]) => `<Override PartName="/${path}" ContentType="application/vnd.openxmlformats-officedocument.${type}+xml"/>`).join('')}</Types>`)
}
