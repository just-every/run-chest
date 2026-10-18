import type { Row } from '../model'
export type Requirement = { id:string; label:string; request:string; checklist:string; item:string|null; version:string|null; submission:string|null }
export type Checklist = { title:string; folder:string; space:string; owner:string; recipients:string[]; cadenceHours:number; sendReminders:boolean; enabled:boolean; requirements:Requirement[]; at:string }
export type Confirmation = { collection:string; requirement:string; item:string; version:string; checksum:string; recipient:string; permission:string; at:string; invalidatedAt?:string; reason?:string }
export type Reminder = { collection:string; recipient:string; at:string; requirements:string[]; notice:string; status:string }
export type TransferEvidence = { transfer:string; actor:string; kind:string; item?:string; version?:string; at:string }
export type Evidence = { requirement:Requirement; state:string; reasons:string[]; submission:string|null; approval:{actor:string;at:string}|null; confirmations:Row<Confirmation>[]; transfer:Row<TransferEvidence>[]; recipients:{email:string;access:boolean;confirmed:boolean;permission:string|null}[]; candidates:{submission:string;item:string|null;version:string;status:string}[] }
