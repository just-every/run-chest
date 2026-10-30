import type { Session } from '../modules/operator-auth/index.mjs'

export type AgentIdentity = { id: string; sponsor: string; grant: string; name?:string; sponsorName?:string; label?:string; door?:boolean; approvers?:readonly {id:string;name:string}[] }
export function sessionAgent(session: Session): AgentIdentity | undefined {
 return (session as Session & { agent?: AgentIdentity }).agent
}
export function agentAttribution(agent: AgentIdentity) {
 return { initiation: 'agent-initiated', agent: agent.id, sponsor: agent.sponsor, grant: agent.grant, label:agent.label??agent.id, approvers:agent.approvers??[] }
}
