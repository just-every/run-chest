import type {
  ResourceContext,
  ResourceDefinition,
  ToolContext,
} from "../../modules/agent-door/index.ts";
import type { Bindings } from "../../auth.server";
import { get, list } from "../store";
import { maybe } from "../files/repo";
import { start, who } from "../files/access";
import { devices } from "../files/devices";
import { describeRequest } from "../files/file-requests";
import { describeMemberLink } from "../files/links";
import type { Item, Space } from "../files/model";
import { agentSession } from "./identity.ts";
import { itemContext, publicRecord } from "./native.ts";
import { metadataRisk } from "./risk.ts";
const toolContext = (env: Bindings, ctx: ResourceContext): ToolContext => ({
  ...ctx,
  actor: {
    agent: ctx.agent,
    for: { id: ctx.person.id, name: ctx.person.name },
    label: `${ctx.agent.name} for ${ctx.person.name}`,
  },
  operationId: "resource",
  idempotencyKey: null,
  approvers: [],
  seed: "chest",
  origin: env.AUTH_ORIGIN,
  door: "mcp",
  now: Date.now,
  emit: () => {},
});
export function nativeResources(env: Bindings): ResourceDefinition[] {
  const resource = (
    uriTemplate: string,
    name: string,
    read: (uri: URL, ctx: ToolContext) => Promise<unknown>,
  ): ResourceDefinition => ({
    uriTemplate,
    name,
    scope: "read",
    classes: ["standard"],
    classify: metadataRisk,
    async read(value, ctx) {
      try {
        const json = await read(new URL(value), toolContext(env, ctx));
        return json ? { json, untrusted: true } : null;
      } catch {
        return null;
      }
    },
  });
  return [
    resource("chest://space/{id}", "Space", async (u, c) => {
      const id = decodeURIComponent(u.pathname.slice(1)),
        row = await get<Space>(env, "space", id),
        { session, local } = await agentSession(env, c);
      if (local || !start(row.payload, await who(env, session)).role)
        return null;
      return publicRecord(row);
    }),
    resource("chest://item/{id}/version/{n}", "Version", async (u, c) => {
      const [id, , version] = u.pathname
          .slice(1)
          .split("/")
          .map(decodeURIComponent),
        row = (await itemContext(env, c, id)).chain.at(-1)!,
        v = publicRecord(row).versions.find((v: any) => v.id === version);
      return v ?? null;
    }),
    resource("chest://request/{id}", "File request", async (u, c) => {
      const row = await get<any>(
        env,
        "file-request",
        decodeURIComponent(u.pathname.slice(1)),
      );
      await itemContext(env, c, row.payload.folder, "share", "request");
      return describeRequest(row);
    }),
    resource("chest://link/{id}", "Link", async (u, c) => {
      const id = decodeURIComponent(u.pathname.slice(1)),
        row =
          (await maybe<any>(env, "link", id)) ??
          (await get<any>(env, "public-link", id)),
        ctx = await itemContext(env, c, row.payload.item, "share", "share");
      return row.kind === "link"
        ? describeMemberLink(env, row, ctx.space.id)
        : {
            id: row.id,
            item: row.payload.item,
            audience: row.payload.audience,
            expires: row.payload.expires,
            revokedAt: row.payload.revokedAt ?? null,
            download: row.payload.download,
            versionMode: row.payload.versionMode,
          };
    }),
    resource("chest://device/{id}", "Device", async (u, c) => {
      if (!c.consent && c.clientId?.startsWith("token:")) return null;
      const { session } = await agentSession(env, c);
      return (
        (await devices(env, session)).find(
          (d) => d.id === decodeURIComponent(u.pathname.slice(1)),
        ) ?? null
      );
    }),
    resource("chest://approval/{id}", "Native version review", async (u, c) => {
      const version = decodeURIComponent(u.pathname.slice(1));
      for (const row of await list<Item>(env, "item")) {
        const v = row.payload.versions.find((v) => v.id === version);
        if (v?.review) {
          await itemContext(env, c, row.id);
          return { item: row.id, version, review: v.review };
        }
      }
      return null;
    }),
  ];
}
