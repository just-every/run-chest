import { area, card, esc, form, hidden, select, stamp } from '../ui-shared'

export function governancePanel(d: any, people: any[], returnTo: string) {
 if (d.item.type !== 'folder') return d.item.governance ? card('Version review', `<p>New originals await review by <span class="mono">${esc(d.item.governance.reviewer)}</span>. ${d.item.approved ? 'The approved version stays current until another exact version is approved.' : 'No version is approved yet.'}</p>`, 'side-card') : ''
 if (!d.can.administer) return d.item.governance ? card('Version review', `<p>New files and versions in this folder require review by ${esc(d.item.governance.reviewer)}.</p>`, 'side-card') : ''
 const types = d.metadata?.types ?? []
 const schema = select('Document type', 'schema', [{ id: '', label: 'No required type' }, ...types.map((r: any) => ({ id: r.id, label: r.payload.name }))], d.item.governance?.schema ?? '', false)
 return card('Version review', `<p class="quiet">Require review of new files and versions in this folder and its subfolders. Existing files enter review when next replaced. Assignment gives no access: give the reviewer access separately. Once approved, that exact version stays current while replacements await a decision. Moving a governed file keeps its review requirement.</p>${form(`/items/${d.id}/governance`, select('Reviewer', 'reviewer', people.filter(p => p.payload.status === 'active').map(p => ({ id: p.id, label: `${p.payload.name} · ${p.id}` })), d.item.governance?.reviewer ?? d.me) + schema, 'Require version review', returnTo, { buttonClass: 'btn btn-outline btn-block' })}`, 'side-card')
}

export function versionReview(v: any, d: any, returnTo: string) {
 if (!v.review) return ''
 const r = v.review, approved = d.item.approved === v.id
 const status = `<p class="mono">${approved ? 'Approved current version' : r.state === 'submitted' ? 'Awaiting review' : r.state === 'approved' ? 'Previously approved' : 'Changes requested'} · reviewer ${esc(r.reviewer)}${r.at ? ` · ${stamp(r.at)}` : ''}</p>${r.message ? `<p>${esc(r.message)}</p>` : ''}`
 if (r.state !== 'submitted' || r.reviewer !== d.me || (v.sourceItem && v.sourceItem !== d.id)) return status
 return status + form(`/items/${d.id}/versions/${v.id}/review`, hidden('action', 'approve'), 'Approve this version', returnTo, { buttonClass: 'btn btn-outline' }) + form(`/items/${d.id}/versions/${v.id}/review`, hidden('action', 'changes') + area('Changes needed', 'message', ''), 'Request changes', returnTo, { buttonClass: 'btn btn-outline' })
}
