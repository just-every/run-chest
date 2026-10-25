import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { card,esc,field,select,form,stamp } from '../ui-shared'
import { editorConfiguration, codeNotice } from './editor-capacity'
import { canAdmin } from './roles'
export async function editorCostCard(env:Bindings,s:Session){
 const d=await editorConfiguration(env,s),v=d.settings,editable=await canAdmin(env,s,'service-settings')
 const configured=v?`<p>Collabora Online · ${esc(v.edition)} · ${v.enabled?'New sessions enabled':'New sessions disabled'}</p><p>${v.documents} documents · ${v.connections} connections · USD ${v.annualUsd} per user annually, owner-entered estimate</p><p>Quote: ${esc(v.quote)} · ${stamp(v.updatedAt)}</p>`:'<p>No edition or capacity has been confirmed. Confirm the provider before opening new editing sessions.</p>'
 const body=select('Collabora edition','edition',[{id:'CODE',label:'CODE — USD 0'},{id:'subscription',label:'Collabora Online subscription'}],v?.edition??'CODE')+field('Concurrent document limit','documents',String(v?.documents??''),'number')+field('Concurrent connection limit','connections',String(v?.connections??''),'number')+field('Annual USD per user','annualUsd',String(v?.annualUsd??0),'number')+field('Provider quote and reported limit source','quote',v?.quote??'')+select('New editing sessions','enabled',[{id:'true',label:'Enable after confirmation'},{id:'false',label:'Disable new sessions'}],String(v?.enabled??false))+'<label class="check"><input type="checkbox" name="codeAcknowledged" value="true">I acknowledge CODE’s production warning and the reported limits.</label><label class="check"><input type="checkbox" name="confirm" value="true" required>I confirm the edition, limits and provider price above.</label>'
 return card('Collabora edition and capacity',`<p>${esc(codeNotice)}</p>${configured}<p>${esc(d.basis)}</p>${editable?form('/administration/editor',body,'Confirm editor configuration','/app/administration/costs'):''}`)
}
