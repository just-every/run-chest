import type { Bindings } from './auth.server'
import type { FileVersion, Item, PublicLink, Space, Grant, Notice } from './chest/files/model'
import type { Report } from './chest/sync-repair/model'
import type { FilingMove } from './chest/filing/shared'
import type { QuotaRule } from './chest/quota/rules'
import { reportKey } from './chest/sync-repair/model'
import { admit } from './chest/files/items'
import { digest } from './chest/blobs'
import { createOffice } from './chest/office/create-office'
import { pdf } from './demo-pdf'
import { photo as picture, scan, withThumbnail } from './demo-media'
import { zipSync, strToU8 } from 'fflate'

/** The demo's everyday files (Files, as the picked app look draws it): four team spaces, the Vendors / Acme folder
 * a few weeks into working with Acme Supply, and what that history leaves: versions with one approved, a sync
 * conflict kept as a copy from the owner's iPhone, links for anyone with expiry and download limits, the companions'
 * sync reports, what the filing agent filed today, two copies of one invoice and an upload still going up.
 * Originals are real files (Word, Excel, PowerPoint, PDF, JPEG, ZIP, text) admitted through Chest's own byte
 * inspection and R2 custody. Times are relative to the demo's start; the folder's last change is an hour ago. */
type Person = { email: string; name: string }
export async function seedFiles(env: Bindings, { me, meName, luis, maria, priya, now }: { me: string; meName: string; luis: Person; maria: Person; priya: Person; now: Date }) {
  // The owner's own devices are named after them: Dana's.
  const mine = `${meName.trim().split(/\s+/)[0]}'s`
  const at = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString()
  const day = 1440
  const statement = (sql: string, ...params: unknown[]) => env.DB.prepare(sql).bind(...params)
  const rows: { id: string; kind: string; payload: unknown }[] = [], audit: unknown[][] = []
  const record = (id: string, kind: string, payload: unknown) => rows.push({ id, kind, payload })
  const log = (actor: string, action: string, object: string, when: string, detail: Record<string, unknown> = {}) => audit.push([`demo-files-audit-${audit.length + 1}`, actor, action, object, JSON.stringify({ sample: true, ...detail }), when])
  const member = (principal: string, role: Grant['role']): Grant => ({ principal, role, by: me, at: at(40 * day) })
  const space = (id: string, name: string, members: Grant[]) => record(id, 'space', { name, kind: 'team', owner: me, members: [member(me, 'manager'), ...members], settings: { noDownload: false, editorSharing: true }, createdBy: me, createdAt: at(40 * day) } satisfies Space)
  space('demo-space-finance', 'Finance', [member(luis.email, 'contributor'), member(maria.email, 'content_manager')])
  space('demo-space-vendors', 'Vendors', [member(luis.email, 'content_manager'), member(maria.email, 'contributor'), member(priya.email, 'viewer')])
  space('demo-space-legal', 'Legal', [member(priya.email, 'content_manager')])
  space('demo-space-operations', 'Operations', [member(luis.email, 'contributor'), member(maria.email, 'contributor')])
  // The organization's storage plan, as an owner saves it under Storage: 100 GB for each team space and 10 GB for each
  // person's My files, so every space has a limit and the rail's meter draws.
  const gb = 1024 ** 3
  for (const [scope, limitBytes] of [['space-default', 100 * gb], ['personal-default', 10 * gb]] as const) { record(`quota-rule:${scope}`, 'quota-rule', { scope, limitBytes } satisfies QuotaRule); log(me, 'quota.policy', `quota-rule:${scope}`, at(40 * day), { scope, before: null, after: { scope, limitBytes } }) }

  // Devices: the owner's three, and Luis's laptop that made the other side of the rate card conflict.
  const devices = [['demo-device-macbook', me, `${mine} MacBook Pro`, 'macos', 2], ['demo-device-iphone', me, `${mine} iPhone`, 'ios', 9], ['demo-device-ipad', me, `${mine} iPad`, 'ios', 3 * day], ['demo-device-luis', luis.email, "Luis's laptop", 'windows', 70]] as const
  const credentials: unknown[][] = []
  for (const [id, owner, name, platform, seen] of devices) {
    record(id, 'device', { owner, name, platform, createdAt: at(35 * day), revokedAt: null, revokedBy: null })
    credentials.push([await digest(new TextEncoder().encode(`demo device ${id} ${now.getTime()} ${crypto.randomUUID()}`)), id, owner, at(35 * day), at(seen)])
  }

  // Files and folders. Versions are listed oldest first; `ago` is minutes before the demo started.
  type V = { bytes: Uint8Array; ago: number; by: string; arrival?: FileVersion['arrival']; device?: string; review?: 'approved' | 'submitted' }
  const items: Record<string, { id: string; payload: Item }> = {}
  async function file(id: string, space: string, parent: string | null, name: string, versions: V[], extra: Partial<Item> = {}) {
    const list: FileVersion[] = []
    for (const [index, v] of versions.entries()) {
      const admitted = await admit(env, v.bytes, name, v.by, v.arrival ?? 'upload', {}, v.device ? { device: v.device } : {})
      list.push({ ...admitted, id: `${id}-v${index + 1}`, at: at(v.ago), ...(v.review ? { review: { reviewer: me, state: v.review, ...(v.review === 'approved' ? { actor: me, at: at(v.ago - 20) } : {}) } } : {}) })
      log(v.by, index ? 'version.upload' : 'file.upload', id, at(v.ago), { version: `${id}-v${index + 1}` })
    }
    const payload: Item = { space, parent, type: 'file', name, createdBy: versions[0].by, createdAt: at(versions[0].ago), updatedAt: at(versions.at(-1)!.ago), restricted: false, noDownload: false, grants: [], trash: null, versions: list, current: list.at(-1)!.id, ...extra }
    items[id] = { id, payload }; record(id, 'item', payload)
  }
  const folder = (id: string, space: string, parent: string | null, name: string, ago: number, extra: Partial<Item> = {}) => { const payload: Item = { space, parent, type: 'folder', name, createdBy: me, createdAt: at(ago), updatedAt: at(ago), restricted: false, noDownload: false, grants: [], trash: null, versions: [], current: null, ...extra }; items[id] = { id, payload }; record(id, 'item', payload); log(me, 'folder.create', id, at(ago)) }
  const text = (lines: string[]) => strToU8(lines.join('\n') + '\n')
  // Office files carry the preview picture Office saves; signed or official PDFs are scans with a text layer.
  const word = (lines: string[]) => withThumbnail(createOffice('docx', { paragraphs: lines } as any), 1)
  const sheet = (rows: (string | number)[][]) => withThumbnail(createOffice('xlsx', { rows } as any), 2)
  const deck = (slides: string[][]) => withThumbnail(createOffice('pptx', { slides } as any), 3)
  const scanned = (title: string, lines: string[], seed: number) => pdf(title, lines, scan(seed))
  const contract = (n: number) => word(['ACME SUPPLY CO.', 'Supply Agreement', `Draft ${n} between Harborworks, Inc. (Seattle, WA) and Acme Supply Co. (Tacoma, WA).`, '1. Term. Twelve months from November 1, 2026, renewing for twelve months unless either party gives 60 days’ written notice.', '2. Pricing. Unit prices follow the Rate card 2027 schedule, fixed through October 31, 2027.', '3. Payment. Net 30 by ACH to the account on the vendor’s W-9 and ACH payment form.', '4. Insurance. General liability of $2,000,000 per occurrence, certificate on file.'])

  folder('demo-folder-acme', 'demo-space-vendors', null, 'Acme', 30 * day, { governance: { reviewer: me } })
  folder('demo-folder-acme-tax', 'demo-space-vendors', 'demo-folder-acme', 'Tax', 30 * day)
  folder('demo-folder-bayline', 'demo-space-vendors', null, 'Bayline Packaging', 34 * day)
  folder('demo-folder-kestrel', 'demo-space-vendors', null, 'Kestrel Freight', 38 * day)
  folder('demo-folder-payables', 'demo-space-finance', null, 'Accounts payable', 36 * day)
  folder('demo-folder-contracts', 'demo-space-legal', null, 'Signed contracts', 36 * day)
  folder('demo-folder-procedures', 'demo-space-operations', null, 'Procedures', 36 * day)
  const acme = 'demo-folder-acme', vendors = 'demo-space-vendors'
  await file('demo-file-contract', vendors, acme, 'Acme Supply Contract.docx', [
    { bytes: contract(1), ago: 12 * day + 198, by: me }, { bytes: contract(2), ago: 10 * day + 300, by: luis.email }, { bytes: contract(3), ago: 9 * day + 80, by: me },
    { bytes: contract(4), ago: 7 * day + 400, by: luis.email }, { bytes: contract(5), ago: 4 * day + 1101, by: me }, { bytes: contract(6), ago: 2 * day + 1390, by: luis.email },
    { bytes: contract(7), ago: 66, by: me, review: 'approved' },
  ], { approved: 'demo-file-contract-v7' })
  await file('demo-file-nda', vendors, acme, 'NDA signed.pdf', [{ bytes: pdf('Mutual Nondisclosure Agreement', ['Harborworks, Inc. and Acme Supply Co.', 'Effective October 1, 2026. Governed by the laws of the State of Washington.']), ago: 2 * day + 1170, by: me }, { bytes: scanned('Mutual Nondisclosure Agreement', ['Harborworks, Inc. and Acme Supply Co.', 'Signed by both parties October 13, 2026.'], 4), ago: 1048, by: me }])
  await file('demo-file-receipt', vendors, acme, 'Receipt 2026-10-14.jpg', [{ bytes: picture(3, 1512, 2016), ago: 29, by: me, device: 'demo-device-iphone', arrival: 'sync client' }])
  await file('demo-file-invoice', vendors, acme, 'Invoice 4471 Oct.pdf', [1, 2, 3, 4].map((n, i) => ({ bytes: scanned('Invoice 4471', ['Acme Supply Co., 1200 Dock St, Tacoma, WA 98402', 'Bill to: Harborworks, Inc., Seattle, WA', `October 2026 · Packaging film and labels · $${(4182.5 + i * 0).toFixed(2)}`, `Revision ${n}`], 20), ago: 2 * day + 1150 - i * 60, by: luis.email })))
  const rate = (r: string) => sheet([['Item', 'Unit', 'Price (USD)', 'Effective'], ['Stretch film 18 in', 'roll', 24.5, 'Jan 1, 2027'], ['Thermal labels 4x6', 'case', 38, 'Jan 1, 2027'], ['Corner boards', 'bundle', r === 'dana' ? 15.75 : 16.25, 'Jan 1, 2027']])
  await file('demo-file-rates', vendors, acme, 'Rate card 2027.xlsx', [1, 2, 3, 4, 5].map((i): V => ({ bytes: rate(`v${i}`), ago: 6 * day - i * 300, by: luis.email })).concat([{ bytes: rate('luis'), ago: 78, by: luis.email, device: 'demo-device-luis', arrival: 'sync client' }]))
  await file('demo-file-rates-copy', vendors, acme, `Rate card 2027 (conflicted copy from ${mine} iPhone).xlsx`, [{ bytes: rate('dana'), ago: 62, by: me, device: 'demo-device-iphone', arrival: 'conflict copy' }])
  await file('demo-file-photos', vendors, acme, 'Q4 product photos.zip', [{ bytes: zipSync({ 'Q4 photos/stretch-film.jpg': picture(7, 2016, 1512), 'Q4 photos/labels.jpg': picture(11, 2016, 1512), 'Q4 photos/corner-boards.jpg': picture(13, 2016, 1512), 'Q4 photos/README.txt': text(['Acme Supply product photos for the Q4 catalog.']) }), ago: 3 * day + 435, by: luis.email }])
  await file('demo-file-insurance', vendors, acme, 'Insurance certificate.pdf', [1, 2, 3].map(i => ({ bytes: scanned('Certificate of Liability Insurance', ['Insured: Acme Supply Co., Tacoma, WA', 'Insurer: Cascade Mutual Insurance Co.', `General liability $2,000,000 each occurrence · issue ${i}`, 'Policy period Oct 1, 2026 to Oct 1, 2027'], 5 + i), ago: 4 * day + 564 - i * 30, by: maria.email })))
  await file('demo-file-license', vendors, acme, 'Business license.pdf', [{ bytes: scanned('Business License', ['Acme Supply Co.', 'Washington State Department of Revenue, UBI 604 112 873', 'Expires September 30, 2027'], 9), ago: 5 * day + 46, by: me }])
  await file('demo-file-ach', vendors, acme, 'ACH payment form.pdf', [1, 2].map(i => ({ bytes: scanned('ACH Payment Authorization', ['Payee: Acme Supply Co.', 'Bank: Puget Sound Bank, Tacoma, WA', `Remittance email: ar@acmesupply.example · form ${i}`], 10 + i), ago: 6 * day + 492 - i * 10, by: luis.email })))
  await file('demo-file-questionnaire', vendors, acme, 'Vendor questionnaire.docx', [{ bytes: word(['Vendor Questionnaire', 'Acme Supply Co.', 'Primary contact: Jordan Lee, (253) 555-0142', 'Tax classification: C corporation']), ago: 7 * day + 1793, by: luis.email }])
  await file('demo-file-prices', vendors, acme, 'Price list 2027.xlsx', [1, 2, 3, 4].map(i => ({ bytes: sheet([['SKU', 'Description', 'List price (USD)'], ['SF-18', 'Stretch film 18 in', 26 + i], ['TL-46', 'Thermal labels 4x6', 41]]), ago: 8 * day + 81 - i * 5, by: maria.email })))
  await file('demo-file-notes', vendors, acme, 'Onboarding notes.txt', [{ bytes: text(['Acme Supply onboarding', '- W-9 received and filed to Tax.', '- ACH form verified by phone with Jordan Lee.', '- Insurance certificate on file; renews Oct 1, 2027.']), ago: 9 * day + 1028, by: me }])
  await file('demo-file-deck', vendors, acme, 'Acme intro deck.pptx', [1, 2, 3, 4, 5].map(i => ({ bytes: deck([['Acme Supply Co.', 'Packaging supplies for Puget Sound warehouses'], ['Our team', `Revision ${i}`]]), ago: 12 * day + 474 - i * 3, by: luis.email })))
  await file('demo-file-w9', vendors, 'demo-folder-acme-tax', 'W-9 Acme Supply.pdf', [{ bytes: scanned('Form W-9 (Rev. March 2024)', ['Name: Acme Supply Co.', 'Federal tax classification: C corporation', 'Address: 1200 Dock St, Tacoma, WA 98402', 'Signed October 14, 2026'], 13), ago: 133, by: luis.email, arrival: 'email' }])
  // Two more copies of the October invoice arrived by email in Accounts payable: duplicates of Acme's copy.
  const invoice = items['demo-file-invoice'].payload.versions.at(-1)!
  for (const [n, name] of [[1, 'Invoice 4471 Oct.pdf'], [2, 'Invoice 4471 Oct (emailed).pdf']] as const) {
    const bytes = scanned('Invoice 4471', ['Acme Supply Co., 1200 Dock St, Tacoma, WA 98402', 'Bill to: Harborworks, Inc., Seattle, WA', 'October 2026 · Packaging film and labels · $4182.50', 'Revision 4'], 20)
    await file(`demo-file-invoice-dup${n}`, 'demo-space-finance', 'demo-folder-payables', name, [{ bytes, ago: 2 * day + 900 - n * 30, by: maria.email, arrival: 'email' }])
    if (items[`demo-file-invoice-dup${n}`].payload.versions[0].checksum !== invoice.checksum) throw new Error('demo invoice copies must match')
  }

  // Links for anyone: the contract's (expires Nov 30, 3 of 10 downloads), and four more; the rate card's link is
  // what the agent flags as shared outside the team.
  const year = now.getUTCFullYear()
  const links: [string, string, string | null, number | null, number][] = [['demo-link-contract', 'demo-file-contract', `${year}-11-30T23:59:00.000Z`, 10, 3], ['demo-link-receipt', 'demo-file-receipt', `${year}-11-30T23:59:00.000Z`, null, 1], ['demo-link-photos', 'demo-file-photos', `${year}-12-15T23:59:00.000Z`, 25, 8], ['demo-link-license', 'demo-file-license', `${year}-11-02T23:59:00.000Z`, 5, 2], ['demo-link-prices', 'demo-file-prices', `${year + 1}-01-15T23:59:00.000Z`, null, 14], ['demo-link-rates', 'demo-file-rates', null, null, 2]]
  for (const [id, item, expires, limit, downloads] of links) { record(id, 'public-link', { item, tokenHash: await digest(new TextEncoder().encode(`${id} ${crypto.randomUUID()}`)), password: null, expires, limit, downloads, createdBy: id === 'demo-link-rates' ? luis.email : me, at: at(3 * day), audience: 'public', role: 'viewer' } satisfies PublicLink); log(id === 'demo-link-rates' ? luis.email : me, 'link.create', item, at(3 * day)) }

  // The owner's MacBook keeps Vendors / Acme on disk; its last report: most files up to date, one queued, one paused.
  const states: Record<string, Report['files'][number]['state']> = { 'demo-file-questionnaire': 'queued', 'demo-file-ach': 'paused' }
  const reported = Object.values(items).filter(x => x.payload.parent === acme && x.payload.type === 'file' && x.id !== 'demo-file-rates-copy')
  record(reportKey('demo-device-macbook', acme), 'sync-report', { owner: me, device: 'demo-device-macbook', folder: acme, clientVersion: '0.2.47', cache: { freeBytes: 182_536_814_592 }, at: at(2), paused: false, files: reported.map(x => { const v = x.payload.versions.find(v => v.id === x.payload.current)!, state = states[x.id] ?? 'up-to-date'; return { item: x.id, path: `Vendors/Acme/${x.payload.name}`, baseVersion: v.id, localChecksum: v.checksum, localSize: v.size, state, reason: state === 'queued' ? 'local_change' : state === 'paused' ? 'queue_paused' : '' } }) } satisfies Report)

  // What the filing agent filed in the last day, each with its move and a notice to Dana (Undo applies while the
  // file is where the agent put it).
  const filed: [string, string, string | null, string, number][] = [['demo-file-w9', 'demo-folder-acme-tax', acme, 'Vendors / Acme / Tax', 20], ['demo-file-receipt', acme, null, 'Vendors / Acme', 27], ['demo-file-insurance', acme, null, 'Vendors / Acme', 300], ['demo-file-nda', acme, null, 'Vendors / Acme', 480], ['demo-file-invoice-dup2', 'demo-folder-payables', null, 'Finance / Accounts payable', 700]]
  const revisions = new Map<string, string>()
  for (const [item, destination, source, path, ago] of filed) {
    const x = items[item], revision = crypto.randomUUID(); revisions.set(item, revision)
    const move = `demo-move-${item}`
    record(move, 'filing_move', { space: x.payload.space, item, version: x.payload.current, name: x.payload.name, originalName: x.payload.name, originalTags: [], source, destination, destinationPath: path, explanation: 'Filed by the standing grant for the Vendors inbox.', evidence: x.payload.name, by: me, at: at(ago), status: 'filed', movedRevision: revision, undoFences: [], undoLinkCount: 0, undoPublicLinkCount: links.length } satisfies FilingMove)
    record(`demo-notice-${item}`, 'notice', { to: me, type: 'filing', item, undo: move, from: 'Chest agent', message: `Filed ${x.payload.name} → ${path}`, at: at(ago), read: ago > 200, email: 'suppressed:demo' } satisfies Notice)
  }

  // An upload of Dana's still going up into Acme: its first 8 MB part is held in R2, 62% of the file.
  const part = 8 * 1024 * 1024, size = Math.floor(part / 0.62), staging = 'uploads/demo-upload-contract-v8', multipart = await env.BLOBS.createMultipartUpload(staging)
  const sent = await multipart.uploadPart(1, new Uint8Array(part).fill(32))
  record('demo-upload-contract-v8', 'upload', { space: vendors, parent: acme, item: null, owner: me, name: 'Updated contract v8.docx', size, lastModified: 0, checksum: null, partSize: part, key: staging, multipart: multipart.uploadId, state: 'open', createdAt: at(4), expiresAt: new Date(now.getTime() + 6 * day * 60_000).toISOString() })
  record('demo-upload-contract-v8:1', 'upload-part', { upload: 'demo-upload-contract-v8', n: 1, etag: sent.etag, size: part })
  log(me, 'upload.begin', 'demo-upload-contract-v8', at(4))

  await env.DB.batch([
    ...rows.map(r => statement('INSERT INTO chest_records(id, kind, payload, revision) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING', r.id, r.kind, JSON.stringify(r.payload), revisions.get(r.id) ?? crypto.randomUUID())),
    ...credentials.map(c => statement('INSERT INTO chest_device_credentials(token_hash, device, email, created_at, last_seen) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING', ...c)),
    ...audit.map(row => statement('INSERT INTO chest_audit(id, actor, action, object_id, detail, at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING', ...row)),
  ])
}
