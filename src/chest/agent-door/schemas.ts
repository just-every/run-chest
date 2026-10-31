import type {
  JsonSchema,
  JsonSchemaObject,
} from "../../modules/agent-door/index.ts";
export const text = { type: "string", maxLength: 1000 },
  id = { type: "string", minLength: 1, maxLength: 240 },
  bool = { type: "boolean" };
export const object = (
  properties: Record<string, JsonSchema> = {},
  required: string[] = [],
): JsonSchemaObject => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
export const result = { type: "object" };
export const target = object({ id }, ["id"]);
export const page = {
  parent: id,
  cursor: text,
  limit: { type: "integer", minimum: 1, maximum: 100 },
};
export const uri = (id: string) => `chest://item/${encodeURIComponent(id)}`;
