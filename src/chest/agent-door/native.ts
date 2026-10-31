import {
  ToolRefusal,
  type ToolContext,
} from "../../modules/agent-door/index.ts";
import type { Bindings } from "../../auth.server";
import { ChestError, type Row } from "../model";
import { context, demand, who, type Ctx, type Action } from "../files/access";
import { resource, spend } from "../integrations/auth";
import type { Action as IntegrationAction } from "../integrations/model";
import { commit, fresh, maybe, withCommitAttachment } from "../files/repo";
import { agentSession } from "./identity.ts";
import { execute } from "../api";

export function publicRecord(row: Row<any>) {
  const p = row.payload;
  if (row.kind === "item")
    return {
      id: row.id,
      revision: row.revision,
      name: p.name,
      type: p.type,
      space: p.space,
      parent: p.parent,
      current: p.current,
      trash: p.trash,
      updatedAt: p.updatedAt,
      grants: p.grants,
      versions: p.versions.map(({ text, ...v }: any) => v),
      preparedBy: p.preparedBy ?? null,
    };
  if (row.kind === "space")
    return {
      id: row.id,
      revision: row.revision,
      name: p.name,
      kind: p.kind,
      owner: p.owner,
      members: p.members,
      settings: p.settings,
      preparedBy: p.preparedBy ?? null,
    };
  return { id: row.id, revision: row.revision, kind: row.kind };
}
export async function itemContext(
  env: Bindings,
  ctx: ToolContext,
  id: unknown,
  action: Action = "view",
  scope: IntegrationAction = "read",
): Promise<Ctx> {
  try {
    const { session, local } = await agentSession(env, ctx);
    const c = local
      ? await resource(env, { ...local, session }, String(id), scope)
      : await context(env, await who(env, session), String(id));
    demand(c, action);
    return c;
  } catch (error) {
    if (error instanceof ChestError && [403, 404].includes(error.status))
      throw new ToolRefusal("resource_unavailable");
    throw error;
  }
}
export async function nativeCall(
  env: Bindings,
  ctx: ToolContext,
  method: string,
  path: string,
  input: Record<string, unknown> = {},
  query: Record<string, unknown> = {},
) {
  const { session } = await agentSession(env, ctx),
    url = new URL(`/api/chest${path}`, env.AUTH_ORIGIN);
  for (const [k, v] of Object.entries(query))
    if (v !== undefined) url.searchParams.set(k, String(v));
  return execute(
    env,
    new Request(url, {
      method,
      headers: {
        origin: env.AUTH_ORIGIN,
        ...(typeof input.range === "string" ? { range: input.range } : {}),
      },
    }),
    session,
    method,
    path,
    input,
  );
}
// Keep the native effect and its once-only receipt in the same existing D1 batch.
// A lost door response can be recovered without replaying a native effect.
export async function mutation(
  env: Bindings,
  ctx: ToolContext,
  tool: string,
  path: string,
  input: Record<string, unknown>,
  kinds = ["item"],
): Promise<any> {
  const key = `agent-effect:${ctx.operationId}:${tool}`,
    prior = await maybe(env, "agent-effect", key);
  if (prior) return prior.payload.result;
  const { session, local } = await agentSession(env, ctx);
  const scoped = withCommitAttachment(session, {
    // Existing OAuth consumers reconcile this receipt through the native audit.
    // Publish it with the effect so retries and refusals cannot add a second one.
    audits: local ? [{ action: "integration.mutation", object: local.grant.id, detail: { receipt: key, path } }] : [],
    accept: (ops) => ops.some((o) => kinds.includes(o.row.kind)),
    ops: (ops) => {
      const rows = ops
          .filter((o) => kinds.includes(o.row.kind))
          .map((o) => publicRecord(o.row)),
        first = rows[0];
      const result = {
        ...first,
        records: rows,
        before: ops
          .filter((o) => kinds.includes(o.row.kind) && o.previous)
          .map((o) => publicRecord(o.previous!)),
      };
      const receipt = fresh(
        "agent-effect",
        {
          operation: ctx.operationId,
          agent: ctx.agent.id,
          sponsor: ctx.person.id,
          consent: ctx.consent ?? null,
          client: ctx.clientId ?? null,
          result,
        },
        key,
      );
      return [
        { row: receipt },
        ...(local
          ? [
              spend(local, {
                mutations: 1,
                bytes: ops
                  .filter((o) => o.row.kind === "item")
                  .reduce(
                    (n, o) =>
                      n +
                      (o.row.payload.versions ?? [])
                        .filter(
                          (v: any) =>
                            !o.previous?.payload.versions?.some(
                              (p: any) => p.id === v.id,
                            ),
                        )
                        .reduce((s: number, v: any) => s + v.size, 0),
                    0,
                  ),
              }),
            ]
          : []),
      ];
    },
  });
  const url = new URL(`/api/chest${path}`, env.AUTH_ORIGIN);
  const executed = await execute(
    env,
    new Request(url, { method: "POST", headers: { origin: env.AUTH_ORIGIN } }),
    scoped,
    "POST",
    path,
    input,
  );
  const saved = await maybe(env, "agent-effect", key);
  if (!saved) throw new ToolRefusal("native_effect_unconfirmed");
  return JSON.parse(
    JSON.stringify({
      ...saved.payload.result,
      preparedBy: ctx.actor,
      ...(tool === "links.create"
        ? { link: executed.link, url: executed.url }
        : {}),
      ...(tool === "requests.create"
        ? { request: executed.request, url: executed.url }
        : {}),
    }),
  );
}
