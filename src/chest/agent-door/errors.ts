import {ToolRefusal,type ToolDefinition} from '../../modules/agent-door/index.ts'
import {ChestError} from '../model'
/** Keep native symbolic refusals (including source pauses and budgets) intact. */
export function nativeRefusals(tool:ToolDefinition):ToolDefinition {
 const guarded={...tool}
 for(const key of ['classify','summary','target','revision','run','authority'] as const){const fn=tool[key];if(typeof fn==='function')(guarded as any)[key]=async(...args:any[])=>{try{return await (fn as Function)(...args)}catch(error){if(error instanceof ChestError)throw new ToolRefusal(error.code,error.code,{native_status:error.status});throw error}}}
 return guarded
}
