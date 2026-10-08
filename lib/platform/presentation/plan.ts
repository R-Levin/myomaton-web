import { exact, record, plain, valuePoints, relationship } from "./content";
import { validateFpo } from "./fpo";
import { resolveVisualPolicy } from "../policy/site-policy";

export const heroFamilies = ["orientation", "editorial-masthead", "service-value", "service-illustrated"] as const;
export const conversions = ["integrated-invitation", "focused-next-step", "closing-emphasis"] as const;
export const surfaces = ["light", "strong", "tonal", "brand", "supporting", "contrast"] as const;
export const recipes = {
  arrival: { hero: "service-value", conversion: "closing-emphasis", rhythm: "separated" },
  service: { hero: "orientation", conversion: "integrated-invitation", rhythm: "connected" },
  evidence: { hero: "editorial-masthead", conversion: "focused-next-step", rhythm: "separated" },
  assessment: { hero: "orientation", conversion: "focused-next-step", rhythm: "connected" },
  editorial: { hero: "editorial-masthead", conversion: "integrated-invitation", rhythm: "separated" },
} as const;
export const serviceLed = Object.freeze({ id: "service-led", version: 1, typography: "precise-sans", header: "brand-prominent", navigation: "commercial", footer: "service-led",
  heroes: ["orientation", "editorial-masthead", "service-value"], conversions, surfaces, recipeVersion: 1, compositionVersion: 1, hero: "editorial-masthead", conversion: "focused-next-step", rhythm: "separated",
  surfacePurposes: { proposition: "tonal", relationship: "strong", explanation: "light", evidence: "light", invitation: "light", closing: "brand" },
  measures: { prose: "62ch", support: "46ch" }, imagePolicy: "supporting-only", evidencePolicy: "text-led", fallbacks: { "service-value": "editorial-masthead", "editorial-masthead": "orientation" } } as const);
export type Selection = { grammar: "service-led" | "basic"; version: 1 | 2 | 3; diagnostics: string[]; motion: "off" | "minimal" };
export function validateDirection(input: unknown): Selection {
  const v = exact(input, ["contractVersion", "grammar", "preferences"]);
  const g = exact(v.grammar, ["id", "version"]);
  if (v.contractVersion !== 2 || g.id !== "service-led" || ![1, 2, 3].includes(Number(g.version)) || typeof g.version !== "number") throw Error("Unsupported presentation contract/grammar version");
  const p = v.preferences === undefined ? {} : exact(v.preferences, ["motion"]);
  if (p.motion !== undefined && !["off", "minimal"].includes(String(p.motion))) throw Error("Unsupported motion");
  return { grammar: "service-led", version: g.version as 1 | 2 | 3, diagnostics: [], motion: p.motion === "minimal" ? "minimal" : "off" };
}
export function readDirection(input: unknown, policy = resolveVisualPolicy()): Selection {
  try { const s = validateDirection(input); if (policy.maxMotion === "off" || !policy.allowedPreferences.includes("motion")) s.motion = "off"; return s; }
  catch (e) { return { grammar: "basic", version: 1, motion: "off", diagnostics: [String(e instanceof Error ? e.message : e)] }; }
}
type Section = { id: string; type: string; content: unknown; configuration: unknown; rawConfiguration?: unknown };
export type SectionPlan = { id: string; hero: typeof heroFamilies[number]; conversion: typeof conversions[number]; surface: typeof surfaces[number]; region: "connected" | "separated" | "emphasized" | "closing"; width: "reading" | "standard" | "wide"; alignment: "left" | "center"; spacing: "compact" | "normal" | "spacious"; divider: "none" | "rule" | "spacing" };
export type PresentationPlan = { selection: Selection; recipe: keyof typeof recipes | null; header: "compact" | "brand-prominent"; navigation: "quiet" | "commercial"; footer: "compact" | "service-led"; sections: SectionPlan[]; diagnostics: string[] };
function recipe(input: unknown): keyof typeof recipes | null {
  if (input === undefined) return null;
  const p = exact(input, ["recipe"]), r = exact(p.recipe, ["id", "version"]);
  if (r.version !== 1 || typeof r.id !== "string" || !Object.hasOwn(recipes, r.id)) throw Error("Unsupported Page recipe");
  return r.id as keyof typeof recipes;
}
export function resolvePlan(selection: Selection, pageConfiguration: unknown, sections: readonly Section[], strict = false, preview = false): PresentationPlan {
  const diagnostics = [...selection.diagnostics]; let purpose: keyof typeof recipes | null = null;
  const fail = (e: unknown) => { if (strict) throw e; diagnostics.push(String(e instanceof Error ? e.message : e)); };
  try { purpose = recipe(record(pageConfiguration).presentation); } catch (e) { fail(e); }
  if (selection.grammar === "basic") purpose = null;
  const manifest = selection.version === 3 ? serviceLedV3 : selection.version === 2 ? serviceLedV2 : serviceLed;
  const recipeSet = selection.version >= 2 ? commercialRecipes : recipes;
  const rule = purpose ? recipeSet[purpose] : null;
  const plans = sections.map(s => {
    const raw = record(Object.hasOwn(s, "rawConfiguration") ? s.rawConfiguration : s.configuration);
    let explicit: Record<string, unknown> = {};
    try {
      exact(raw, ["presentation", "width", "alignment", "spacing", "surface", "divider", "anchor", "mediaFit", "columns", "composition", "treatment", "previewMedia"]);
      if (raw.presentation !== undefined) {
        explicit = exact(raw.presentation, ["hero", "conversion", "surface", "region", "relationship", "layer"]);
        if (explicit.layer !== undefined && (selection.version !== 3 || !["field-bridge", "artifact-bridge"].includes(String(explicit.layer)) || (explicit.layer === "field-bridge" ? s.type !== "hero" : !["intro", "collection", "cta"].includes(s.type)))) throw Error("Unsupported bounded layer pattern");
        if (explicit.hero !== undefined && (s.type !== "hero" || !heroFamilies.includes(explicit.hero as never))) throw Error("Incompatible Hero choice");
        if (explicit.conversion !== undefined && (s.type !== "cta" || !conversions.includes(explicit.conversion as never))) throw Error("Incompatible conversion choice");
        if (explicit.surface !== undefined && !surfaces.includes(explicit.surface as never)) throw Error("Unsupported surface");
        if (explicit.region !== undefined && !["connected", "separated", "emphasized", "closing"].includes(String(explicit.region))) throw Error("Unsupported region");
      }
      if (explicit.relationship !== undefined && (selection.version < 2 || s.type !== "relationship" || explicit.relationship !== "connected-service" || record(s.content).kind !== "stages")) throw Error("Incompatible relationship presentation");
      if (raw.previewMedia !== undefined && !preview) diagnostics.push(`${s.id}: preview-only media refused in ordinary deployment`);
      if (raw.previewMedia !== undefined && strict) { if (!preview || selection.version < 2) throw Error("FPO is refused outside disposable preview preparation"); validateFpo(raw.previewMedia); }
      if (explicit.hero === "service-illustrated" && selection.version < 2) throw Error("Unsupported Hero for pinned grammar");
      if (raw.composition !== undefined) throw Error("Legacy composition cannot select a contract-v2 composition");
      for (const [key, values] of Object.entries({ width: ["reading", "standard", "wide"], alignment: ["left", "center"], spacing: ["compact", "normal", "spacious"], divider: ["none", "rule", "spacing"], surface: ["default", "subtle", "accent", "contrast", "editorial"] })) {
        if (raw[key] !== undefined && !values.includes(String(raw[key]))) throw Error(`Invalid explicit ${key}`);
      }
    } catch (e) { fail(e); explicit = {}; }
    const content = record(s.content);
    if (s.type === "hero") try { plain(content.heading, 300); } catch (e) { fail(e); }
    let hero = (explicit.hero ?? rule?.hero ?? manifest.hero) as SectionPlan["hero"];
    if (hero === "service-illustrated") {
      try { if (!preview) throw Error("Preview media unavailable"); const fpo = validateFpo(raw.previewMedia); if (fpo.role !== "service-illustration") throw Error("Service illustration required"); }
      catch (e) { if (strict && explicit.hero) throw e; diagnostics.push(`${s.id}: service illustration unavailable; orientation fallback`); hero = "orientation"; }
    }
    if (hero === "service-value") {
      try { valuePoints(content.valuePoints); if (!String(content.text ?? "").trim()) throw Error("Missing service proposition"); }
      catch (e) { if (explicit.hero && strict) throw e; diagnostics.push(`${s.id}: service-value requires approved scaffold; masthead fallback`); hero = "editorial-masthead"; }
    }
    if (hero === "editorial-masthead" && !String(content.text ?? "").trim()) hero = "orientation";
    const conversion = (explicit.conversion ?? rule?.conversion ?? manifest.conversion) as SectionPlan["conversion"];
    const legacySurface = { default: "light", subtle: "strong", accent: "brand", contrast: "contrast", editorial: "tonal" } as const;
    const surfacePurpose = s.type === "hero" && hero === "service-value" ? "proposition" : s.type === "relationship" ? "relationship" : s.type === "cta" ? conversion === "closing-emphasis" ? "closing" : "invitation" : purpose === "evidence" ? "evidence" : "explanation";
    const surface = (explicit.surface ?? legacySurface[raw.surface as keyof typeof legacySurface] ?? manifest.surfacePurposes[surfacePurpose]) as SectionPlan["surface"];
    const result: SectionPlan = { id: s.id, hero, conversion, surface,
      region: (explicit.region ?? (s.type === "cta" ? conversion === "closing-emphasis" ? "closing" : "connected" : s.type === "relationship" ? "emphasized" : rule?.rhythm ?? manifest.rhythm)) as SectionPlan["region"],
      width: ["reading", "standard", "wide"].includes(String(raw.width)) ? raw.width as SectionPlan["width"] : s.type === "intro" && purpose === "editorial" ? "reading" : "standard",
      alignment: raw.alignment === "center" ? "center" : "left", spacing: raw.spacing === "compact" || raw.spacing === "spacious" ? raw.spacing : "normal", divider: raw.divider === "rule" || raw.divider === "spacing" ? raw.divider : "none" };
    if (s.type === "relationship") try { relationship(s.content); } catch (e) { fail(e); }
    if (selection.grammar === "basic") { result.hero = "orientation"; result.conversion = "focused-next-step"; result.surface = "light"; result.region = "separated"; }
    if (selection.grammar === "service-led" && selection.version === 2) {
      if (explicit.surface === undefined && raw.surface === undefined) result.surface = s.type === "cta" ? "strong" : "light";
      if (explicit.conversion === undefined) result.conversion = purpose === "assessment" ? "focused-next-step" : "integrated-invitation";
    }
    return result;
  });
  return { selection, recipe: purpose, header: selection.grammar === "service-led" && purpose === "arrival" ? serviceLed.header : "compact", navigation: selection.grammar === "service-led" ? serviceLed.navigation : "quiet", footer: selection.grammar === "service-led" && purpose !== "assessment" ? serviceLed.footer : "compact", sections: plans, diagnostics };
}

export const serviceLedV2 = Object.freeze({ ...serviceLed, version: 2, typography: "source-editorial-v1", imagePolicy: "preview-service-support", relationship: "connected-service", navigation: "acquisition", footer: "brand-signoff", surfacePurposes: { proposition: "light", relationship: "light", explanation: "light", evidence: "light", invitation: "strong", closing: "strong" }, fallback: "orientation" } as const);

const commercialRecipes = { ...recipes, arrival: { ...recipes.arrival, hero: "service-illustrated", conversion: "integrated-invitation" } } as const;

// A business in focus. Prior grammar manifests and renderers remain pinned.
export const serviceLedV3 = Object.freeze({ ...serviceLedV2, version: 3, typography: "source-sans-v1", imagePolicy: "prominent-preview", relationship: "continuing-fields", footer: "graphic-signoff", layers: ["field-bridge", "artifact-bridge"] as const });

export function boundedLayer(configuration: unknown): "field-bridge" | "artifact-bridge" | undefined {
  const layer = record(record(configuration).presentation).layer;
  return layer === "field-bridge" || layer === "artifact-bridge" ? layer : undefined;
}
