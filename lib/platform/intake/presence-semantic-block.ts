import { choice, object, text } from "../canonical/model";
import { readNativeComponent } from "./presence-native-component";

const layout = ["stack", "grid"] as const;
const listStyle = ["bullets", "steps"] as const;
const string = { type: "string" };
const record = (properties: object) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
export const semanticBlockSchema = record({
  version: { type: "integer", enum: [1] }, name: string, purpose: string,
  layout: { type: "string", enum: layout }, listStyle: { type: "string", enum: listStyle },
  groups: { type: "array", items: record({ heading: string, body: string, items: { type: "array", items: string } }) },
});

export function readSemanticBlock(value: unknown, normalizeProviderName = false) {
  if (value && typeof value === "object" && (value as { version?: unknown }).version === 2) return readNativeComponent(value, normalizeProviderName);
  const block = object(value, ["version", "name", "purpose", "layout", "listStyle", "groups"]);
  const supplied = text(block.name, 65);
  // Canonicalize a readable provider label without dropping punctuation or
  // accepting any new executable or markup-shaped input.
  const name = normalizeProviderName && /^[A-Za-z0-9]+(?:[ -][A-Za-z0-9]+)*$/u.test(supplied)
    ? supplied.toLowerCase().replaceAll(" ", "-") : supplied;
  if (block.version !== 1 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(name) ||
      !Array.isArray(block.groups) || !block.groups.length || Buffer.byteLength(JSON.stringify(block), "utf8") > 32_000) {
    throw Error("Semantic block contract refused");
  }
  return {
    version: 1 as const, name, purpose: text(block.purpose, 360), layout: choice(block.layout, layout),
    listStyle: choice(block.listStyle, listStyle),
    groups: block.groups.map(value => {
      const group = object(value, ["heading", "body", "items"]);
      if (!Array.isArray(group.items)) throw Error("Semantic block list refused");
      return { heading: text(group.heading, 240), body: text(group.body, 1500, true),
        items: group.items.map(item => text(item, 360)) };
    }),
  };
}

export type SemanticBlock = ReturnType<typeof readSemanticBlock>;
