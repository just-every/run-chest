import { card,esc,field,select,form,hidden } from '../ui-shared'
const back='/app/administration'
const action=(path:string,body:string,label:string)=>form('/administration/'+path,body,label,back)
// A person's own actions are quiet and show on hover and focus (H16); the ones that ask for a value fold under Manage.
const quiet=(path:string,body:string,label:string)=>form('/administration/'+path,body,label,back,{className:'form form-inline',buttonClass:'btn btn-quiet btn-sm'})

function rowsCard(d:any,navigation=''){if(!d.people.length&&!d.userManagement)return '';return card('People in your administrative scope',`<p>Every action checks your current administrative role and group scope.</p>${navigation}${d.people.map((p:any)=>{
  const email=hidden('email',p.email)
  const simple=(p.helpdesk?quiet('people',email+hidden('action','sessions'),'Inspect sessions')+quiet('people',email+hidden('action','revoke-sessions'),'Revoke sessions')+quiet('people',email+hidden('action','revoke-devices'),'Revoke devices')+(p.status==='invited'?quiet('people',email+hidden('action','resend-invite'),'Resend invitation'):''):'')+(p.manage?quiet('people',email+hidden('action',p.status==='inactive'?'reactivate':'deactivate'),p.status==='inactive'?'Reactivate person':'Deactivate person'):'')
  const asking=(p.helpdesk?form('/security/reset',email+'<label class="check"><input type="checkbox" name="verified" value="true" required>I verified this person’s identity</label>','Send factor reset',back):'')+(p.manage?action('people',email+hidden('action','offboard')+field('Successor email','to','','email'),'Offboard and transfer personal area'):'')
  return `<section class="card row-quiet admin-person"><div class="person-facts"><strong>${esc(p.name)}</strong><span class="mono">${esc(p.email)}</span>${p.role==='member'?'':`<span class="mono">${esc(p.role)}</span>`}${p.status==='active'?'':`<span class="mono">${esc(p.status)}</span>`}</div><div class="row-actions">${simple}${asking?`<details class="row-more"><summary class="btn btn-quiet btn-sm">Manage</summary><div class="row-more-body">${asking}</div></details>`:''}</div></section>`}).join('')}${d.userManagement?action('people',hidden('action','invite')+field('New colleague name','name')+field('New colleague email','email','','email')+select('Initial group','group',[{id:'',label:'No initial group'},...d.groups.map((g:any)=>({id:g.id,label:g.name}))],'',false),'Invite colleague'):''}${d.groups.length?action('groups',select('Group','group',d.groups.map((g:any)=>({id:g.id,label:g.name})))+field('Group member email','email','','email')+select('Membership change','action',[{id:'add',label:'Add to group'},{id:'remove',label:'Remove from group'}]),'Update group'):''}${navigation}`)}

// Render a bounded roster while preserving the same scoped actions on each page.
export function peopleCard(d:any,url:URL){
 const requested=Number(url.searchParams.get('peoplePage')??0),limit=25,total=d.people.length
 const page=Math.min(Number.isSafeInteger(requested)&&requested>=0?requested:0,Math.max(0,Math.ceil(total/limit)-1)),offset=page*limit
 const href=(value:number)=>{const next=new URL(url);next.searchParams.set('peoplePage',String(value));return next.pathname+next.search+'#people'}
 const navigation=total>limit?`<nav aria-label="People pages"><p>People ${offset+1}–${Math.min(offset+limit,total)} of ${total}</p><p>${page?`<a class="btn btn-outline btn-sm" href="${esc(href(page-1))}">Previous people</a> `:''}${offset+limit<total?`<a class="btn btn-outline btn-sm" href="${esc(href(page+1))}">Next people</a>`:''}</p></nav>`:''
 return `<div id="people">${rowsCard({...d,people:d.people.slice(offset,offset+limit)},navigation)}</div>`
}
