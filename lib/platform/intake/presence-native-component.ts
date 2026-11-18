import { choice, object, text } from "../canonical/model";

const kinds = ["group", "heading", "paragraph", "list", "image", "action", "separator", "details"] as const;
const arrangements = ["flow", "row", "columns"] as const;
const surfaces = ["none", "light", "brand", "tonal", "strong"] as const;
const sizes = ["none", "small", "medium", "large"] as const;
const alignments = ["start", "center", "end", "stretch"] as const;
const nullableText = { type: ["string", "null"] };
const shape = (properties: Record<string, unknown>) => ({ type: "object", properties,
  required: Object.keys(properties), additionalProperties: false });
const options = (values: readonly string[]) => ({ type: "string", enum: values });

export const nativeComponentSchema = {
  ...shape({ version: { type: "integer", enum: [2] }, name: { type: "string" }, purpose: { type: "string" },
    mode: options(["supplement", "section"]), root: { $ref: "#/$defs/nativeNode" } }),
  $defs: { nativeNode: shape({
    kind: options(kinds), text: nullableText, level: { type: ["integer", "null"] },
    items: { type: "array", items: { type: "string" } }, ordered: { type: "boolean" },
    reference: nullableText,
    layout: shape({ arrangement: options(arrangements), columns: { type: "array", items: { type: "number" } },
      gap: options(sizes), inset: options(sizes), surface: options(surfaces), align: options(alignments),
      measure: options(["narrow", "reading", "wide", "full"]), typeScale: options(["small", "body", "lead", "display"]), span: { type: "integer" }, mobileOrder: { type: "integer" }, border: { type: "boolean" }, rounded: { type: "boolean" } }),
    children: { type: "array", items: { $ref: "#/$defs/nativeNode" } },
  }) },
};

export type NativeNode = {
  kind: typeof kinds[number]; text: string | null; level: number | null; items: string[]; ordered: boolean; reference: string | null;
  layout: { arrangement: typeof arrangements[number]; columns: number[]; gap: typeof sizes[number]; inset: typeof sizes[number];
    surface: typeof surfaces[number]; align: typeof alignments[number]; measure: "narrow" | "reading" | "wide" | "full"; typeScale: "small" | "body" | "lead" | "display"; span: number; mobileOrder: number; border: boolean; rounded: boolean };
  children: NativeNode[];
};
export type NativeComponent = { version: 2; name: string; purpose: string; mode: "supplement" | "section"; root: NativeNode };

function plain(value: unknown, empty = false) {
  const result = text(value, Infinity, empty);
  if (/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(result)) throw Error("Native component text refused");
  return result;
}

/** The model composes native block content. It supplies no executable code,
 * selectors, remote URLs or arbitrary CSS. Unknown recipes fail explicitly. */
export function assertNativeSection(component: NativeComponent, heading: string, role: string) {
  const headings: NativeNode[] = [];
  const visit = (node: NativeNode) => {
    if (node.kind === "heading") headings.push(node);
    node.children.forEach(visit);
  };
  visit(component.root);
  if (component.mode === "supplement") {
    if (headings.some(node => node.level === 1)) throw Error("Supporting component cannot introduce a Page title");
  } else {
    const level = role === "hero" ? 1 : 2;
    if (!headings.some(node => node.level === level && node.text === heading) ||
        (role === "hero" ? headings.filter(node => node.level === 1).length !== 1 : headings.some(node => node.level === 1))) {
      throw Error("Authored section must preserve its exact semantic heading");
    }
  }
}

export function readNativeComponent(value: unknown, normalizeProviderName = false): NativeComponent {
  const component = object(value, ["version", "name", "purpose", "mode", "root"]);
  const supplied = text(component.name, 65);
  const name = normalizeProviderName && /^[A-Za-z0-9]+(?:[ -][A-Za-z0-9]+)*$/u.test(supplied)
    ? supplied.toLowerCase().replaceAll(" ", "-") : supplied;
  if (component.version !== 2 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(name)) throw Error("Native component identity refused");
  function node(value: unknown, depth: number, insideDetails = false): NativeNode {
    if (depth > 24) throw Error("Native component nesting exceeds renderer safety");
    const row = object(value, ["kind", "text", "level", "items", "ordered", "reference", "layout", "children"]);
    const kind = choice(row.kind, kinds);
    const layout = object(row.layout, ["arrangement", "columns", "gap", "inset", "surface", "align", "measure", "typeScale", "span", "mobileOrder", "border", "rounded"]);
    if (!Array.isArray(row.children) || !Array.isArray(row.items) || typeof row.ordered !== "boolean" ||
        typeof layout.border !== "boolean" || typeof layout.rounded !== "boolean" ||
        !Array.isArray(layout.columns) || layout.columns.some(width => typeof width !== "number" || !Number.isFinite(width) || width <= 0 || width > 12) ||
        !Number.isSafeInteger(layout.span) || Number(layout.span) < 1 || Number(layout.span) > 12 ||
        !Number.isSafeInteger(layout.mobileOrder) || Number(layout.mobileOrder) !== 0) throw Error("Native component layout refused");
    const arrangement = choice(layout.arrangement, arrangements);
    if (arrangement === "columns" && (layout.columns.length < 2 || layout.columns.length > 12) ||
        arrangement !== "columns" && layout.columns.length ||
        !["group", "details"].includes(kind) && row.children.length ||
        kind === "group" && !row.children.length ||
        kind === "details" && (insideDetails || !row.children.length) ||
        kind !== "list" && row.items.length ||
        kind === "list" && !row.items.length) throw Error("Native component structure refused");
    const copy = row.text === null ? null : plain(row.text);
    const reference = row.reference === null ? null : text(row.reference, 160);
    if ((kind === "heading" ? !Number.isSafeInteger(row.level) || Number(row.level) < 1 || Number(row.level) > 6 : row.level !== null) ||
        (["heading", "paragraph", "action", "details"].includes(kind) ? !copy : ["image", "list"].includes(kind) ? false : copy !== null) ||
        (["image", "action"].includes(kind) ? !reference || !/^[a-zA-Z0-9][a-zA-Z0-9:_-]*$/u.test(reference) : reference !== null)) {
      throw Error("Native component content or reference refused");
    }
    return { kind, text: copy, reference, level: row.level as number | null, ordered: row.ordered,
      items: row.items.map(item => plain(item)),
      layout: { arrangement, columns: layout.columns as number[], gap: choice(layout.gap, sizes), inset: choice(layout.inset, sizes),
        surface: choice(layout.surface, surfaces), align: choice(layout.align, alignments),
        measure: choice(layout.measure, ["narrow", "reading", "wide", "full"] as const),
        typeScale: choice(layout.typeScale, ["small", "body", "lead", "display"] as const), span: Number(layout.span),
        mobileOrder: 0, border: layout.border, rounded: layout.rounded },
      children: row.children.map(child => node(child, depth + 1, insideDetails || kind === "details")) };
  }
  return { version: 2, name, purpose: plain(component.purpose), mode: choice(component.mode, ["supplement", "section"] as const), root: node(component.root, 0) };
}
