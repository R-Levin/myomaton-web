import type { SiteDesign } from "../design-systems/site-design";
import type { PageContent, SitePlan, WriteInput, Writer } from "./cycle";

/**
 * A Beacon (glossary): a clearly labelled stand-in for Core's AI, so the whole cycle can run on
 * screens without spending. Everything it writes says it is a stand-in. Its content is drawn
 * from the Account's own Knowledge, so a person can follow the cycle; it is never presented as
 * Core's real work.
 */
const label = "Beacon (stand-in for Core's AI)";

type Item = { key?: string; kind?: string; value?: string; name?: string; summary?: string; status?: string; forWebsite?: boolean };

/** Deliberately plain greys, so no one mistakes the Beacon's design for Core's. */
const pair = (background: string, text: string) => ({ background, text });
const beaconDesign: SiteDesign = {
  palette: { light: pair("#ffffff", "#1f1f1f"), strong: pair("#e6e6e6", "#1f1f1f"), tonal: pair("#f2f2f2", "#1f1f1f"), brand: pair("#4d4d4d", "#ffffff"),
    supporting: pair("#d9d9d9", "#1f1f1f"), contrast: pair("#1f1f1f", "#ffffff"), border: "#cccccc", muted: "#595959" },
  typography: { headingFamily: "work-sans", bodyFamily: "work-sans", baseSize: 17, headingScale: 2.5, lineHeight: 1.6, headingWeight: 600 },
  shape: "square", density: "balanced", imagery: { style: "photography", direction: "Placeholder until Core's real design." },
  rationale: `${label}: plain greys, not a design.`, sourceIds: [], adjustments: [] };

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
            status: facts.some(item => item.kind === kind && item.status === "proposed") ? "proposed" : "established", sourceIds: [] })) };
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
