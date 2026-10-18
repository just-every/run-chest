import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { eraseD1ImportTarget, upgradeD1ImportErasureIndex, type D1ImportContext } from '../../modules/import-kit/src/d1/index'
import { chestTargets } from '../archive-target'
import { ownerPredicate } from '../store'
async function indexed(env:Bindings,s:Session):Promise<D1ImportContext>{
 const context:D1ImportContext={destination:'library',namespace:'chest-archive-v1',mappingVersion:'chest-archive-v1',storage:{database:env.DB,targets:chestTargets},authorization:{principalId:s.operator.email,predicate:()=>ownerPredicate(s)},originalErasurePolicy:'withdraw-affected-artifacts'}
 while(!(await upgradeD1ImportErasureIndex(context)).complete){}
 return context
}
// Native deletion and custody withdrawal share the kit's exact guarded publication transaction.
export async function eraseImportCustody(env:Bindings,s:Session,key:string){
 return eraseD1ImportTarget('document',key,[{sql:"DELETE FROM chest_records WHERE kind='document' AND id=?",params:[key]}],await indexed(env,s))
}
// Withdraw retained source records and exact artifacts containing the erased identity, severing their
// import effects without deleting independently retained team files.
export async function eraseIdentityCustody(env:Bindings,s:Session,email:string,hash:string){
 return eraseD1ImportTarget('erased-identity',hash,[],await indexed(env,s),{source:record=>JSON.stringify(record.payload).toLowerCase().includes(email),original:bytes=>new TextDecoder().decode(bytes).toLowerCase().includes(email)})
}
