import type { Bindings } from '../auth.server'
import type { Session } from '../modules/operator-auth/index.mjs'

export type AgentIdentity = { id: string; sponsor: string; grant: string; name?:string; sponsorName?:string; label?:string; door?:boolean; approvers?:readonly {id:string;name:string}[] }
export function sessionAgent(session: Session): AgentIdentity | undefined {
 return (session as Session & { agent?: AgentIdentity }).agent
}
export function agentAttribution(agent: AgentIdentity) {
 return { initiation: 'agent-initiated', agent: agent.id, sponsor: agent.sponsor, grant: agent.grant, label:agent.label??agent.id, approvers:agent.approvers??[] }
}
export type AgentAction = { riskClass: 'external-share'; agent: AgentIdentity; item: string; audience: string; recipients: string[] }
export type AgentPolicyDecision = { decision: 'allow' | 'review' | 'approve' | 'block'; policy: string }
// Classification and company approval happen in createAgentDoor before this native choke point.
export async function agentPolicy(_env:Bindings,action:AgentAction):Promise<AgentPolicyDecision>{
 return action.agent.door===true?{decision:'allow',policy:'shared-agent-door'}:{decision:'block',policy:'shared-agent-door-required'}
}
