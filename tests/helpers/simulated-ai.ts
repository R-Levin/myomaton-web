import assert from "node:assert/strict";
import type { ResponsesTransport } from "../../lib/platform/intake/intelligent-responses";
import type { NativeNode } from "../../lib/platform/intake/presence-native-component";

/** The shared stand-in for Core's AI in tests: plausible answers in exactly the requested format (a Beacon). */
export type Schema = { properties?: Record<string, Schema>; items?: Schema; enum?: unknown[] };
export const enumAt = (schema: Schema, ...path: string[]) => {
  let node: Schema | undefined = schema;
  for (const key of path) node = key === "[]" ? node?.items : node?.properties?.[key];
  return (node?.items?.enum ?? node?.enum ?? []) as string[];
};
const layout: NativeNode["layout"] = { arrangement: "flow", columns: [], gap: "medium", inset: "none", surface: "none", align: "start",
  measure: "full", typeScale: "body", span: 1, mobileOrder: 0, border: false, rounded: false };
const node = (kind: NativeNode["kind"], changes: Partial<NativeNode> = {}): NativeNode =>
  ({ kind, text: null, level: null, items: [], ordered: false, reference: null, layout, children: [], ...changes });

/** Stand-in for the model: a plausible answer in exactly the requested format. */
export function simulatedAnswer(name: string, schema: Schema, instructions: string) {
  const stage = name.replace("presence_workflow_", "").replace("core_", "");
  if (stage === "report") {
    const ids = enumAt(schema, "findings", "[]", "sourceIds");
    // With an open correction, Core asks for the facts it states: one in the Client's words, one reworded.
    const corrected = schema.properties?.correctionFacts ? { correctionFacts: [
      { findingId: "audience", statement: "We serve owner-led UK businesses.", publicUse: true },
      { findingId: "audience", statement: "Clients are UK firms run by their owners.", publicUse: true }] } : {};
    return { ...corrected, title: "Business understanding (simulated)", summary: "Simulated summary.", findings: [
      { id: "offer", heading: "One managed service", body: "Simulated finding about the offer.", status: "proposed", sourceIds: ids.slice(0, 1) },
      { id: "audience", heading: "Who it serves", body: "Simulated finding about the audience.", status: "proposed", sourceIds: ids.slice(0, 1) }] };
  }
  if (stage === "direction") {
    assert.ok(schema.properties?.design, "Rebuilt Direction requests carry the site design schema");
    assert.match(instructions, /fill the design object/);
    const ids = enumAt(schema, "sourceIds");
    const pair = (background: string, text: string) => ({ background, text });
    return { positioning: "Simulated positioning.", approach: "Simulated approach.", visitorDecisions: ["Understand the service", "Choose how to start"],
      sourceIds: ids.slice(0, 1), design: {
        palette: { light: pair("#fbf7f0", "#1d1a16"), strong: pair("#e8dccb", "#1d1a16"), tonal: pair("#f1ebe2", "#c9c2b8"),
          brand: pair("#9fd3bf", "#ffffff"), supporting: pair("#dbe8e1", "#123528"), contrast: pair("#14201b", "#f5efe4"), border: "#d8cdbd", muted: "#5a5247" },
        typography: { headingFamily: "fraunces", bodyFamily: "work-sans", baseSize: 17, headingScale: 3, lineHeight: 1.6, headingWeight: 600 },
        shape: "soft", density: "airy", imagery: { style: "illustration", direction: "Simulated art direction." },
        stylesheet: ".miopages-draft-hero h1 { font-size: clamp(2.4rem, 6vw, 4.8rem); } nav.miopages-draft-nav a[aria-current=\"page\"] { text-decoration: underline; }",
        rationale: "Simulated rationale.", sourceIds: ids.filter(id => id.startsWith("research:")).slice(0, 1) } };
  }
  if (stage === "blueprint") {
    const brief = (path: string) => ({ decision: "Simulated page decision for " + path,
      findingIds: enumAt(schema, "pages", "[]", "decisionBrief", "findingIds").slice(0, 1),
      directionSteps: enumAt(schema, "pages", "[]", "decisionBrief", "directionSteps").slice(0, 1),
      claimIds: enumAt(schema, "pages", "[]", "decisionBrief", "claimIds").slice(0, 1),
      influences: (path === "/" ? [{ sourceIds: enumAt(schema, "pages", "[]", "decisionBrief", "influences", "[]", "sourceIds")
        .filter(id => id.startsWith("research:")).slice(0, 1), use: "composition", implication: "Simulated research influence." }] : [])
        .filter(influence => influence.sourceIds.length),
      avoid: [] });
    const ids = enumAt(schema, "pages", "[]", "sourceIds").slice(0, 1);
    return { pages: [["/", "Home"], ["/service", "Service"], ["/start", "Start"]].map(([path, label]) =>
      ({ path, label, purpose: "Simulated purpose.", sourceIds: ids, decisionBrief: brief(path) })), navigation: ["/service", "/start"], articles: [] }; // Home left out of the menu, as Core did in the first real run
  }
  if (stage === "review-analysis" && schema.properties?.newPages) {
    // Second round: the Operator asked for a page the site does not have.
    assert.match(instructions, /New page:/);
    const brief = (key: string) => enumAt(schema, "newPages", "[]", "decisionBrief", key).slice(0, 1);
    const decisionBrief = { decision: "Give people one clear way to get in touch.", findingIds: brief("findingIds"),
      directionSteps: brief("directionSteps"), claimIds: brief("claimIds"), influences: [], avoid: [] };
    const page = { path: "/contact", label: "Contact", purpose: "Tell people how to reach MioPages and what to include.",
      sourceIds: [], decisionBrief };
    const noteId = enumAt(schema, "newPages", "[]", "noteId")[0];
    return { summary: "You asked for a Contact page; Core proposes one, linked from Home.", facts: [],
      newPages: [{ ...page, noteId }, { ...page, noteId, path: "/service" }],
      revisions: [{ path: "/", sectionIndex: 1, reason: "Point people to the new Contact page.", factIds: [], newPageIds: ["P1"] }] };
  }
  if (stage === "review-analysis") {
    assert.match(instructions, /analyse the Operator's review/);
    return { summary: "One fact in your Service edit; Home should mention it.",
      facts: [{ statement: "The Service page heading is as the Operator wrote it.", publicUse: true, sourcePath: "/service",
        sourceText: "Simulated heading for /service (edited by the Operator)" },
        { statement: "An invented fact with no source.", publicUse: true, sourcePath: "/", sourceText: "Text the Operator never wrote" }],
      revisions: [{ path: "/", sectionIndex: 1, reason: "Mention the Operator's Service wording.", factIds: ["F1"] },
        { path: "/start", sectionIndex: 0, reason: "Already queued from the Note.", factIds: ["F1"] }] };
  }
  if (stage === "page" && schema.properties?.widerChange) {
    // A revision limited to the noted sections: only those sections come back.
    assert.match(instructions, /act on the Operator's review/);
    assert.match(instructions, /limited to the noted section/);
    const indexes = enumAt(schema, "sections", "[]", "index") as unknown as number[];
    const visual = { purpose: "Simulated", brief: "Simulated brief.", altIntent: "Simulated alt", status: "text-only" };
    return { widerChange: { needed: true, reason: "The Home page should mention the shorter first step too." },
      sections: indexes.map(index => index === 0
        ? { index, heading: "Simulated heading for /start", body: "A shorter first step (revised).", sourceIds: [], role: "hero", visual: { ...visual, status: "asset-needed" },
          block: { version: 2, name: "simulated-opening", purpose: "Simulated hero", mode: "section", root: node("group", { children: [
            node("heading", { level: 1, text: "Simulated heading for /start" }), node("paragraph", { text: "A shorter first step (revised)." }),
            node("action", { reference: "action-0", text: "See how it works" })] }) } }
        : { index, heading: "What clients say", body: "Revised proof section.", sourceIds: [], role: "intro", visual,
          block: { version: 2, name: "simulated-proof", purpose: "Simulated proof", mode: "section", root: node("group", { children: [
            node("heading", { level: 2, text: "What clients say" }), node("paragraph", { text: "Revised proof section." })] }) } }) };
  }
  if (stage === "page") {
    const path = enumAt(schema, "path")[0];
    assert.match(instructions, /place a placeholder node exactly where it belongs/);
    assert.ok(!/Never turn internal proof-policy/.test(instructions), "Old warning blocks are gone");
    const hero = { version: 2, name: "simulated-opening", purpose: "Simulated hero", mode: "section", root: node("group", {
      layout: { ...layout, arrangement: "columns", columns: [3, 2], gap: "large" }, children: [
        node("group", { children: [node("heading", { level: 1, text: "Simulated heading for " + path }), node("paragraph", { text: "Simulated opening." }),
          node("action", { reference: "action-0", text: "See how it works" })] }),
        node("image", { reference: "section-0" })] }) };
    const proof = { version: 2, name: "simulated-proof", purpose: "Simulated proof", mode: "section", root: node("group", {
      layout: { ...layout, surface: "supporting", inset: "medium", rounded: true }, children: [
        node("heading", { level: 2, text: "What clients say" }),
        node("placeholder", { reference: "need-testimonial", text: "A recent client describing how onboarding went." })] }) };
    const visual = (status: string) => ({ purpose: "Simulated", brief: "Simulated brief.", altIntent: "Simulated alt", status });
    return { path, heading: "Simulated heading for " + path, searchTitle: "Simulated", searchDescription: "Simulated description.",
      composition: "managed-v1", internalLinks: [path === "/" ? "/service" : "/"],
      actions: [{ label: "See how it works", kind: "navigate", destination: path === "/" ? "/service" : "/", sectionIndex: 0 },
        { label: "Talk to us", kind: "request-contact", destination: null, sectionIndex: null }], sections: [
        { heading: "Simulated heading for " + path, body: "Simulated opening.", sourceIds: [], role: "hero", visual: visual("asset-needed"), block: hero },
        { heading: "What clients say", body: "Simulated proof section.", sourceIds: [], role: "intro", visual: visual("text-only"), block: proof }] };
  }
  if (stage === "editorial") return { summary: "Simulated critique.", concerns: [] };
  throw Error("Unexpected simulated stage " + name);
}

/** An offline AI connection answering with the shared stand-in, recording each request. */
export function offlineAi(model: string) {
  const sent: { name: string; instructions: string; input: string; schema: Schema }[] = [];
  const transport: ResponsesTransport = { async send(path, body) {
    if (path.endsWith("/input_tokens")) return { body: { input_tokens: 2000 } };
    const request = body as { instructions: string; input: string; text: { format: { name: string; schema: Schema } } };
    sent.push({ name: request.text.format.name, instructions: request.instructions, input: request.input, schema: request.text.format.schema });
    const output = simulatedAnswer(request.text.format.name, request.text.format.schema, request.instructions);
    const response = { id: "resp_offline_" + sent.length, model, status: "completed", service_tier: "default",
      usage: { input_tokens: 2000, output_tokens: 400, total_tokens: 2400, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } },
      output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(output) }] }] };
    return { body: response, rawBody: Buffer.from(JSON.stringify(response)) };
  } };
  return { transport, sent };
}
