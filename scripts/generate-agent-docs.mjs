// The production registry and this manifest are compared by normal rer verify.
// Documentation uses that same schema/class/scope catalogue; no parallel tool list.
import { readFile, writeFile } from "node:fs/promises";
const surface = JSON.parse(await readFile("agent-surface.json", "utf8"));
const rows = [
  "# Chest agent catalogue",
  "",
  "Generated from `agent-surface.json`; normal `rer verify` requires it to equal the production registry. Do not edit this page by hand.",
  "",
  "See [Agent adoption and limits](agent-adoption.md) for the records-clerk jobs, native authority, capacity limits and undeclared work. Use `/mcp` or its `/mcp/chest` alias; policy, Pause and named approvals apply to every declared tool.",
  "",
  `Declared capabilities: ${surface.capabilities.map((name) => "`" + name + "`").join(", ")}. Events and subscriptions are unavailable and return \`capability_not_declared\`.`,
  "",
  "| Tool | Scope | Read only | Classes | Clauses |",
  "| --- | --- | --- | --- | --- |",
  ...surface.tools.map(
    (t) =>
      `| ${t.name} | ${t.scope} | ${t.readOnly} | ${t.classes.join(", ")} | ${t.clauses.join(", ")} |`,
  ),
  "",
  "## Resource templates",
  "",
  ...surface.resources.map(
    (r) =>
      `- \`${typeof r === "string" ? r : r.uriTemplate}\`: ${(r.classes ?? ["standard"]).join(", ")}.`,
  ),
  "",
  "## Tool schemas",
  "",
  ...surface.tools.flatMap((t) => [
    `### ${t.name}`,
    "",
    ...(t.inputSchema
      ? ["Input:", "", "```json", JSON.stringify(t.inputSchema, null, 2), "```", ""]
      : ["The built-in input schema is returned by MCP `tools/list`.", ""]),
    "The output schema is returned by MCP `tools/list`; normal `rer verify` validates each real result against it.",
    "",
  ]),
  "## Decisions and errors",
  "",
  'An unset, blocked, paused or revoked policy/identity has no effect. An approval hold returns the saved exact summary and a URL for a named person; an agent cannot approve it. Stable MCP error fields live at `_meta["com.runeditrun/error"]`. Native errors retain their symbolic code, including current role, download, app-policy, quarantine, source-pause and explicit-budget refusals. `self_escalation`, `approval_required`, `review_required`, `agents_paused`, `resource_unavailable`, stale revision and idempotency conflicts also refuse effects. Read content is untrusted.',
  "",
  "The core journey declares `spend:{none:true}`. Paid provider reservations, events, subscriptions, resource refresh, multi-sponsor journeys and new mail-event edges are undeclared. Native connector webhooks keep their separate purpose.",
  "",
];
const output = rows.join("\n");
if (process.argv.includes("--check")) {
  if ((await readFile("docs/agents.md", "utf8")) !== output)
    throw Error(
      "Agent docs are stale; run node scripts/generate-agent-docs.mjs",
    );
  console.log("Agent docs match the declared registry.");
} else {
  await writeFile("docs/agents.md", output);
  console.log("Agent docs generated.");
}
