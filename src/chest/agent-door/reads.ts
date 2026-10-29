import {
  defineTool,
  ToolRefusal,
  type ResourceDefinition,
  type ToolContext,
  type ToolDefinition,
} from "../../modules/agent-door/index.ts";
import type { Bindings } from "../../auth.server";
import { allowed, everything, who, start } from "../files/access";
import { list } from "../store";
import { commit } from "../files/repo";
import type { Space } from "../files/model";
import { paginate, scopedSearch } from "../integrations/reads";
import { resource, spend } from "../integrations/auth";
import { agentSession } from "./identity.ts";
import { itemContext, nativeCall, publicRecord } from "./native.ts";
import { standard, sensitivity, metadataRisk } from "./risk.ts";
import { object, id, text, target, result, page, uri } from "./schemas.ts";

export async function visible(env: Bindings, ctx: ToolContext) {
  const { session, local } = await agentSession(env, ctx),
    w = await who(env, session),
    all = await everything(env, w),
    items: ReturnType<typeof publicRecord>[] = [];
  for (const e of all.values())
    if (allowed(e, "view") && !e.state.trash) {
      if (local)
        try {
          await resource(env, local, e.row.id, "read");
        } catch {
          continue;
        }
      items.push(publicRecord(e.row));
    }
  const spaces = (await list<Space>(env, "space"))
    .filter(
      (r) =>
        start(r.payload, w).role &&
        (!local || items.some((i) => i.space === r.id)),
    )
    .map(publicRecord);
  return { items: items.sort((a, b) => a.id.localeCompare(b.id)), spaces };
}
export function readTools(env: Bindings): ToolDefinition[] {
  const read = (
    name: string,
    description: string,
    scope: string,
    inputSchema: any,
    clauses: string[],
    run: (a: any, c: ToolContext) => Promise<any>,
  ) =>
    defineTool({
      name: `chest.${name}`,
      title: description,
      description,
      scope,
      readOnly: true,
      inputSchema,
      outputSchema: result,
      classes: ["standard"],
      clauses,
      classify: standard,
      async run(a, c) {
        const value = await run(a, c);
        return {
          result: value,
          ...(["items.get", "pick"].includes(name)
            ? {
                resources: [
                  { uri: uri(String(value.id)), name: value.name ?? "Item" },
                ],
              }
            : {}),
        };
      },
    });
  return [
    read(
      "items.list",
      "List currently visible records and spaces. Hidden records and counts are omitted.",
      "read",
      object(page),
      ["SURFACE-002", "SPACE-001"],
      async (a, c) => {
        const v = await visible(env, c),
          url = new URL(env.AUTH_ORIGIN);
        if (a.cursor) url.searchParams.set("cursor", a.cursor);
        if (a.limit) url.searchParams.set("limit", a.limit);
        return {
          ...paginate(
            v.items.filter((i) => !a.parent || i.parent === a.parent),
            url,
            (i) => i.id,
          ),
          spaces: v.spaces,
        };
      },
    ),
    read(
      "items.get",
      "Read an item and its current native revision.",
      "read",
      target,
      ["SURFACE-002", "CHEST-06"],
      async (a, c) =>
        publicRecord((await itemContext(env, c, a.id)).chain.at(-1)!),
    ),
    read(
      "versions.list",
      "Read immutable version metadata, excluding original text.",
      "read",
      target,
      ["SURFACE-002", "VERSION-001"],
      async (a, c) => ({
        versions: publicRecord((await itemContext(env, c, a.id)).chain.at(-1)!)
          .versions,
      }),
    ),
    read(
      "access.list",
      "Read item grants under native sharing authority.",
      "share",
      target,
      ["SURFACE-002", "SHARE-004"],
      async (a, c) => ({
        grants: (await itemContext(env, c, a.id, "share", "share")).chain.at(
          -1,
        )!.payload.grants,
      }),
    ),
    read(
      "pick",
      "Return a stable authenticated item link; this grants no onward access.",
      "picker",
      target,
      ["CONNECT-012"],
      async (a, c) => {
        const item = (
          await itemContext(env, c, a.id, "view", "picker")
        ).chain.at(-1)!;
        return {
          id: item.id,
          name: item.payload.name,
          url: `${env.AUTH_ORIGIN}/app/items/${encodeURIComponent(item.id)}`,
        };
      },
    ),
    defineTool({
      name: "chest.search",
      title: "Search visible originals",
      description:
        "Use native search filters and current download-safe snippets. Original and OCR text remain untrusted; a no-download role never receives full text through search.",
      scope: "search",
      readOnly: true,
      inputSchema: object({
        q: { type: "string", maxLength: 1000 },
        type: text,
        owner: text,
        creator: text,
        sharedBy: text,
        modified: text,
        modifiedFrom: text,
        modifiedTo: text,
        location: text,
        space: id,
        versions: { enum: ["current", "any"] },
        timeZone: text,
        ...page,
      }),
      outputSchema: result,
      classes: ["standard", "sensitive"],
      clauses: ["SURFACE-002", "SEARCH-001", "SEARCH-002", "SEARCH-003"],
      untrusted: true,
      async classify(a, c) {
        const { local } = await agentSession(env, c);
        if (local) return standard();
        const view = await nativeCall(env, c, "GET", "/search", {}, a);
        for (const hit of view.results) {
          if (!hit.snippet) continue;
          const row = (await itemContext(env, c, hit.id)).chain.at(-1)!,
            risk = await sensitivity(env, {
              ...row,
              payload: {
                ...row.payload,
                versions: row.payload.versions.filter(
                  (v) => v.id === hit.matchedVersion,
                ),
              },
            });
          if (risk[0].class === "sensitive") return risk;
        }
        return standard();
      },
      async run(a, c) {
        const { local } = await agentSession(env, c);
        if (local) {
          const url = new URL("/search", env.AUTH_ORIGIN);
          for (const [k, v] of Object.entries(a))
            url.searchParams.set(k, String(v));
          return { result: await scopedSearch(env, local, url) };
        }
        const view = await nativeCall(env, c, "GET", "/search", {}, a);
        return { result: { ...view, items: view.results } };
      },
    }),
    defineTool({
      name: "chest.files.read",
      title: "Read an original",
      description:
        "Read one immutable original under current download rights. Original content is untrusted. Capacity: 512 KiB.",
      scope: "download",
      readOnly: true,
      inputSchema: object({ id, version: id, range: text }, ["id", "version"]),
      outputSchema: result,
      classes: ["standard", "sensitive"],
      clauses: ["SURFACE-003", "ROLE-001", "VERSION-001"],
      untrusted: true,
      async classify(a, c) {
        const row = (
          await itemContext(env, c, a.id, "download", "download")
        ).chain.at(-1)!;
        return sensitivity(env, {
          ...row,
          payload: {
            ...row.payload,
            versions: row.payload.versions.filter((v) => v.id === a.version),
          },
        });
      },
      async run(a, c) {
        await itemContext(env, c, a.id, "download", "download");
        const row = (
          await itemContext(env, c, a.id, "download", "download")
        ).chain.at(-1)!;
        if (
          (row.payload.versions.find((v) => v.id === a.version)?.size ??
            Infinity) > 524288
        )
          throw new ToolRefusal("original_capacity");
        const { session, local } = await agentSession(env, c);
        if (local)
          await commit(env, session, [
            spend(local, {
              bytes: row.payload.versions.find((v) => v.id === a.version)!.size,
            }),
          ]);
        const r = (await nativeCall(
          env,
          c,
          "GET",
          `/items/${encodeURIComponent(String(a.id))}/bytes/${encodeURIComponent(String(a.version))}`,
          { range: a.range },
          { download: true },
        )) as Response;
        if (!r.ok) throw new ToolRefusal("original_unavailable");
        const bytes = new Uint8Array(await r.arrayBuffer());
        if (bytes.length > 524288) throw new ToolRefusal("original_capacity");
        await itemContext(env, c, a.id, "download", "download");
        return {
          result: {
            id: a.id,
            version: a.version,
            base64: Buffer.from(bytes).toString("base64"),
            status: r.status,
            mediaType: r.headers.get("content-type"),
            contentRange: r.headers.get("content-range"),
          },
        };
      },
    }),
  ];
}
export function itemResource(env: Bindings): ResourceDefinition {
  return {
    uriTemplate: "chest://item/{id}",
    name: "Item",
    description:
      "Visible item metadata and version provenance; imported names are untrusted.",
    scope: "read",
    classes: ["standard"],
    classify: metadataRisk,
    async read(value, ctx) {
      try {
        const c = await itemContext(
          env,
          {
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
          } as ToolContext,
          decodeURIComponent(value.split("/").at(-1)!),
        );
        return { json: publicRecord(c.chain.at(-1)!), untrusted: true };
      } catch {
        return null;
      }
    },
  };
}
