import type { Bindings } from '../auth.server'
import type { Session } from '../modules/operator-auth/index.mjs'

export type AgentIdentity = { id: string; sponsor: string; grant: string }
export function sessionAgent(session: Session): AgentIdentity | undefined {
 return (session as Session & { agent?: AgentIdentity }).agent
}
export function agentAttribution(agent: AgentIdentity) {
 return { initiation: 'agent-initiated', agent: agent.id, sponsor: agent.sponsor, grant: agent.grant }
}
export type AgentAction = { riskClass: 'external-share'; agent: AgentIdentity; item: string; audience: string; recipients: string[] }
export type AgentPolicyDecision = { decision: 'allow' | 'review' | 'approve' | 'block'; policy: string }
// The company policy integration belongs here. Preserve current autonomous sharing until Base supplies it.
// An agent flag is never evidence of a person's confirmation.
export async function agentPolicy(_env: Bindings, _action: AgentAction): Promise<AgentPolicyDecision> {
 return { decision: 'allow', policy: 'current-behavior' }
}
