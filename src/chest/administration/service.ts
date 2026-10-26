import { scaleReport, scaleHealth } from './scale'
import { probeEditor } from './editor-observation'
import { editorConfiguration, saveEditorConfiguration, administrativeEditorReport, administrativeEditorCsv } from './editor-capacity'
import { administrativeProviderUsage, administrativeProviderUsageCsv } from './provider-usage'
import { administrativeEgress, administrativeEgressCsv } from './egress'
import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { list } from '../store'
import { insist } from '../model'
import { assignAdmin,adminView,canAdmin,isAdministrator,canAdminGroup } from './roles'
import { administrativePeople,administrativePersonAction,administrativeGroup } from './people'
import { offerOwner,acceptOwner,cancelOwner,ownerOffers } from './owner-transfer'
import { prepareRecovery,applyRecovery,recoveryView,recoveryTargets } from './recovery'
import { administrativeAudit,administrativeAuditCsv } from './reports'
import { administrativeStorage,administrativeStorageCsv } from './report-storage'
import { costSettings,saveCostSettings } from './costs'
import { administrativeGuests,administrativeGuestsCsv } from './report-guests'
export async function administrationView(env:Bindings,s:Session){
 insist(await isAdministrator(env,s),'admin_required',403)
 const owner=await ownerOffers(env,s),people=await administrativePeople(env,s),allGroups=await list(env,'group'),groups=[]
 for(const group of allGroups)if(await canAdminGroup(env,s,'user-management',group.id))groups.push({id:group.id,name:group.payload.name})
 let roles=null;try{roles=await adminView(env,s)}catch(error){if(!(error instanceof Error)||error.message!=='super_admin_required')throw error}
 let service=false,security=false,audit=false,userManagement=false;for(const group of allGroups){userManagement ||= await canAdminGroup(env,s,'user-management',group.id);service ||= await canAdminGroup(env,s,'service-settings',group.id);security ||= await canAdminGroup(env,s,'sharing-security',group.id);audit ||= await canAdminGroup(env,s,'audit-reporting',group.id)}
 return {owner,people,groups,roles,userManagement:userManagement||await canAdmin(env,s,'user-management'),recovery:await recoveryTargets(env,s),service:service||await canAdmin(env,s,'service-settings'),serviceOrganization:await canAdmin(env,s,'service-settings'),security:security||await canAdmin(env,s,'sharing-security'),securityOrganization:await canAdmin(env,s,'sharing-security'),helpdesk:await canAdmin(env,s,'help-desk'),audit:audit||await canAdmin(env,s,'audit-reporting'),isOwner:s.operator.role==='owner'}
}
export async function administrationExecute(env:Bindings,request:Request,s:Session,method:string,parts:string[],input:any,url:URL){
 if(parts[0]!=='administration')return undefined
 const [,section,key,verb]=parts,get=method==='GET',post=method==='POST'
 if(get&&!section)return administrationView(env,s)
 if(section==='scale')return get&&key==='health'?scaleHealth(env,s):scaleReport(env,s,post?input:undefined)
 if(post&&section==='roles')return assignAdmin(env,s,input)
 if(post&&section==='people')return administrativePersonAction(env,request,s,input)
 if(post&&section==='groups')return administrativeGroup(env,s,input)
 if(section==='owner'){
  if(get)return ownerOffers(env,s)
  if(post&&!key)return offerOwner(env,s,input)
  if(post&&key&&verb==='cancel')return cancelOwner(env,s,key)
  if(post&&key)return acceptOwner(env,s,key,input)
 }
 if(section==='recovery'){
  if(post&&!key)return prepareRecovery(env,s,input)
  if(get&&key)return recoveryView(env,s,key)
  if(post&&key)return applyRecovery(env,s,key,input)
 }
 if(section==='editor'&&post&&key==='probe')return probeEditor(env,s)
 if(section==='editor')return post?saveEditorConfiguration(env,s,input):editorConfiguration(env,s)
 if(get&&section==='editor-report')return key==='export'?administrativeEditorCsv(env,s,url.searchParams):administrativeEditorReport(env,s,url.searchParams)
 if(section==='costs')return post?saveCostSettings(env,s,input):costSettings(env,s)
 if(get&&section==='provider-usage')return key==='export'?administrativeProviderUsageCsv(env,s,url.searchParams):administrativeProviderUsage(env,s,url.searchParams)
 if(get&&section==='egress')return key==='export'?administrativeEgressCsv(env,s,url.searchParams):administrativeEgress(env,s,url.searchParams)
 if(get&&section==='guests')return key==='export'?administrativeGuestsCsv(env,s,url.searchParams):administrativeGuests(env,s,url.searchParams)
 if(get&&section==='storage')return key==='export'?administrativeStorageCsv(env,s,url.searchParams):administrativeStorage(env,s,url.searchParams)
 if(get&&section==='audit')return key==='export'?administrativeAuditCsv(env,s,url.searchParams):administrativeAudit(env,s,url.searchParams)
 insist(false,'not_found',404)
}
