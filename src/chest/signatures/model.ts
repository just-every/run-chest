// A signature request is one record (kind 'signature'). Signers' links are stored as hashes only; the one-time PIN is a
// salted hash with an expiry. Fields are placed in fractions of the page, origin top-left.
export type FieldType = 'signature' | 'initials' | 'date' | 'text' | 'checkbox'
export const fieldTypes: FieldType[] = ['signature', 'initials', 'date', 'text', 'checkbox']
export type Field = { id: string; signer: string; type: FieldType; page: number; x: number; y: number; w: number; h: number; required: boolean; label?: string; value?: string }
export type SignerState = 'waiting' | 'invited' | 'viewed' | 'signed' | 'declined'
export type Signer = { id: string; email: string; name: string; staff: boolean; order: number; state: SignerState; tokenHash: string; credential?: { hash: string; expires: string; attempts: number }; verified?: { method: 'pin' | 'sign-in'; at: string }; consentAt?: string; signedAt?: string; adopted?: { name: string; initials: string }; invitedAt?: string; remindedAt?: string; mail?: string; generation?: number }
export type EventType = 'sent' | 'invited' | 'reminder' | 'viewed' | 'verified' | 'consented' | 'signed' | 'declined' | 'voided' | 'expired' | 'completed'
export type SignEvent = { at: string; type: EventType; signer?: string; email?: string; method?: string; ip: string; agent: string; detail?: string }
export type Fidelity = { summary: string; items: { level: 'info' | 'warning'; text: string }[] }
export type Status = 'draft' | 'pending' | 'completed' | 'declined' | 'voided' | 'expired'
export type SignRequest = {
 preparedBy?: {label:string;agent:string;sponsor:string}
 item: string; version: string; name: string; sourceChecksum: string; sourceKind: 'pdf' | 'docx'
 rendition?: { checksum: string; size: number; pages: number; fidelity: Fidelity }
 document: { checksum: string; size: number; pages: { w: number; h: number }[] }
 mode: 'sequential' | 'parallel'; signers: Signer[]; fields: Field[]; expires: string | null; reminderDays: number | null
 status: Status; createdBy: string; createdAt: string; sentAt?: string; events: SignEvent[]; warnings: string[]
 outcome?: { at: string; status: Exclude<Status, 'draft' | 'pending'>; reason?: string }
 signed?: { version: string; checksum: string; size: number }; certificate?: { version: string; checksum: string; size: number }
}
export const CONSENT_VERSION = '2026-10'
export const consentText = [
 'By continuing you agree to sign this document electronically and to receive the document and its signing records in electronic form.',
 'Your electronic signature has the same legal effect as a handwritten one for this document. Signing is voluntary: you may decline instead.',
 'To get a paper copy, withdraw your consent or update your contact details, write to the person who sent you this request before you sign. Withdrawing consent stops this request for you; choose Decline and give a reason.',
 'To view the document you need a current web browser that can open PDF files. Chest keeps the signed document and its audit certificate and gives you a link to both when everyone has signed.']
export const live = (r: SignRequest) => r.status === 'pending'
