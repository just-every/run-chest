import type { Session } from "../modules/operator-auth/index.mjs";

export type AgentIdentity = {
  id: string;
  sponsor: string;
  grant: string;
  name?: string;
  sponsorName?: string;
  label?: string;
  door?: boolean;
  approvers?: readonly { id: string; name: string }[];
};
export function sessionAgent(session: Session): AgentIdentity | undefined {
  return (session as Session & { agent?: AgentIdentity }).agent;
}
export function agentAttribution(agent: AgentIdentity) {
  return {
    initiation: "agent-initiated",
    agent: agent.id,
    sponsor: agent.sponsor,
    grant: agent.grant,
    label: agent.label ?? agent.id,
    approvers: agent.approvers ?? [],
  };
}

/** Audit IDs stay stable; native panels show the recorded named preparer. */
export function activityActor(row:{actor:string;detail?:unknown},fallback:(actor:string)=>string=actor=>actor):string {
 let detail:any=row.detail
 if(typeof detail==='string')try{detail=JSON.parse(detail)}catch{detail=null}
 return row.actor.startsWith('agent:')&&detail?.agent&&typeof detail.label==='string'?detail.label:fallback(row.actor)
}
