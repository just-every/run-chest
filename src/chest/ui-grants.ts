import { esc,select,form,hidden,personPicker } from './ui-shared'
const inline={className:'form form-inline',buttonClass:'btn btn-outline'}
const roleName=(r:string)=>({reader:'Reader',editor:'Editor',reviewer:'Reviewer'} as Record<string,string>)[r]??r
export const principalName=(principal:string,data:any)=>{const g=data.groups.find((r:any)=>r.id===principal),p=data.people.find((r:any)=>r.id===principal);return g?`Group · ${esc(g.payload.name)}`:p?`${esc(p.payload.name)} <span class="mono">${esc(p.id)}</span>`:`<span class="mono">${esc(principal)}</span>`}
// Library access for a collection or a document: each grant on its own row with Remove, then a person (by email) or
// a group with a role. Readers open; editors also change filing; reviewers also decide versions.
export function grantEditor(path:string,grants:any[],data:any,returnTo:string,list:string,none:string){
 const roles=['reader','editor','reviewer'].map(id=>({id,label:roleName(id)}))
 const rows=grants.map((g:any)=>`<li class="member"><span>${principalName(g.principal,data)} · <strong>${esc(roleName(g.role))}</strong></span>${form(path,hidden('action','remove')+hidden('principal',g.principal)+hidden('role',g.role),'Remove',returnTo,inline)}</li>`).join('')
 return `${rows?`<ul class="events members">${rows}</ul>`:`<p class="quiet">${esc(none)}</p>`}${form(path,hidden('action','add')+personPicker('Person (email)','principal',data.people.filter((p:any)=>p.payload.status!=='inactive'),list)+select('Role','role',roles),'Give access',returnTo,inline)}${data.groups.length?form(path,hidden('action','add')+select('Group','principal',data.groups.map((g:any)=>({id:g.id,label:g.payload.name})))+select('Role','role',roles),'Give group access',returnTo,inline):''}<p class="quiet">Readers open. Editors also change filing. Reviewers also decide versions.</p>`
}
