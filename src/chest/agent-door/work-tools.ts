import {
  defineTool,
  ToolRefusal,
  type ToolContext,
  type ToolDefinition,
  type ClassAndFacts,
} from "../../modules/agent-door/index.ts";
import type { Bindings } from "../../auth.server";
import { get, list } from "../store";
import { maybe } from "../files/repo";
import { who } from "../files/access";
import { devices } from "../files/devices";
import { requestsOn } from "../files/file-requests";
import { history } from "../audit/history";
import { requireAdmin } from "../administration/roles";
import { scanLinks } from "../filing/link-scan";
import { archiveAction } from "../archive";
import { agentSession } from "./identity.ts";
import { itemContext, mutation, nativeCall } from "./native.ts";
import { standard, exposure } from "./risk.ts";
import { object, id, text, bool, target, result } from "./schemas.ts";

type Spec = {
  name: string;
  scope: string;
  schema: any;
  clauses: string[];
  classes?: ToolDefinition["classes"];
  readOnly?: boolean;
  records?: string[];
  load?: (a: any, c: ToolContext) => Promise<any>;
  run?: (a: any, c: ToolContext) => Promise<any>;
  path?: (a: any) => string;
  input?: (a: any, c: ToolContext) => any;
  classify?: (a: any, c: ToolContext) => Promise<ClassAndFacts[]>;
  authority?: ToolDefinition["authority"];
  widens?: false;
  narrowing?: { effect: "revoke"; target: string };
  sponsorEscalation?: boolean;
};
export function workTools(env: Bindings): ToolDefinition[] {
  const specs: Spec[] = [
    {
      name: "activity.list",
      scope: "read",
      readOnly: true,
      schema: target,
      clauses: ["SURFACE-002", "AUDIT-001"],
      run: async (a, c) => {
        await itemContext(env, c, a.id);
        const { session } = await agentSession(env, c);
        const rows = await history(env, session, new URLSearchParams(), 300);
        return { items: rows.rows.filter((r: any) => r.object_id === a.id) };
      },
    },
    {
      name: "requests.list",
      scope: "request",
      readOnly: true,
      schema: target,
      clauses: ["SURFACE-002", "SHARE-002"],
      run: async (a, c) => {
        await itemContext(env, c, a.id, "share", "request");
        return {
          requests: (await requestsOn(env, a.id)).map(
            ({ message, submissions, ...r }: any) => r,
          ),
        };
      },
    },
    {
      name: "reports.get",
      scope: "reports:read",
      readOnly: true,
      schema: object(
        {
          kind: {
            enum: [
              "storage",
              "audit",
              "guests",
              "provider-usage",
              "egress",
              "editor-report",
            ],
          },
        },
        ["kind"],
      ),
      clauses: ["SURFACE-002", "QUOTA-001", "ADMIN-002", "ADMIN-005"],
      run: (a, c) => nativeCall(env, c, "GET", `/administration/${a.kind}`),
    },
    {
      name: "exposure.list",
      scope: "share",
      readOnly: true,
      schema: object(
        { id, intended: { type: "array", items: text, maxItems: 100 } },
        ["id"],
      ),
      clauses: ["SURFACE-002", "SHARE-007", "AGENT-005"],
      run: async (a, c) => {
        await itemContext(env, c, a.id, "share", "share");
        const { session } = await agentSession(env, c);
        const { fences, ...view } = await scanLinks(
          env,
          await who(env, session),
          a.id,
          a.intended ?? [],
        );
        return view;
      },
    },
    {
      name: "devices.list",
      scope: "devices:read",
      readOnly: true,
      schema: object({ id, active: bool }),
      clauses: ["SURFACE-009", "SYNC-003"],
      run: async (a, c) => {
        const { session } = await agentSession(env, c);
        const all = (await devices(env, session)).filter(
          (d) => !a.id || d.id === a.id,
        );
        return {
          devices: all.filter((d) => !a.active || !d.revokedAt),
          grants: all.filter((d) => !d.revokedAt).map((d) => `device:${d.id}`),
        };
      },
    },
    {
      name: "movein.status",
      scope: "import:read",
      readOnly: true,
      schema: object({ id }),
      clauses: ["SURFACE-002", "MIGRATE-001", "AGENT-006", "CHEST-11"],
      run: async (a, c) => {
        const { session } = await agentSession(env, c);
        if (session.operator.role !== "owner")
          throw new ToolRefusal("resource_unavailable");
        if (!a.id)
          return {
            jobs: (
              await env.DB.prepare(
                "SELECT id,state,checkpoint,total FROM ik_jobs WHERE destination='library' AND namespace='chest-archive-v1' AND principal_id=? ORDER BY id",
              )
                .bind(session.operator.email)
                .all()
            ).results,
          };
        const job = await archiveAction(env, session, a.id, "status");
        return {
          id: a.id,
          status: (job as any).status,
          phase: (job as any).phase,
          counts: (job as any).counts,
        };
      },
    },
    {
      name: "duplicates.propose",
      scope: "filing:read",
      readOnly: true,
      schema: object({ space: id, parent: id }),
      clauses: ["AGENT-002", "SURFACE-004"],
      run: (a, c) => nativeCall(env, c, "GET", "/filing/duplicates", {}, a),
    },
    {
      name: "devices.revoke",
      scope: "devices:write",
      schema: target,
      clauses: ["SURFACE-009", "SYNC-003"],
      classes: ["access"],
      records: ["device"],
      widens: false,
      narrowing: { effect: "revoke", target: "id" },
      load: async (a, c) => {
        const { session } = await agentSession(env, c);
        if (!(await devices(env, session)).some((d) => d.id === a.id))
          throw new ToolRefusal("resource_unavailable");
        return get<any>(env, "device", a.id);
      },
      path: (a) => `/devices/${encodeURIComponent(a.id)}/revoke`,
      classify: async () => [
        { class: "access", facts: { measure: 1, direction: "narrows" } },
      ],
      authority: async (a, c) => {
        const row = await get<any>(env, "device", String(a.id));
        return { subject: row.payload.owner, widens: false };
      },
    },
    {
      name: "limits.set",
      scope: "settings:write",
      schema: object(
        { id, storageLimitBytes: { type: ["integer", "null"], minimum: 0 } },
        ["id", "storageLimitBytes"],
      ),
      clauses: ["SURFACE-010", "QUOTA-001"],
      records: ["space", "quota-rule"],
      load: async (a, c) => {
        const row = await get<any>(env, "space", a.id),
          { session } = await agentSession(env, c);
        await requireAdmin(
          env,
          session,
          "service-settings",
          row.payload.owner || row.payload.createdBy,
        );
        return row;
      },
      path: (a) => `/spaces/${encodeURIComponent(a.id)}/quota`,
    },
    {
      name: "settings.update",
      scope: "settings:write",
      schema: object(
        {
          allowPublic: bool,
          allowExternal: bool,
          allowOrganisation: bool,
          allowDiscovery: bool,
          defaultAudience: { enum: ["restricted", "organisation", "public"] },
          defaultRole: { enum: ["viewer", "commenter", "editor"] },
          warnExternal: bool,
          organizationDomains: {
            type: "array",
            items: text,
            minItems: 1,
            maxItems: 50,
          },
        },
        [
          "allowPublic",
          "allowExternal",
          "allowOrganisation",
          "allowDiscovery",
          "defaultAudience",
          "defaultRole",
          "organizationDomains",
        ],
      ),
      clauses: ["SURFACE-010", "POLICY-001", "POLICY-002"],
      classes: ["security"],
      sponsorEscalation: false,
      records: ["link-policy"],
      load: async (_a, c) => {
        const { session } = await agentSession(env, c);
        await requireAdmin(env, session, "sharing-security");
        return maybe(env, "link-policy", "link-policy:organisation");
      },
      path: () => "/link-policy",
      input: (a) => ({ ...a, scope: "organisation" }),
      classify: async () => [
        { class: "security", facts: { measure: 1, setting: "sharing-policy" } },
      ],
      authority: async (a) => {
        const old = await maybe<any>(
          env,
          "link-policy",
          "link-policy:organisation",
        );
        return {
          subject: "link-policy:organisation",
          widens:
            !!old &&
            [
              "allowPublic",
              "allowExternal",
              "allowOrganisation",
              "allowDiscovery",
            ].some((k) => a[k] === true && old.payload[k] === false),
        };
      },
    },
    {
      name: "decisions.record",
      scope: "decisions:write",
      schema: object(
        {
          id,
          action: { enum: ["assign", "approve", "changes"] },
          reviewer: id,
          version: id,
          message: text,
        },
        ["id", "action"],
      ),
      clauses: ["SURFACE-011", "CHEST-08"],
      classes: ["standard", "commitment"],
      load: async (a, c) =>
        (
          await itemContext(
            env,
            c,
            a.id,
            a.action === "assign" ? "administer" : "view",
          )
        ).chain.at(-1)!,
      path: (a) =>
        a.action === "assign"
          ? `/items/${encodeURIComponent(a.id)}/governance`
          : `/items/${encodeURIComponent(a.id)}/versions/${encodeURIComponent(a.version)}/review`,
      classify: async (a, c) => {
        const row = (await itemContext(env, c, a.id)).chain.at(-1)!;
        if (a.action !== "approve") return standard();
        const v = row.payload.versions.find((v) => v.id === a.version);
        if (!v) throw new ToolRefusal("resource_unavailable");
        const money = [
          ...v.text.matchAll(/\b(USD|EUR|GBP)\s+(\d+(?:\.\d{1,2})?)\b/g),
        ];
        if (/[$€£]/.test(v.text) && !money.length)
          throw new ToolRefusal("commitment_value_unavailable");
        const currencies = new Set(money.map((m) => m[1]));
        if (currencies.size > 1)
          throw new ToolRefusal("commitment_value_unavailable");
        return [
          {
            class: "commitment",
            facts: {
              measure: money.length
                ? Math.round(Math.max(...money.map((m) => Number(m[2]))) * 100)
                : 0,
              currency: money[0]?.[1] ?? "XXX",
              counterparty: "internal",
            },
          },
        ];
      },
    },
  ];
  return specs.map((spec) => {
    const tool: ToolDefinition = {
      name: `chest.${spec.name}`,
      title: spec.name.replaceAll(".", " "),
      description: `Native Chest ${spec.name}; the sponsor's current roles, grants and native refusals apply.`,
      scope: spec.scope,
      readOnly: !!spec.readOnly,
      inputSchema: spec.schema,
      outputSchema: result,
      classes: spec.classes ?? ["standard"],
      clauses: spec.clauses,
      untrusted: !!spec.readOnly,
      classify: async (a, c) => {
        if (spec.load) await spec.load(a, c);
        return spec.classify ? spec.classify(a, c) : standard();
      },
      async run(a, c) {
        if (spec.load) await spec.load(a, c);
        if (spec.run) {
          const output = await spec.run(a, c);
          return { result: Array.isArray(output) ? { items: output } : output };
        }
        const output = await mutation(
          env,
          c,
          spec.name,
          spec.path!(a),
          spec.input ? spec.input(a, c) : a,
          spec.records,
        );
        return { result: output };
      },
    };
    if (!spec.readOnly) {
      tool.summary = async (a, c) => {
        const row = await spec.load?.(a, c);
        return {
          target: {
            ...(row ? { id: row.id } : {}),
            name:
              row?.payload.name ??
              String(a.id ?? "Installation sharing policy"),
          },
          items: [
            JSON.stringify(
              Object.fromEntries(
                Object.entries(a).filter(
                  ([key]) =>
                    !["idempotency_key", "expected_revision"].includes(key),
                ),
              ),
            ),
          ],
          ...(a.reviewer ? { recipients: [String(a.reviewer)] } : {}),
        };
      };
      if (spec.load) {
        tool.revisionType = "string";
        tool.revision = async (a, c) =>
          (await spec.load!(a, c))?.revision ?? null;
        tool.target = async (a, c) => {
          const row = await spec.load!(a, c);
          return row ? { kind: row.kind, id: row.id } : null;
        };
      }
    }
    if (spec.authority) tool.authority = spec.authority;
    if (spec.widens === false) {
      tool.widens = false;
      tool.narrowing = spec.narrowing;
    }
    return defineTool(tool);
  });
}
