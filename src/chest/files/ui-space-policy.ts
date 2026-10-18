import { area, card, details, esc, field, form, hidden, select, stamp } from '../ui-shared'
import { problemWords } from '../ui-problems'
import type { SpaceDefaults } from './space-policy'
const yesNo = [{ id: 'true', label: 'Yes' }, { id: 'false', label: 'No' }]
export function spaceDefaultFields(d: SpaceDefaults, admin = false) {
 return select('Allow external access', 'externalAccess', yesNo, String(d.externalAccess))
 + select('Allow access for people outside space membership', 'nonMemberAccess', yesNo, String(d.nonMemberAccess))
 + select('Content managers may share folders', 'contentManagerFolderSharing', yesNo, String(d.contentManagerFolderSharing))
 + select('No download, print or copy for viewers and commenters', 'noDownload', yesNo, String(d.noDownload))
 + select('Default link audience', 'defaultLinkAudience', [{ id: 'restricted', label: 'Only people with access' }, { id: 'organisation', label: 'People in this organization' }, { id: 'public', label: 'Anyone with the link' }], d.defaultLinkAudience)
 + field('Storage limit in bytes (blank means unlimited)', 'storageLimitBytes', d.storageLimitBytes === null ? '' : String(d.storageLimitBytes), 'number', false)
 + (admin ? select('Allow managers to override defaulted settings', 'managerOverride', yesNo, String(d.managerOverride)) : `<p class="quiet">Managers may change defaulted settings: ${d.managerOverride ? 'yes' : 'no'}. Only a service-settings admin can change this switch.</p>`)
}
export function spaceSettingsCard(d: any) {
 const lock = !d.settings.managerOverride && !d.serviceAdmin ? '<p class="quiet">Your administrator has locked defaulted settings. You can ask an admin to change these settings. Ask a service-settings admin to change this space.</p>' : ''
 const body = lock + spaceDefaultFields(d.settings, d.serviceAdmin) + select('Content managers may share files', 'editorSharing', yesNo, String(d.settings.editorSharing)) + `<p class="quiet">Current storage: ${esc(d.storage.usedBytes)} bytes. Organization sharing restrictions still apply.</p>` + select('Confirm saving a storage limit below current usage', 'confirmOverLimit', [{id:'false',label:'No'},{id:'true',label:'Yes, keep existing files and refuse new writes above the limit'}], 'false')
 return card('Space settings', form(`/spaces/${d.id}/settings`, body, 'Save space settings', `/app/spaces/${d.id}`, { buttonClass: 'btn btn-outline btn-block' }), 'side-card')
}
export function spaceCreationPanel(d: any) {
 const create = d.spaceCreation.allowed ? form('/spaces', field('New team space name', 'name'), 'Create team space', '/app/files', { className: 'form form-create' }) : `<p>${esc(problemWords(d.spaceCreation.rule))}</p>${details('Request a team space', form('/space-requests', field('Requested team space name', 'name') + area('Why do you need this space?', 'message', '', false), 'Send space request', '/app/files'), 'btn btn-outline')}`
 return create + (['owner','admin'].includes(d.me.role) ? '<p><a class="link" href="/app/files/space-policy">Space creation &amp; defaults</a></p>' : '')
}
export function spacePolicyPage(d: any, selected = 'organisation', perSpace?: any) {
 const group = d.groups.find((g: any) => selected === `group:${g.id}`), space = d.spaces.find((s: any) => selected === `space:${s.id}`)
 const scope = space || group ? selected : 'organisation', defaults = space?.settings ?? group?.defaults ?? d.policy.defaults
 const scopes = [{id:'organisation',label:'Whole organization'}, ...d.groups.map((g:any)=>({id:`group:${g.id}`,label:`Creator group · ${g.name}`})), ...d.spaces.map((s:any)=>({id:`space:${s.id}`,label:`Existing space · ${s.name}`}))]
 const chooser = `<form class="form form-inline" method="get" action="/app/files/space-policy">${select('Settings scope','scope',scopes,scope)}<button class="btn btn-outline">Open settings</button></form>`
 const creation = scope === 'organisation' ? select('Who may create team spaces', 'creation', [{id:'everyone',label:'Everyone'},{id:'groups',label:'Named groups only'},{id:'admins',label:'Admins only'}], d.policy.creation) + `<fieldset><legend>Groups allowed to create spaces</legend>${d.groups.length ? d.groups.map((g:any)=>`<label><input type="checkbox" name="creatorGroup:${esc(g.id)}" value="true" ${d.policy.creatorGroups.includes(g.id)?'checked':''}> ${esc(g.name)}</label>`).join('') : '<p class="quiet">Create a group in People &amp; settings first.</p>'}</fieldset>` : ''
 const usage = space ? `<p>Current storage: ${esc(perSpace?.usedBytes ?? 0)} bytes.</p>${select('Confirm saving a storage limit below current usage','confirmOverLimit',[{id:'false',label:'No'},{id:'true',label:'Yes, retain files and refuse writes above the limit'}],'false')}` : '<p class="quiet">These defaults apply only to spaces created after saving. Existing spaces keep their current settings. Organization sharing restrictions still win.</p>'
 const explanation = group ? `<p>${group.defaults ? 'This creator group has its own defaults.' : 'This creator group currently uses organization defaults. Saving creates an override.'} If a creator is in several override groups, the more restrictive value for each setting wins.</p>` : ''
 const save = form(space ? `/space-policy/${space.id}` : '/space-policy', hidden('scope', scope) + creation + explanation + usage + spaceDefaultFields(defaults, true), space ? 'Save this space' : 'Save space policy', `/app/files/space-policy?scope=${encodeURIComponent(scope)}`)
 const remove = group?.defaults ? form('/space-policy', hidden('scope', scope) + hidden('remove','true'), 'Use organization defaults for this group', `/app/files/space-policy?scope=${encodeURIComponent(scope)}`, {buttonClass:'btn btn-outline'}) : ''
 const requests = d.requests.length ? `<ol class="events">${d.requests.map((r:any)=>`<li><strong>${esc(r.name)}</strong><p>${esc(r.requester)} · ${stamp(r.at)}</p><p>${esc(r.message)}</p><p class="quiet">Rule: ${esc(r.rule)}</p></li>`).join('')}</ol>` : '<p class="quiet">No space requests yet.</p>'
 return `<div class="page-head"><h1>Space creation &amp; defaults</h1><p class="lede">Service settings for team spaces.</p></div><p><a class="link" href="/app/files">Back to Files</a></p>${chooser}${card(space ? `Settings · ${space.name}` : group ? `New-space defaults · ${group.name}` : 'Creation rule and new-space defaults', save + remove)}${card('Space requests', requests)}`
}
