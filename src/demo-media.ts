import { strToU8, strFromU8, unzipSync, zipSync } from 'fflate'
import type { Bindings } from './auth.server'

// Only synthetic artwork is shared. Documents, dates, metadata and R2 custody belong to each copy.
export async function demoPictures(env: Bindings) {
 const response = await env.ASSETS?.fetch(new Request(new URL('/chest-demo-pictures.zip', env.RER_DEV_ORIGIN ?? env.AUTH_ORIGIN)))
 if (!response?.ok) throw new Error('Chest demo pictures could not be loaded')
 const pictures = unzipSync(new Uint8Array(await response.arrayBuffer()))
 return (name: string): Uint8Array => {
  if (!pictures[name]) throw new Error(`Missing Chest demo picture: ${name}`)
  return pictures[name]
 }
}
export type DemoPicture = Awaited<ReturnType<typeof demoPictures>>

/** An Office file with the preview picture Word, Excel and PowerPoint save (docProps/thumbnail.jpeg). */
export function withThumbnail(office: Uint8Array, thumbnail: Uint8Array) {
 const parts = unzipSync(office)
 parts['docProps/thumbnail.jpeg'] = thumbnail
 parts['_rels/.rels'] = strToU8(strFromU8(parts['_rels/.rels']).replace('</Relationships>', '<Relationship Id="rIdThumbnail" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail" Target="docProps/thumbnail.jpeg"/></Relationships>'))
 const types = strFromU8(parts['[Content_Types].xml'])
 if (!types.includes('Extension="jpeg"')) parts['[Content_Types].xml'] = strToU8(types.replace(/(<Types[^>]*>)/, '$1<Default Extension="jpeg" ContentType="image/jpeg"/>'))
 return zipSync(parts)
}
