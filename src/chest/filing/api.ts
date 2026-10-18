import type { Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { insist } from '../model'
import { intakeExecute } from './intake'
import { rulesExecute } from './rules'
import { batchesExecute } from './batches'
import { duplicatesExecute } from './duplicates'
export async function filingExecute(env:Bindings,s:Session,method:string,parts:string[],input:any,url:URL){
 if(parts[0]!=='filing')return undefined
 for(const handler of [intakeExecute,rulesExecute,batchesExecute,duplicatesExecute]){const result=await handler(env,s,method,parts,input,url);if(result!==undefined)return result}
 insist(false,'not_found',404)
}
