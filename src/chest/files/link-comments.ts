import type { Bindings } from '../../auth.server'
import { insist, now, text } from '../model'
import { esc, stamp } from '../ui-shared'
import { commit, fresh, where } from './repo'
import { guestEmail, verifyPage } from './guest-links'
import { unlocked } from './capability'
import { resolveLink, type Resolved } from './public-links'
import { publicVersion } from './link-snapshots'
import { passwordPage, refusedLink } from './ui-public'
import type { Comment } from './comments'
import { deliver, notice } from './notify'
type LinkComment = Comment & { link: string }
// External visitors see only the discussion explicitly made through this link, on its selected version.
// Internal comments and discussions belonging to another link never leak through a broader audience.
export async function externalComments(env: Bindings,r:Resolved,base:string){
 const version=r.root.payload.type==='file'?publicVersion(r.root,r.link.payload)?.id:null
 if(r.root.payload.type==='file' && !version)return ''
 const comments=(await where<LinkComment>(env,'comment','$.link',r.link.id)).filter(c=>c.payload.item===r.root.id && c.payload.version===version)
 const rows=comments.map(c=>`<li><p>${esc(c.payload.message)}</p><p class="mono">${esc(c.payload.author)} · ${stamp(c.payload.at)}</p></li>`).join('')
 const form=r.link.payload.role==='commenter'?`<form class="link-discussion" method="post" action="${esc(base)}/comments/${esc(r.root.id)}"><input type="hidden" name="version" value="${esc(version??'')}"><label for="comment">Comment on this ${version?'version':'folder'}</label><textarea id="comment" name="message" maxlength="4000" required></textarea><button class="action">Post comment</button><p>Your comment and identity are visible to the owner and other people using this link.</p></form>`:''
 return rows || form?`<section aria-label="Shared discussion"><h2>Shared discussion</h2>${rows?`<ul>${rows}</ul>`:''}${form}</section>`:''
}
export async function externalComment(env:Bindings,request:Request,secret:string,key:string){
 const r=await resolveLink(env,secret),base=`/l/${secret}`;if('refused' in r)return refusedLink(r.refused)
 const actor=await guestEmail(env,request,r);if(!actor)return verifyPage(base)
 if(r.link.payload.password && !await unlocked(env,request,r.link.id,r.link.payload.password.hash))return passwordPage(base,false,401)
 insist(r.link.payload.role==='commenter','comment_refused',403)
 insist(key===r.root.id,'not_found',404)
 const form=await request.formData(),version=r.root.payload.type==='file'?publicVersion(r.root,r.link.payload)?.id:null
 insist(r.root.payload.type==='folder' || version,'version_not_found',404)
 insist(String(form.get('version')??'')===(version??''),'comment_version_changed',409)
 const recent=await env.DB.prepare("SELECT COUNT(*) n FROM chest_audit WHERE action='link.comment' AND object_id=? AND at>? AND json_extract(detail,'$.link')=?").bind(key,new Date(Date.now()-15*60000).toISOString(),r.link.id).first<{n:number}>()
 insist((recent?.n??0)<20,'comment_rate_limited',429)
 const row=fresh<LinkComment>('comment',{item:key,version:version??null,author:actor,message:text(form.get('message'),'comment',4000),at:now(),link:r.link.id})
 const custodian=r.link.payload.custodian??r.link.payload.createdBy,notes=[notice(custodian,'comment',key,actor,`${actor} commented on "${r.root.payload.name}":\n\n${row.payload.message}`)]
 await commit(env,null,[{row},...notes.map(row=>({row}))],{by:actor,fences:r.fences,audits:[{action:'link.comment',object:key,detail:{link:r.link.id,comment:row.id,version}}]})
 await deliver(env,null,notes)
 return new Response(null,{status:303,headers:{location:base,'cache-control':'no-store'}})
}
