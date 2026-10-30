import {
  operatorAuthPeople,
  ToolRefusal,
  type PeopleAdapter,
  type Person,
  type ToolContext,
} from "../../modules/agent-door/index.ts";
import { operatorAuth, type Bindings } from "../../auth.server";
import type { Session } from "../../modules/operator-auth/index.mjs";
import { assertDomainSession } from "../organisation/domains";
import { sessionSecurity } from "../security/session";
import {
  authorize,
  credentialSession,
  requestBudget,
  type Authorized,
} from "../integrations/auth";
import { attach, demandPolicy } from "../integrations/policy";
import type { Action } from "../integrations/model";

export async function nativeSession(
  env: Bindings,
  person: Pick<Person, "id">,
): Promise<Session> {
  const o = await env.DB.prepare(
    "SELECT * FROM oa_operators WHERE id=? AND status='active'",
  )
    .bind(person.id)
    .first<any>();
  if (!o) throw new ToolRefusal("unauthenticated");
  const at = Date.now();
  const session = {
    id: `agent-door:${o.id}`,
    kind: "agent-door",
    operatorId: o.id,
    operator: {
      id: o.id,
      email: o.email,
      displayName: o.display_name,
      role: o.role,
      status: o.status,
      version: o.version,
      createdAt: o.created_at,
    },
    createdAt: at,
    expiresAt: at + 60_000,
    predicate: {
      sql: "EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND email=? AND role=? AND status='active' AND version=?)",
      params: [o.id, o.email, o.role, o.version],
    },
  } as unknown as Session;
  await assertDomainSession(env, session);
  if (!(await sessionSecurity(env, session, false)).allowed)
    throw new ToolRefusal("native_proof_required");
  return session;
}
export function chestPeople(env: Bindings): PeopleAdapter {
  const native = operatorAuthPeople({
    db: env.DB,
    session: (request) => operatorAuth(env).getSession(request),
  });
  const roles = new Map<string, "owner" | "editor" | null>();
  const admitted = async (person: Person | null) => {
    if (!person?.active) return null;
    try {
      await nativeSession(env, person);
      roles.set(
        person.id,
        (await native.businessMember?.(person))?.role ??
          (env.RER_BUSINESS_TRUST
            ? null
            : person.role === "owner"
              ? "owner"
              : null),
      );
      return person;
    } catch {
      return null;
    }
  };
  return {
    ...native,
    businessRole: (person) => roles.get(person.id) ?? null,
    session: async (request) => admitted(await native.session(request)),
    person: async (id) => admitted(await native.person(id)),
    sponsor: async (claims) => admitted(await native.sponsor(claims)),
  };
}
export async function localCredential(env: Bindings, request: Request) {
  if (!/^Bearer chest_oauth_/.test(request.headers.get("authorization") ?? ""))
    return null;
  const a = await requestBudget(env, await authorize(env, request));
  return {
    sponsor: { id: a.session.operator.id },
    agent: {
      id: a.client.id,
      name: a.client.payload.name,
      specialist: "records clerk",
    },
    scopes: [...a.grant.payload.actions],
    clientId: a.tokenId,
  };
}
export async function currentScopes(
  env: Bindings,
  principal: { clientId?: string; scopes: readonly string[] },
) {
  if (!principal.clientId?.startsWith("token:")) return [...principal.scopes];
  try {
    return [
      ...(
        await credentialSession(
          env,
          new Request(env.AUTH_ORIGIN),
          principal.clientId,
        )
      ).grant.payload.actions,
    ];
  } catch {
    return [];
  }
}
export async function agentSession(
  env: Bindings,
  ctx: ToolContext,
): Promise<{ session: Session; local?: Authorized }> {
  const local = ctx.clientId?.startsWith("token:")
    ? await credentialSession(env, new Request(env.AUTH_ORIGIN), ctx.clientId)
    : undefined;
  const session = local?.session ?? (await nativeSession(env, ctx.person));
  if (session.operator.id !== ctx.person.id)
    throw new ToolRefusal("unauthenticated");
  (session as any).agent = {
    id: ctx.agent.id,
    name: ctx.agent.name,
    sponsor: ctx.person.id,
    sponsorName: ctx.person.name,
    grant: ctx.consent ?? local?.grant.id ?? ctx.operationId,
    label: ctx.actor.label,
    approvers: ctx.approvers,
    door: true,
  };
  if (!local)
    await demandPolicy(env, session, ctx.agent.id, [
      ...new Set(
        ctx.scopes.map((s) =>
          [
            "read",
            "search",
            "download",
            "upload",
            "folder",
            "versions",
            "share",
            "request",
            "picker",
            "webhook",
          ].includes(s)
            ? (s as Action)
            : "upload",
        ),
      ),
    ]);
  // A later signed policy/pause/revocation invalidates the native transaction as well as door admission.
  const state = await env.DB.prepare(
    "SELECT envelope,local_document,local_revision,local_paused FROM agent_door_state WHERE id=1",
  ).first<any>();
  attach(session, {
    sql: "EXISTS(SELECT 1 FROM agent_door_agents WHERE id=? AND sponsor=? AND revoked=0)",
    params: [ctx.agent.id, ctx.person.id],
  });
  if (state)
    attach(session, {
      sql: "EXISTS(SELECT 1 FROM agent_door_state WHERE id=1 AND envelope IS ? AND local_document IS ? AND local_revision=? AND local_paused=?)",
      params: [
        state.envelope,
        state.local_document,
        state.local_revision,
        state.local_paused,
      ],
    });
  return { session, local };
}
