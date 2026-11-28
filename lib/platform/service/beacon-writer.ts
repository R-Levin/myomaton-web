import type { SiteDesign } from "../design-systems/site-design";
import type { PageContent, SitePlan, WriteInput, Writer } from "./cycle";
import { applyWordEdits, fillLayout, type Layout } from "./page-words";

/**
 * A Beacon (glossary): a clearly labeled stand-in for Core's AI, so the whole cycle can run on
 * screens without spending. Everything it writes says it is a stand-in. Its content is drawn
 * from the Account's own Knowledge, so a person can follow the cycle; it is never presented as
 * Core's real work.
 */
const label = "Beacon (stand-in for Core's AI)";

type Item = { key?: string; kind?: string; value?: string; name?: string; summary?: string; status?: string; forWebsite?: boolean };

/** Deliberately plain grays, so no one mistakes the Beacon's design for Core's. */
const pair = (background: string, text: string) => ({ background, text });
const beaconDesign: SiteDesign = {
  palette: { light: pair("#ffffff", "#1f1f1f"), strong: pair("#e6e6e6", "#1f1f1f"), tonal: pair("#f2f2f2", "#1f1f1f"), brand: pair("#4d4d4d", "#ffffff"),
    supporting: pair("#d9d9d9", "#1f1f1f"), contrast: pair("#1f1f1f", "#ffffff"), border: "#cccccc", muted: "#595959" },
  typography: { headingFamily: "work-sans", bodyFamily: "work-sans", baseSize: 17, headingScale: 2.5, lineHeight: 1.6, headingWeight: 600 },
  shape: "square", density: "balanced", imagery: { style: "photography", direction: "Placeholder until Core's real design." },
  rationale: `${label}: plain grays, not a design.`, sourceIds: [], adjustments: [] };

export const beaconWriter: Writer = {
  async write(input: WriteInput) {
    const items = input.knowledge as Item[];
    const facts = items.filter(item => item.value && item.forWebsite !== false);
    const offering = items.find(item => item.name);
    const answering = input.requests.length ? ` Reworked for: ${input.requests.join(" / ")}` : "";
    switch (input.kind) {
      case "report": {
        const kinds = [...new Set(facts.map(item => item.kind ?? "fact"))].slice(0, 6);
        return { title: `${label}: Business Understanding Report`, summary: `What Core holds about the business, grouped by kind.${answering}`,
          findings: kinds.map(kind => ({ id: kind, heading: kind[0].toUpperCase() + kind.slice(1).replaceAll("-", " "),
            body: facts.filter(item => (item.kind ?? "fact") === kind).map(item => item.value).join(" "),
            status: facts.some(item => item.kind === kind && item.status === "proposed") ? "proposed" : "established",
            sourceIds: facts.filter(item => (item.kind ?? "fact") === kind && item.key).map(item => "knowledge:" + item.key) })) };
      }
      case "direction":
        return { positioning: `${label}: ${offering?.summary ?? "The Client's offer"}`, approach: `Lead with what the business does for its customers.${answering}`,
          visitorDecisions: ["Understand the service", "Decide whether it fits", "Get in touch or start"], sourceIds: [], design: beaconDesign };
      case "site-plan": {
        const plan: SitePlan = { pages: [
          { path: "/", label: "Home", purpose: "Say what the business does and for whom, and offer the next step.", inMenu: true },
          { path: "/service", label: "Service", purpose: "Explain the offer in full.", inMenu: true },
          { path: "/start", label: "Start", purpose: "Help a visitor take the first step.", inMenu: true }] };
        return plan;
      }
      case "page": {
        // A words or layout change: the stand-in keeps the arrangement and the words, and says so in the one word it may change.
        if (input.grain === "page-layout") return fillLayout(input.previous as PageContent, sameArrangement(input.arrangement!));
        if (input.grain === "page-words") return applyWordEdits(input.previous as PageContent,
          { change: [{ id: input.words![0]!.id, text: `${input.words![0]!.text} (${label}${answering ? ":" + answering : ""})` }] });
        const page = input.page!;
        // A few confirmed facts, and any Proposed ones meant for the website (Core may use them in drafts), each cited.
        const shown = [...facts.filter(item => item.status !== "proposed").slice(0, 2), ...facts.filter(item => item.status === "proposed")];
        const content: PageContent = { path: page.path, heading: `${page.label}`, composition: "managed-v1",
          sections: [
            { heading: page.label, body: `${label}. ${page.purpose}${answering}`, role: "hero", sourceIds: [],
              visual: { purpose: "Show the service at work", brief: "Placeholder until real imagery is chosen", altIntent: "The service", status: "asset-needed" } },
            { heading: "What the business knows", body: shown.map(item => item.value).join(" ") || "To be written from Knowledge.", role: "intro",
              sourceIds: shown.filter(item => item.key).map(item => "knowledge:" + item.key),
              visual: { purpose: "", brief: "", altIntent: "", status: "text-only" } }],
          actions: [], internalLinks: [] };
        return content;
      }
    }
  },
};

type Node = { kind: string; text: string | null; level: number | null; items: string[]; children: Node[]; [key: string]: unknown };
const plain = { arrangement: "flow", columns: [], gap: "medium", inset: "none", surface: "none", align: "start", measure: "reading",
  typeScale: "body", span: 12, mobileOrder: 0, border: false, rounded: false };
const node = (kind: string, text: string | null, extra: Partial<Node> = {}): Node =>
  ({ kind, text, level: null, items: [], ordered: false, reference: null, layout: plain, children: [], ...extra });
const opening = (n: Node): string => n.kind === "heading" && (n.level === 1 || n.level === 2) ? n.text! : n.children.map(opening).find(Boolean) ?? "";

/** The stand-in's layout: the same arrangement, each section as a designed component (no design of its own). */
function sameArrangement(arrangement: PageContent): Layout {
  return { sections: arrangement.sections.map(raw => {
    const s = raw as { heading: string; body: string; role: string; visual: unknown; moreVisuals?: unknown;
      block?: { version?: number; mode?: string; root: Node; groups?: { heading: string; body: string; items: string[] }[] } };
    if (s.block?.version === 2 && s.block.mode === "section") return { heading: opening(s.block.root), role: s.role, visual: s.visual, moreVisuals: s.moreVisuals ?? [], block: s.block };
    const pieces = (text: string) => String(text).split(/\n\s*\n/u).map(part => part.trim()).filter(part => /^w\d+$/u.test(part));
    const children = [node("heading", s.heading, { level: s.role === "hero" ? 1 : 2 }), ...pieces(s.body).map(id => node("paragraph", id))];
    for (const group of s.block?.groups ?? []) {
      if (/^w\d+$/u.test(group.heading)) children.push(node("heading", group.heading, { level: 3 }));
      children.push(...pieces(group.body).map(id => node("paragraph", id)));
      if (group.items.length) children.push(node("list", null, { items: group.items }));
    }
    if (s.block?.version === 2) children.push(s.block.root);
    return { heading: s.heading, role: s.role, visual: s.visual, moreVisuals: s.moreVisuals ?? [],
      block: { version: 2, name: "beacon-section", purpose: label, mode: "section", root: node("group", null, { children }) } };
  }) };
}
