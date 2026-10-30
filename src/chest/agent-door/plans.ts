import {
  defineTool,
  ToolRefusal,
  type ToolContext,
  type ToolDefinition,
  type ClassAndFacts,
} from "../../modules/agent-door/index.ts";
import type { Bindings } from "../../auth.server";
import { get } from "../store";
import { place } from "../files/items";
import { who } from "../files/access";
import { agentSession, humanSession, type HumanSessions } from "./identity.ts";
import { execute } from "../api";
import { itemContext, mutation, nativeCall } from "./native.ts";
import { exposure, standard } from "./risk.ts";
import { object, id, text, bool, target, result } from "./schemas.ts";
import type { Batch } from "../filing/batch-model";
const listOfIds = { type: "array", items: id, minItems: 1, maxItems: 100 };
export function planTools(
  env: Bindings,
  humans: HumanSessions,
): ToolDefinition[] {
  async function batch(a: Record<string, unknown>, c: ToolContext) {
    const row = await get<Batch>(env, "filing_batch", String(a.id));
    if (row.payload.by !== c.person.email)
      throw new ToolRefusal("resource_unavailable");
    for (const item of row.payload.items)
      await itemContext(env, c, item.item, "manage");
    return row;
  }
  async function batchRisk(a: Record<string, unknown>, c: ToolContext) {
    const row = await batch(a, c),
      { session } = await agentSession(env, c);
    for (const item of row.payload.items) {
      const source = await itemContext(env, c, item.item, "manage"),
        dest = await place(
          env,
          await who(env, session),
          source.space.id,
          item.destination,
        ),
        risk = await exposure(env, dest);
      if (risk[0].class === "external") return risk;
    }
    return [
      {
        class: "standard",
        facts: {
          measure: row.payload.items.filter((i) => i.state === "ready").length,
        },
      },
    ] as ClassAndFacts[];
  }
  const specs: ToolDefinition[] = [
    defineTool({
      name: "chest.filing.propose",
      title: "Prepare a filing plan",
      description:
        "Preview native bounded rename, tag and move actions, retaining exact version/revision evidence. Paid model classification is unavailable until company spend reservations are enforced.",
      scope: "filing:write",
      readOnly: false,
      inputSchema: object(
        {
          items: listOfIds,
          actions: object({
            rename: text,
            tag: text,
            destination: { type: ["string", "null"] },
          }),
        },
        ["items", "actions"],
      ),
      outputSchema: result,
      classes: ["standard"],
      clauses: ["SURFACE-004", "AGENT-001", "RULE-001"],
      classify: async (a, c) => {
        for (const item of a.items as string[])
          await itemContext(env, c, item, "manage");
        return standard();
      },
      summary: async (a, c) => ({
        items: await Promise.all(
          (a.items as string[]).map(
            async (id) =>
              (await itemContext(env, c, id, "manage")).chain.at(-1)!.payload
                .name,
          ),
        ),
      }),
      async run(a, c) {
        return {
          result: await mutation(
            env,
            c,
            "filing.propose",
            "/filing/batches",
            a,
            ["filing_batch"],
          ),
        };
      },
    }),
    defineTool({
      name: "chest.filing.apply",
      title: "Apply an exact filing plan",
      description:
        "Apply the native plan under current grants, original versions and destination revisions. The native receipt retains each result and its real reversal.",
      scope: "filing:write",
      readOnly: false,
      inputSchema: target,
      outputSchema: result,
      classes: ["standard", "external"],
      clauses: ["SURFACE-004", "AGENT-001", "RULE-001"],
      classify: batchRisk,
      revisionType: "string",
      revision: async (a, c) => (await batch(a, c)).revision,
      target: async (a, c) => {
        const row = await batch(a, c);
        return { kind: row.kind, id: row.id };
      },
      summary: async (a, c) => {
        const row = await batch(a, c);
        return {
          target: { id: row.id, name: "Filing plan" },
          items: row.payload.items.map(
            (i) => `${i.name} → ${i.afterName} at ${i.path}`,
          ),
        };
      },
      async run(a, c) {
        await batch(a, c);
        await mutation(
          env,
          c,
          "filing.apply",
          `/filing/batches/${encodeURIComponent(String(a.id))}/apply`,
          {},
          ["filing_batch"],
        );
        const current = await batch(a, c);
        return {
          result: {
            id: current.id,
            revision: current.revision,
            items: current.payload.items.map((i) => ({
              id: i.item,
              name: i.afterName,
              state: i.state,
              reason: i.reason ?? null,
            })),
          },
          undo: { id: current.id, revision: current.revision },
        };
      },
      async undo(value, c) {
        const saved = value as { id: string; revision: string },
          row = await get<Batch>(env, "filing_batch", saved.id);
        if (row.revision !== saved.revision)
          throw new ToolRefusal("filing_undo_stale");
        const session = await humanSession(env, c.person, humans),
          path = `/filing/batches/${encodeURIComponent(saved.id)}/undo`;
        await execute(
          env,
          new Request(new URL(`/api/chest${path}`, env.AUTH_ORIGIN), {
            method: "POST",
            headers: { origin: env.AUTH_ORIGIN },
          }),
          session,
          "POST",
          path,
          {},
        );
        const after = await get<Batch>(env, "filing_batch", saved.id);
        if (after.payload.items.some((i) => i.state === "applied"))
          throw new ToolRefusal("filing_undo_stale");
        c.emit("filing.undone", `chest://filing/${saved.id}`, { id: saved.id });
      },
    }),
    defineTool({
      name: "chest.duplicates.apply",
      title: "Merge a duplicate pair",
      description:
        "Merge only a native reconciled duplicate pair. Originals, grants and old references remain. Repointing references requires its separate native preview and is not performed by this call.",
      scope: "filing:write",
      readOnly: false,
      inputSchema: object({ keep: id, duplicate: id }, ["keep", "duplicate"]),
      outputSchema: result,
      classes: ["standard"],
      clauses: ["SURFACE-004", "AGENT-002"],
      classify: async (a, c) => {
        if (c.person.role !== "owner")
          throw new ToolRefusal("owner_approval_required");
        await itemContext(env, c, a.keep, "manage");
        await itemContext(env, c, a.duplicate, "manage");
        return standard();
      },
      revisionType: "string",
      revision: async (a, c) =>
        (await itemContext(env, c, a.keep, "manage")).chain.at(-1)!.revision,
      target: async (a, c) => {
        const row = (await itemContext(env, c, a.keep, "manage")).chain.at(-1)!;
        return { kind: row.kind, id: row.id };
      },
      summary: async (a, c) => ({
        items: await Promise.all(
          [a.keep, a.duplicate].map(
            async (id) =>
              (await itemContext(env, c, id, "manage")).chain.at(-1)!.payload
                .name,
          ),
        ),
      }),
      async run(a, c) {
        return {
          result: await mutation(
            env,
            c,
            "duplicates.apply",
            "/filing/duplicates/merge",
            a,
            ["duplicate_merge"],
          ),
        };
      },
    }),
    defineTool({
      name: "chest.rewind",
      title: "Preview or apply a native rewind",
      description:
        "Preview a native folder/space point-in-time rewind, then apply its exact native fingerprint. Grants are never restored and original versions remain retained.",
      scope: "items:manage",
      readOnly: false,
      inputSchema: object(
        {
          mode: { enum: ["preview", "apply"] },
          folder: id,
          space: id,
          at: text,
          fingerprint: text,
          items: listOfIds,
        },
        ["mode", "at"],
      ),
      outputSchema: result,
      classes: ["standard", "external"],
      clauses: ["SURFACE-005", "RECOVER-001", "ADMIN-006"],
      revisionType: "string",
      revision: async (a, c) =>
        String(
          (await nativeCall(env, c, "POST", "/rewind/preview", a)).fingerprint,
        ),
      target: async (a, c) => {
        await nativeCall(env, c, "POST", "/rewind/preview", a);
        return {
          kind: a.folder ? "item" : "space",
          id: String(a.folder ?? a.space),
        };
      },
      classify: async (a, c) => {
        const preview = await nativeCall(env, c, "POST", "/rewind/preview", a);
        if (a.mode === "apply") {
          const { session } = await agentSession(env, c),
            scope = await place(
              env,
              await who(env, session),
              a.space,
              a.folder,
            ),
            scopeRisk = await exposure(env, scope);
          if (scopeRisk[0].class === "external") return scopeRisk;
          for (const change of preview.changes) {
            const risk = await exposure(
              env,
              await itemContext(env, c, change.id, "manage"),
            );
            if (risk[0].class === "external") return risk;
          }
        }
        return standard();
      },
      summary: async (a, c) => {
        const preview = await nativeCall(env, c, "POST", "/rewind/preview", a);
        return {
          target: { id: String(a.folder ?? a.space), name: "Native rewind" },
          items: preview.changes.map(
            (i: any) => `${i.id}: ${i.kinds.join(", ")}`,
          ),
        };
      },
      async run(a, c) {
        return {
          result:
            a.mode === "preview"
              ? await nativeCall(env, c, "POST", "/rewind/preview", a)
              : await mutation(env, c, "rewind", "/rewind/apply", a, [
                  "rewind",
                ]),
        };
      },
    }),
  ];
  return specs;
}
