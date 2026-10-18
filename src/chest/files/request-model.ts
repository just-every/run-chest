import type { FileRequest, FileVersion, Item } from './model'
import { insist } from '../model'
import { signature } from '../blobs'
import { MAX } from './uploads'
export type RequestPolicy = FileRequest & { checklist?: string[]; verification?: 'none'|'email'; allowReplacement?: boolean; late?: 'reject'|'quarantine'; duplicates?: 'keep'|'reject'|'quarantine' }
export type Visitor = { request: string; tokenHash: string; expires: string; email?: string }
export type RequestSubmission = { space: string; request: string; visitor: string; title: string; at: string; submitter: { name: string; email: string; verified: boolean }; checklist: string; status: 'accepted'|'quarantined'|'rejected'|'superseded'; reasons: string[]; files: { name: string; version: FileVersion; item?: string }[]; filing: Record<string,unknown>; replaces?: string; decidedBy?: string; decidedAt?: string }
export const extension = (filename: string) => (/\.([A-Za-z0-9]{1,10})$/.exec(filename)?.[1] ?? '').toLowerCase()
export const optional = (value: unknown, field: string, max: number) => { if (value === undefined || value === null || value === '') return ''; insist(typeof value === 'string' && value.length <= max && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value), `invalid_${field}`); return value.trim() }
export function policy(input: any) {
 const checklist = [...new Set((Array.isArray(input.checklist) ? input.checklist : String(input.checklist ?? '').split('\n')).map((v:unknown) => optional(v,'checklist',160)).filter(Boolean))] as string[]
 insist(checklist.length <= 30,'invalid_checklist')
 const verification = input.verification ?? 'none', late = input.late ?? 'reject', duplicates = input.duplicates ?? 'keep'
 insist(['none','email'].includes(verification),'invalid_verification'); insist(['reject','quarantine'].includes(late),'invalid_late_policy'); insist(['keep','reject','quarantine'].includes(duplicates),'invalid_duplicate_policy')
 insist(input.allowReplacement === undefined || [true,false,'true','false'].includes(input.allowReplacement),'invalid_replacement_policy')
 return { checklist, verification, late, duplicates, allowReplacement: input.allowReplacement === true || input.allowReplacement === 'true' } as Required<Pick<RequestPolicy,'checklist'|'verification'|'late'|'duplicates'|'allowReplacement'>>
}
export function requestSize(value: unknown) { if(value===undefined || value===null || value==='')return MAX; const n=Number(value);insist(Number.isFinite(n)&&n>0&&n*1_000_000<=MAX,'invalid_max_size');return Math.round(n*1_000_000) }
export function validateFile(r: RequestPolicy, filename: string, size: number) { insist(Number.isSafeInteger(size)&&size>0,'invalid_size');insist(size<=r.maxBytes && size<=MAX,'file_too_large',413);insist(!r.types.length || r.types.includes(extension(filename)),'type_not_allowed',415) }
// Recognized formats must match their bytes. Executable and active document content is isolated, never rendered.
export function inspectRequestContent(filename: string, bytes: Uint8Array) {
 const ext=extension(filename), kind=signature(bytes), known:Record<string,string>={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',heic:'image/heic',heif:'image/heic'}
 insist(!known[ext] || kind?.mediaType===known[ext],'content_type_mismatch',415)
 const prefix=new TextDecoder().decode(bytes.slice(0,1024)).trimStart()
 return /^(?:MZ|\x7fELF|#!)/.test(prefix) || /^<(?:!doctype\s+html|html|script|svg)(?:\s|>)/i.test(prefix) || ['exe','dll','com','bat','cmd','ps1','sh','js','mjs','html','htm','svg'].includes(ext) ? ['active or executable content'] : []
}
export const newRequestItem = (r: RequestPolicy, space: string, filename: string, at: string): Item => ({space,parent:r.folder,type:'file',name:filename,createdBy:r.custodian??r.createdBy,createdAt:at,updatedAt:at,restricted:false,noDownload:false,grants:[],trash:null,versions:[],current:null})
