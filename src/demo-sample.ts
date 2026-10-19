// The demo's sample library: Harborworks, a small build-out contractor, a few months
// into using Chest. Names follow the run-chest.com drawings (Kestrel Freight, Maria Chen,
// Dan Hale, the Accounts team). Every date is relative to the demo's start.
import type { Field, Grant } from './chest/model'
import { pdf } from './demo-pdf'

const domain = 'harborworks.example'
export const team = [
  { id: 'demo-maria', email: `maria.chen@${domain}`, name: 'Maria Chen', role: 'admin', status: 'active' },
  { id: 'demo-dan', email: `dan.hale@${domain}`, name: 'Dan Hale', role: 'member', status: 'active' },
  { id: 'demo-priya', email: `priya.natarajan@${domain}`, name: 'Priya Natarajan', role: 'member', status: 'active' },
  { id: 'demo-tom', email: `tom.okafor@${domain}`, name: 'Tom Okafor', role: 'member', status: 'active' },
  { id: 'demo-elena', email: `elena.rossi@${domain}`, name: 'Elena Rossi', role: 'member', status: 'invited' },
  { id: 'demo-luis', email: `luis.ortega@${domain}`, name: 'Luis Ortega', role: 'member', status: 'active' },
] as const
const [maria, dan, priya, tom] = team.map(person => person.email)

export const groups = [
  { id: 'demo-group-accounts', name: 'Accounts team', members: [maria, priya] },
  { id: 'demo-group-site', name: 'Site leads', members: [dan, tom] },
]
const accounts = 'demo-group-accounts', site = 'demo-group-site'

const f = (name: string, type: Field['type'], required = false): Field => ({ name, type, required })
export const schemas = [
  { id: 'demo-type-insurance', name: 'Insurance certificate', fields: [f('policy number', 'text', true), f('insurer', 'text', true), f('cover limit (USD)', 'number')] },
  { id: 'demo-type-contract', name: 'Supplier contract', fields: [f('contract reference', 'text', true), f('annual value (USD)', 'number'), f('auto-renews', 'boolean', true), f('notice period (days)', 'number')] },
  { id: 'demo-type-procedure', name: 'Procedure', fields: [f('procedure code', 'text', true), f('applies to', 'text')] },
  { id: 'demo-type-licence', name: 'Permit or license', fields: [f('license number', 'text', true), f('issued by', 'text', true), f('issued on', 'date')] },
]

const g = (principal: string, role: Grant['role']): Grant => ({ principal, role })
export const collections = [
  { id: 'demo-col-insurance', name: 'Insurance & compliance', grants: [g(accounts, 'editor'), g(maria, 'reviewer')] },
  { id: 'demo-col-suppliers', name: 'Suppliers & contracts', grants: [g(accounts, 'editor'), g(site, 'reader')] },
  { id: 'demo-col-safety', name: 'Health & safety', grants: [g(site, 'editor'), g(tom, 'reviewer'), g(accounts, 'reader')] },
  { id: 'demo-col-projects', name: 'Projects', grants: [g(site, 'editor'), g(accounts, 'reader')] },
  { id: 'demo-col-people', name: 'People & HR', grants: [g(maria, 'editor')] },
]

type Event = { action: 'comment' | 'approve' | 'changes' | 'assign'; by: string; days: number; message?: string }
export type SampleVersion = { filename: string; bytes: Uint8Array; days: number; by: string; reviewer: string; events: Event[] }
export type SampleDocument = {
  id: string; title: string; collection: string; schema: string; fields: Record<string, unknown>; owner: string; reviewer: string
  reference: { kind: 'supplier' | 'customer' | 'project'; name: string } | null; review: number | null; expiry: number | null
  versions: SampleVersion[]; private?: boolean; grants?: Grant[]; trash?: number; completed?: { kind: 'review' | 'expiry'; by: string; days: number; evidence: string }
}
const text = (lines: string[]) => new TextEncoder().encode(lines.join('\n') + '\n')
const year = (days: number, now: Date) => new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10)

/** The sample records for an owner; `days` are relative to now (negative is past). */
export function documents(owner: string, now: Date): SampleDocument[] {
  const on = (days: number) => year(days, now)
  const approve = (by: string, days: number, message = ''): Event => ({ action: 'approve', by, days, message })
  return [
    { id: 'demo-doc-01', title: 'General liability certificate', collection: 'demo-col-insurance', schema: 'demo-type-insurance', owner: maria, reviewer: owner,
      fields: { 'policy number': 'PL-448120', insurer: 'Aldgate Mutual', 'cover limit (USD)': 2_000_000 }, reference: { kind: 'supplier', name: 'Kestrel Freight' }, review: 5, expiry: 12,
      versions: [
        { filename: 'kestrel-public-liability-2025.pdf', days: -352, by: maria, reviewer: owner, events: [approve(owner, -350, 'Matches the broker schedule.')],
          bytes: pdf('Certificate of general liability insurance', ['Insured: Kestrel Freight LLC', 'Policy number: PL-448120', 'Insurer: Aldgate Mutual', 'Each occurrence limit: $2,000,000', `Period: ${on(-353)} to ${on(12)}`, 'Additional interest noted: Harborworks LLC']) },
        { filename: 'kestrel-public-liability-2026.pdf', days: -2, by: priya, reviewer: owner, events: [{ action: 'comment', by: priya, days: -2, message: 'Renewal from Kestrel, same limit. Starts the day after the current one ends.' }],
          bytes: pdf('Certificate of general liability insurance', ['Insured: Kestrel Freight LLC', 'Policy number: PL-448120/R1', 'Insurer: Aldgate Mutual', 'Each occurrence limit: $2,000,000', `Period: ${on(13)} to ${on(377)}`, 'Additional interest noted: Harborworks LLC']) },
      ] },
    { id: 'demo-doc-02', title: 'Equipment hire terms', collection: 'demo-col-suppliers', schema: 'demo-type-contract', owner: dan, reviewer: owner,
      fields: { 'contract reference': 'NPH-2291', 'annual value (USD)': 38_400, 'auto-renews': false, 'notice period (days)': 30 }, reference: { kind: 'supplier', name: 'Northgate Equipment Rental' }, review: 20, expiry: 140,
      versions: [
        { filename: 'northgate-hire-terms-v3.pdf', days: -96, by: dan, reviewer: owner, events: [approve(owner, -94)],
          bytes: pdf('Northgate Equipment Rental - rental terms', ['Customer: Harborworks LLC    Account: NPH-2291', '1. Minimum rental period is one week.', '4. Delivery and collection within 25 miles included.', '7. Damage waiver: 9% of rental charges.', '11. Either party may end this agreement on 30 days notice.']) },
        { filename: 'northgate-hire-terms-v4.pdf', days: -6, by: dan, reviewer: owner, events: [{ action: 'changes', by: owner, days: -4, message: 'Clause 7 still has the old damage waiver rate. Please ask Northgate for the corrected copy.' }],
          bytes: pdf('Northgate Equipment Rental - rental terms', ['Customer: Harborworks LLC    Account: NPH-2291', '1. Minimum rental period is one week.', '4. Delivery and collection within 30 miles included.', '7. Damage waiver: 9% of rental charges.', '11. Either party may end this agreement on 30 days notice.']) },
      ] },
    { id: 'demo-doc-03', title: 'Site induction checklist', collection: 'demo-col-safety', schema: 'demo-type-procedure', owner: tom, reviewer: owner,
      fields: { 'procedure code': 'HS-04', 'applies to': 'Everyone arriving on site' }, reference: { kind: 'project', name: 'Riverside Library build-out' }, review: -10, expiry: null,
      completed: { kind: 'review', by: dan, days: -9, evidence: 'Walked through it with two new starters on the Riverside site; added the new gate code step.' },
      versions: [
        { filename: 'site-induction-checklist.txt', days: -120, by: tom, reviewer: owner, events: [approve(owner, -119)],
          bytes: text(['SITE INDUCTION CHECKLIST (HS-04)', '', '[ ] Sign in at the site office and collect a visitor badge', '[ ] Show the restrooms and break area, first aid point and fire assembly point', '[ ] Hard hat, hi-vis and safety boots on before leaving the office', '[ ] Explain the permit to work board and who signs it', '[ ] Walk the pedestrian routes; point out the exclusion zones', '[ ] Name the first aider and fire marshal on shift']) },
        { filename: 'site-induction-checklist.txt', days: -11, by: dan, reviewer: owner, events: [approve(owner, -10, 'Gate code step added. Good to go.')],
          bytes: text(['SITE INDUCTION CHECKLIST (HS-04)', '', '[ ] Sign in at the site office and collect a visitor badge', '[ ] Give the gate code in person only; never by text or email', '[ ] Show the restrooms and break area, first aid point and fire assembly point', '[ ] Hard hat, hi-vis and safety boots on before leaving the office', '[ ] Explain the permit to work board and who signs it', '[ ] Walk the pedestrian routes; point out the exclusion zones', '[ ] Name the first aider and fire marshal on shift']) },
        { filename: 'site-induction-checklist.txt', days: -1, by: tom, reviewer: owner, events: [{ action: 'comment', by: tom, days: -1, message: 'Adds the dust mask fit check now that sanding has started.' }],
          bytes: text(['SITE INDUCTION CHECKLIST (HS-04)', '', '[ ] Sign in at the site office and collect a visitor badge', '[ ] Give the gate code in person only; never by text or email', '[ ] Show the restrooms and break area, first aid point and fire assembly point', '[ ] Hard hat, hi-vis and safety boots on before leaving the office', '[ ] FFP3 dust mask face-fit check while sanding is in progress', '[ ] Explain the permit to work board and who signs it', '[ ] Walk the pedestrian routes; point out the exclusion zones', '[ ] Name the first aider and fire marshal on shift']) },
      ] },
    { id: 'demo-doc-04', title: 'Freight services agreement', collection: 'demo-col-suppliers', schema: 'demo-type-contract', owner: priya, reviewer: maria,
      fields: { 'contract reference': 'KF-HW-0142', 'annual value (USD)': 52_000, 'auto-renews': true, 'notice period (days)': 60 }, reference: { kind: 'supplier', name: 'Kestrel Freight' }, review: 45, expiry: 105,
      versions: [{ filename: 'kestrel-freight-services-agreement.pdf', days: -260, by: priya, reviewer: maria, events: [approve(maria, -258, 'Signed copy, both parties.')],
        bytes: pdf('Freight services agreement', ['Between Kestrel Freight LLC and Harborworks LLC', 'Reference: KF-HW-0142', 'Scope: palletized deliveries to Harborworks sites within 80 miles', 'Charges: per schedule 2, reviewed annually', 'Term: 12 months, renewing automatically unless ended on 60 days notice']) }] },
    { id: 'demo-doc-05', title: "Employers' liability certificate", collection: 'demo-col-insurance', schema: 'demo-type-insurance', owner: maria, reviewer: owner,
      fields: { 'policy number': 'EL-77310', insurer: 'Thornbury Insurance', 'cover limit (USD)': 1_000_000 }, reference: null, review: 130, expiry: 160,
      versions: [{ filename: 'workers-compensation-2026.pdf', days: -205, by: maria, reviewer: owner, events: [approve(owner, -204)],
        bytes: pdf("Certificate of workers' compensation and employer's liability insurance", ['Policyholder: Harborworks LLC', 'Policy number: EL-77310', 'Insurer: Thornbury Insurance', 'Each accident limit: $1,000,000', `Period: ${on(-205)} to ${on(160)}`, "Post the workers' compensation notice where employees can read it."]) }] },
    { id: 'demo-doc-06', title: 'Professional indemnity schedule', collection: 'demo-col-insurance', schema: 'demo-type-insurance', owner: maria, reviewer: owner,
      fields: { 'policy number': 'PI-20931', insurer: 'Aldgate Mutual', 'cover limit (USD)': 2_000_000 }, reference: null, review: -3, expiry: -6,
      versions: [{ filename: 'professional-indemnity-schedule.pdf', days: -371, by: maria, reviewer: owner, events: [approve(owner, -370)],
        bytes: pdf('Professional liability - declarations page', ['Insured: Harborworks LLC', 'Policy number: PI-20931', 'Insurer: Aldgate Mutual', 'Limit: $2,000,000 each claim', `Period: ${on(-371)} to ${on(-6)}`]) }] },
    { id: 'demo-doc-07', title: 'Scaffolding subcontract', collection: 'demo-col-suppliers', schema: 'demo-type-contract', owner: dan, reviewer: owner,
      fields: { 'contract reference': 'TS-1187', 'annual value (USD)': 64_750, 'auto-renews': false, 'notice period (days)': 14 }, reference: { kind: 'supplier', name: 'Tallis Scaffolding' }, review: -1, expiry: 75,
      versions: [{ filename: 'tallis-scaffolding-subcontract.pdf', days: -88, by: dan, reviewer: owner, events: [{ action: 'comment', by: owner, days: -87, message: 'Check the inspection schedule is weekly, not fortnightly.' }, approve(owner, -86, 'Weekly inspections confirmed in clause 5.')],
        bytes: pdf('Subcontract - scaffolding', ['Subcontractor: Tallis Scaffolding LLC', 'Main contractor: Harborworks LLC', 'Reference: TS-1187', '5. Scaffold inspected and tagged every 7 days and after bad weather', '9. Either party may end this subcontract on 14 days notice']) }] },
    { id: 'demo-doc-08', title: 'Working at height procedure', collection: 'demo-col-safety', schema: 'demo-type-procedure', owner: tom, reviewer: owner,
      fields: { 'procedure code': 'HS-07', 'applies to': 'Ladders, towers, MEWPs and scaffold' }, reference: null, review: 60, expiry: null,
      versions: [{ filename: 'working-at-height.md', days: -150, by: tom, reviewer: owner, events: [approve(owner, -149)],
        bytes: text(['# Working at height (HS-07)', '', '1. Avoid work at height where you can; plan it where you cannot.', '2. Ladders are for short-duration, light work only, with three points of contact.', '3. Mobile towers are built by PASMA-trained staff and inspected before each shift.', '4. MEWP operators hold a current IPAF card; harness clipped to the basket.', '5. Report any missing guardrail or toe board to the site lead before work continues.']) }] },
    { id: 'demo-doc-09', title: 'Chemical safety assessment: floor sealant', collection: 'demo-col-safety', schema: 'demo-type-procedure', owner: dan, reviewer: tom,
      fields: { 'procedure code': 'HS-12', 'applies to': 'Floor finishing crew' }, reference: { kind: 'project', name: 'Riverside Library build-out' }, review: 25, expiry: null,
      versions: [{ filename: 'coshh-floor-sealant.txt', days: -3, by: dan, reviewer: tom, events: [],
        bytes: text(['CHEMICAL SAFETY ASSESSMENT (HS-12) - polyurethane floor sealant', '', 'Hazards: solvent vapor (drowsiness), skin and eye irritation', 'Controls: open windows and run the extract fan; no other trades in the room while applying', 'PPE: nitrile gloves, goggles, organic vapor respirator in enclosed rooms', 'Storage: locked flammables cabinet, away from the site trailer', 'First aid: fresh air; wash skin with soap and water; eyes 15 minutes at the eyewash station']) }] },
    { id: 'demo-doc-10', title: 'Waste hauler permit', collection: 'demo-col-suppliers', schema: 'demo-type-licence', owner: priya, reviewer: maria,
      fields: { 'license number': 'SWH-418806', 'issued by': 'State Department of Environmental Quality', 'issued on': on(-430) }, reference: { kind: 'supplier', name: 'Greenway Waste Services' }, review: null, expiry: 300,
      versions: [{ filename: 'greenway-waste-hauler-permit.pdf', days: -61, by: priya, reviewer: maria, events: [approve(maria, -60)],
        bytes: pdf('Solid waste hauler permit', ['Registered: Greenway Waste Services LLC', 'Permit number: SWH-418806', 'Class: commercial and construction waste', 'Issued by: State Department of Environmental Quality', `Expires: ${on(300)}`]) }] },
    { id: 'demo-doc-11', title: 'Construction fence permit: Riverside Library', collection: 'demo-col-projects', schema: 'demo-type-licence', owner: dan, reviewer: owner,
      fields: { 'license number': 'BC-HL-5521', 'issued by': 'Brightwater County', 'issued on': on(-74) }, reference: { kind: 'project', name: 'Riverside Library build-out' }, review: 10, expiry: 18,
      versions: [{ filename: 'construction-fence-permit-riverside.pdf', days: -73, by: dan, reviewer: owner, events: [approve(owner, -72)],
        bytes: pdf('Permit to place a construction fence in the public right-of-way', ['Permittee: Harborworks LLC', 'Location: Riverside Library, Mill Street frontage', 'Permit number: BC-HL-5521', 'Issued by: Brightwater County public works', `Valid until: ${on(18)}. Apply for an extension 14 days before expiry.`]) }] },
    { id: 'demo-doc-12', title: 'Brightwater County framework agreement', collection: 'demo-col-projects', schema: 'demo-type-contract', owner: owner, reviewer: maria,
      fields: { 'contract reference': 'BWC-FW-2026-03', 'annual value (USD)': 420_000, 'auto-renews': false, 'notice period (days)': 90 }, reference: { kind: 'customer', name: 'Brightwater County' }, review: 90, expiry: 600,
      versions: [{ filename: 'brightwater-framework-agreement.pdf', days: -180, by: owner, reviewer: maria, events: [approve(maria, -177, 'Countersigned copy received from the council.')],
        bytes: pdf('Framework agreement - minor works and build-out', ['Customer: Brightwater County', 'Contractor: Harborworks LLC (Lot 2, interior build-out)', 'Reference: BWC-FW-2026-03', 'Call-off contracts awarded by mini-competition', 'Term: two years from signature; 90 days notice to end']) }] },
    { id: 'demo-doc-13', title: 'Staff handbook', collection: 'demo-col-people', schema: 'demo-type-procedure', owner: maria, reviewer: owner, private: true, grants: [g(maria, 'editor')],
      fields: { 'procedure code': 'HR-01', 'applies to': 'All employees' }, reference: null, review: 200, expiry: null,
      versions: [{ filename: 'staff-handbook.md', days: -140, by: maria, reviewer: owner, events: [approve(owner, -139)],
        bytes: text(['# Harborworks staff handbook', '', '## Hours', 'Site days run 7:30 AM to 4:30 PM, Monday through Friday. The office opens at 8:30 AM.', '', '## Paid time off', '15 days plus federal holidays. Request it through Maria at least two weeks ahead.', '', '## Sick days', 'Call your site lead before 7:00 AM on the first day.']) }] },
    { id: 'demo-doc-14', title: 'Fire risk assessment (2024)', collection: 'demo-col-safety', schema: 'demo-type-procedure', owner: tom, reviewer: owner, trash: -30,
      fields: { 'procedure code': 'HS-02', 'applies to': 'Head office' }, reference: null, review: null, expiry: null,
      versions: [{ filename: 'fire-risk-assessment-2024.txt', days: -500, by: tom, reviewer: owner, events: [approve(owner, -498)],
        bytes: text(['FIRE RISK ASSESSMENT 2024 - HEAD OFFICE', 'Superseded by the 2026 assessment held by the landlord.']) }] },
  ]
}
