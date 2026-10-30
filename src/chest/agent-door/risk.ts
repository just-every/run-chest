import { officePreview } from "../office/codec";
import { plainText } from "../signatures/pdf-tools";
import { maybe } from "../files/repo";
import type {
  ClassAndFacts,
  ToolContext,
} from "../../modules/agent-door/index.ts";
import type { Bindings } from "../../auth.server";
import { list } from "../store";
import { context, allowed, whoFor, start, type Ctx } from "../files/access";
import { effectiveLinkPolicy } from "../files/link-policy";
import { scanRecord } from "../content-security/scan";
import type { Group, Row } from "../model";
import type { Item, PublicLink } from "../files/model";
export const standard = (): ClassAndFacts[] => [
  { class: "standard", facts: { measure: 1 } },
];
// Resources expose native metadata only, never original or OCR content.
// Derive the measure from the actual sanitized record returned by native visibility.
export function metadataRisk(record: {
  json?: unknown;
  text?: string;
}): ClassAndFacts[] {
  const value = record.json;
  return [
    {
      class: "standard",
      facts: {
        measure: Array.isArray(value)
          ? value.length
          : value && typeof value === "object"
            ? 1
            : 0,
      },
    },
  ];
}
export async function sensitivity(
  env: Bindings,
  row: Row<Item>,
): Promise<ClassAndFacts[]> {
  for (const v of row.payload.versions) {
    const scan = await scanRecord(env, v.checksum);
    let source =
      v.text ||
      (await maybe<any>(env, "extract", `extract:${v.checksum}`))?.payload
        .text ||
      "";
    if (
      !source &&
      v.size <= 8_000_000 &&
      (v.mediaType === "application/pdf" ||
        /\.(docx|xlsx|pptx)$/i.test(v.filename))
    ) {
      const blob = await env.BLOBS.get(`sha256/${v.checksum}`);
      if (blob) {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        source =
          v.mediaType === "application/pdf"
            ? await plainText(bytes).catch(() => "")
            : ((await officePreview(bytes))?.text ?? "");
      }
    }
    if (
      scan?.payload.sensitive ||
      /\b\d{3}-\d{2}-\d{4}\b|\b\d{2}-\d{7}\b|\b(?:bank|account|routing|tax|passport)\s*(?:number|no\.?|#|:)\s*\d{6,}\b/i.test(
        source,
      )
    )
      return [{ class: "sensitive", facts: { measure: 1, kind: "document" } }];
  }
  return standard();
}
export async function recipientRisk(
  env: Bindings,
  c: Ctx,
  principals: string[],
): Promise<ClassAndFacts[]> {
  const groups = await list<Group>(env, "group"),
    emails = [
      ...new Set(
        principals.flatMap((p) =>
          p.includes("@")
            ? [p]
            : (groups.find((g) => g.id === p)?.payload.members ?? []),
        ),
      ),
    ];
  const rules = (await effectiveLinkPolicy(env, { groups: [] }, c.space.id))
    .rules;
  const external = emails.filter(
    (e) => !rules.organizationDomains.includes(e.split("@")[1]),
  );
  return external.length
    ? [
        {
          class: "external",
          facts: {
            measure: external.length,
            counterparty: external.every((e) =>
              rules.trustedDomains?.includes(e.split("@")[1]),
            )
              ? "known"
              : "new",
          },
        },
      ]
    : standard();
}
export async function exposure(
  env: Bindings,
  c: Ctx,
): Promise<ClassAndFacts[]> {
  const ids = new Set(c.chain.map((r) => r.id)),
    links = await list<PublicLink>(env, "public-link");
  if (
    links.some(
      (r) =>
        ids.has(r.payload.item) &&
        !r.payload.revokedAt &&
        (!r.payload.expires || Date.parse(r.payload.expires) > Date.now()) &&
        r.payload.versionMode !== "pinned" &&
        !r.payload.snapshot,
    )
  )
    return [
      { class: "external", facts: { measure: 1, counterparty: "public" } },
    ];
  const people = (
    await env.DB.prepare(
      "SELECT email FROM oa_operators WHERE status='active'",
    ).all<{ email: string }>()
  ).results;
  const outsiders: string[] = [];
  const domains = (await effectiveLinkPolicy(env, { groups: [] }, c.space.id))
    .rules.organizationDomains;
  for (const { email } of people)
    if (!domains.includes(email.split("@")[1])) {
      try {
        const who = await whoFor(env, email);
        if (!c.chain.length) {
          if (start(c.space.payload, who).role) outsiders.push(email);
          continue;
        }
        const other = await context(env, who, c.chain.at(-1)!.id);
        if (
          allowed(other, "view") &&
          (!other.state.trash || other.state.trash.id === c.state.trash?.id)
        )
          outsiders.push(email);
      } catch {}
    }
  return recipientRisk(env, c, outsiders);
}
