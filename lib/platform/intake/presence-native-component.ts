import { choice, object, text } from "../canonical/model";

const kinds = ["group", "heading", "paragraph", "list", "image", "action", "separator", "details"] as const;
const arrangements = ["flow", "row", "columns"] as const;
const surfaces = ["none", "light", "brand", "tonal", "strong"] as const;
const sizes = ["none", "small", "medium", "large"] as const;
const alignments = ["start", "center", "end", "stretch"] as const;
const nullableText = { type: ["string", "null"] };
const shape = <P extends Record<string, unknown>>(properties: P) => ({ type: "object", properties,
  required: Object.keys(properties), additionalProperties: false });
const options = (values: readonly string[]) => ({ type: "string", enum: values });

const layoutFields = { gap: options(sizes), inset: options(sizes), surface: options(surfaces), align: options(alignments),
  measure: options(["narrow", "reading", "wide", "full"]), typeScale: options(["small", "body", "lead", "display"]),
  span: { type: "integer", minimum: 1, maximum: 12 }, mobileOrder: { type: "integer", enum: [0] },
  border: { type: "boolean" }, rounded: { type: "boolean" } };
/** The wire enforces kind-specific structure, rather than inviting output the compiler must reject. */
export const nativeComponentSchema = {
  ...shape({ version: { type: "integer", enum: [2] }, name: { type: "string" }, purpose: { type: "string" },
    mode: options(["supplement", "section"]), root: { $ref: "#/$defs/nativeNode" } }),
  $defs: {
    nativeLayout: { anyOf: [
      shape({ arrangement: options(["flow", "row"]), columns: { type: "array", items: { type: "number" }, maxItems: 0 }, ...layoutFields }),
      shape({ arrangement: options(["columns"]), columns: { type: "array", items: { type: "number", exclusiveMinimum: 0, maximum: 12 }, minItems: 2, maxItems: 12 }, ...layoutFields }),
    ] },
    nativeNode: { anyOf: kinds.map(kind => shape({
      kind: options([kind]),
      text: ["heading", "paragraph", "details"].includes(kind) ? { type: "string" }
        : ["action", "image", "list"].includes(kind) ? nullableText : { type: "null" },
      level: kind === "heading" ? { type: "integer", enum: [1, 2, 3, 4, 5, 6] } : { type: "null" },
      items: { type: "array", items: { type: "string" }, ...(kind === "list" ? { minItems: 1 } : { maxItems: 0 }) },
      ordered: { type: "boolean" },
      reference: ["image", "action"].includes(kind) ? { type: "string", pattern: kind === "image" ? "^section-(0|[1-9][0-9]*)$" : "^action-(0|[1-9][0-9]*)$" } : { type: "null" },
      layout: { $ref: "#/$defs/nativeLayout" },
      children: { type: "array", items: { $ref: "#/$defs/nativeNode" }, ...(["group", "details"].includes(kind) ? { minItems: 1 } : { maxItems: 0 }) },
    })) },
  },
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

/** Provider Page recovery: Action text duplicates the already supplied Page Action.
 * Bind only absent text to its exact index; never infer a destination or rewrite copy. */
export function bindNativeActionLabels(value: unknown, actions: unknown): unknown {
  if (!value || typeof value !== "object" || (value as {version?:unknown}).version !== 2) return value;
  const result = structuredClone(value);
  function visit(value:unknown,depth=0) {
    if (!value || typeof value !== "object" || depth>24) return;
    const node=value as {kind?:unknown;text?:unknown;reference?:unknown;children?:unknown};
    if(node.kind==="action"&&node.text===null){
      if(typeof node.reference!=="string"||!/^action-(0|[1-9][0-9]*)$/.test(node.reference)||!Array.isArray(actions))
        throw Error("Native Action label requires an exact Page Action");
      const action=actions[Number(node.reference.slice(7))];
      if(!action||typeof action.label!=="string"||!action.label.trim())throw Error("Native Action label requires an exact Page Action");
      node.text=action.label;
    }
    if(Array.isArray(node.children))node.children.forEach(child=>visit(child,depth+1));
  }
  visit((result as {root?:unknown}).root);
  return result;
}

/** Keep an empty disclosure's exact visible text, without manufacturing an answer or empty interactive control. */
export function recoverProviderNativeComponent(value:unknown,actions:unknown):unknown {
  const result=bindNativeActionLabels(value,actions);
  if(!result||typeof result!=="object"||(result as {version?:unknown}).version!==2)return result;
  function visit(value:unknown,depth=0) {
    if(!value||typeof value!=="object"||depth>24)return;
    const n=value as {kind?:unknown;text?:unknown;level?:unknown;reference?:unknown;items?:unknown;children?:unknown};
    if(n.kind==="details"&&Array.isArray(n.children)&&n.children.length===0&&Array.isArray(n.items)&&n.items.length===0&&
       n.level===null&&n.reference===null&&typeof n.text==="string"&&n.text.trim())n.kind="paragraph";
    if(Array.isArray(n.children))n.children.forEach(child=>visit(child,depth+1));
  }
  visit((result as {root?:unknown}).root);
  return result;
}
