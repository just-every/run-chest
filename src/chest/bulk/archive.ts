import { meterOriginal } from '../administration/egress'
import { activity } from '../content-security/activity'
import { guardDownload } from '../upload-protection/guard'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { ChestError, insist, now } from '../model'
import { sessionPredicate } from '../store'
import { allowed, context, demand, who } from '../files/access'
import { commit, fresh, maybe } from '../files/repo'
import { ownedJob } from './jobs'
import { one, streaming, zip64, type ZipEntry } from './zip'
import type { BulkEntry } from './model'

async function session(env: Bindings, s: Session) {
 const p = sessionPredicate(s); insist(await env.DB.prepare(`SELECT 1 WHERE (${p.sql})`).bind(...p.params).first(), 'authentication_required', 401)
}
async function authority(env: Bindings, s: Session, job: string, entry: BulkEntry) {
 await session(env,s); insist((await ownedJob(env,s,job)).payload.state === 'active', 'bulk_cancelled',409)
 const c = await context(env, await who(env,s), entry.item); demand(c,'download'); await guardDownload(env,s,c.chain.at(-1)!); return c
}
async function pathFor(env: Bindings, s: Session, entry: BulkEntry) {
 const w = await who(env,s), c = await context(env,w,entry.item), names: string[] = []
 // Direct access to a child does not disclose the names of inaccessible parents.
 for (const node of c.chain) { const parent = await context(env,w,node.id); names.push(allowed(parent,'view') ? node.payload.name : 'Restricted folder') }
 return `Selection ${entry.root + 1}/${names.join('/')}`
}
export async function archive(env: Bindings, s: Session, key: string) {
 const job = await ownedJob(env,s,key); insist(job.payload.action === 'download','not_download_job'); insist(job.payload.state === 'active','bulk_cancelled',409)
 await session(env,s)
 async function* entries(): AsyncGenerator<ZipEntry> {
  const included: any[] = [], excluded: any[] = [], paths = new Set<string>()
  for (const [index, entry] of job.payload.entries.entries()) {
   let path: string | undefined, source: R2ObjectBody | null = null
   try {
    const c = await authority(env,s,key,entry), item = c.chain.at(-1)!
    path = await pathFor(env,s,entry)
    if (item.payload.type === 'folder') {
     await authority(env,s,key,entry)
     const directory = path + '/'; if (!paths.has(directory)) { paths.add(directory); yield {path:directory,chunks:one(new Uint8Array())} }
     continue
    }
    const version = item.payload.versions.find(v=>v.id===entry.version); insist(version,'version_not_found',404)
    insist(!paths.has(path),'archive_path_collision',409)
    await activity(env,s,'download',version.size)
    source = await env.BLOBS.get(`sha256/${version.checksum}`); insist(source && source.size === version.size,'blob_missing',503)
    await authority(env,s,key,entry)
    const body = source.body, size = version.size
    async function* chunks() {
     const reader = body.getReader(), hash = new (crypto as unknown as {DigestStream:typeof DigestStream}).DigestStream('SHA-256'), writer = hash.getWriter(); let received = 0
     try { while (true) { const next = await reader.read(); if(next.done)break; await authority(env,s,key,entry); received += next.value.byteLength; await writer.write(next.value); yield next.value }; insist(received === size,'archive_size_mismatch',503); await writer.close(); const actual=Array.from(new Uint8Array(await hash.digest),b=>b.toString(16).padStart(2,'0')).join('');insist(actual===version!.checksum,'blob_integrity',503) }
     finally { await writer.abort().catch(()=>{}); await reader.cancel(); reader.releaseLock() }
    }
    paths.add(path)
    const metered=await meterOriginal(env,new Response(streaming(chunks())),entry.item,s.operator.email,'archive member',version.size)
    async function* emitted(){const reader=metered.body!.getReader();try{for(;;){const p=await reader.read();if(p.done)break;yield p.value}}finally{await reader.cancel()}}
    yield { path, chunks: emitted() }
    included.push({ path, version: version.id, size: version.size, sha256: version.checksum })
    const receiptId = `bulk-archive:${key}:${index}`
    if (!await maybe(env,'bulk-archive',receiptId)) {
     const live = await authority(env,s,key,entry)
     try { await commit(env,s,[{row:fresh('bulk-archive',{job:key,index,item:entry.item,version:version.id,at:now()},receiptId)}],{fences:[job,...live.fences],audits:[{action:'bulk.archive.item',object:entry.item,detail:{job:key,index,version:version.id,outcome:'bytes_generated'}}]}) }
     catch(error) { if(!await maybe(env,'bulk-archive',receiptId))throw error }
    }
   } catch(error) {
    // Once a local header has left, stopping the stream is the only honest refusal. It cannot be turned into
    // a valid omitted entry after the fact. Such failures reject the download rather than reporting completion.
    if (path && paths.has(path)) throw error
    if (!(error instanceof ChestError) || error.status===401 || error.code==='bulk_cancelled') throw error
    let visible = false
    try { const c=await context(env,await who(env,s),entry.item);visible=allowed(c,'view')&&!c.state.trash } catch {}
    if(visible&&!path)path=await pathFor(env,s,entry)
    excluded.push({selection:index,...(visible&&path?{path}:{}),reason:visible?error.code:'access_refused'})
   } finally { if(source)try{await source.body.cancel()}catch{} }
  }
  await session(env,s)
  const manifest={format:'chest-selection-v1',job:key,generatedAt:now(),complete:excluded.length===0,included,excluded,delivery:'Server-generated archive bytes; client receipt is not confirmed.'}
  yield {path:'chest-manifest.json',chunks:one(new TextEncoder().encode(JSON.stringify(manifest,null,2)))}
 }
 return meterOriginal(env,new Response(streaming(zip64(entries())),{headers:{'content-type':'application/zip','content-disposition':'attachment; filename="chest-selection.zip"','cache-control':'no-store','x-content-type-options':'nosniff'}}),key,s.operator.email,'selection archive')
}
