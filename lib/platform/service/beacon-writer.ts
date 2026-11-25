import type { PageContent, SitePlan, WriteInput, Writer } from "./cycle";

/**
 * A Beacon (glossary): a clearly labelled stand-in for Core's AI, so the whole cycle can run on
 * screens without spending. Everything it writes says it is a stand-in. Its content is drawn
 * from the Account's own Knowledge, so a person can follow the cycle; it is never presented as
 * Core's real work.
 */
const label = "Beacon (stand-in for Core's AI)";

type Item = { key?: string; kind?: string; value?: string; name?: string; summary?: string; status?: string; forWebsite?: boolean };

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
          visitorDecisions: ["Understand the service", "Decide whether it fits", "Get in touch or start"], sourceIds: [] };
      case "site-plan": {
        const plan: SitePlan = { pages: [
          { path: "/", label: "Home", purpose: "Say what the business does and for whom, and offer the next step.", inMenu: true },
          { path: "/service", label: "Service", purpose: "Explain the offer in full.", inMenu: true },
          { path: "/start", label: "Start", purpose: "Help a visitor take the first step.", inMenu: true }] };
        return plan;
      }
      case "page": {
        const page = input.page!;
        const content: PageContent = { path: page.path, heading: `${page.label}`, composition: "managed-v1",
          sections: [
            { heading: page.label, body: `${label}. ${page.purpose}${answering}`, role: "hero", sourceIds: [],
              visual: { purpose: "Show the service at work", brief: "Placeholder until real imagery is chosen", altIntent: "The service", status: "asset-needed" } },
            { heading: "What the business knows", body: facts.slice(0, 3).map(item => item.value).join(" ") || "To be written from Knowledge.", role: "intro", sourceIds: [],
              visual: { purpose: "", brief: "", altIntent: "", status: "text-only" } }],
          actions: [], internalLinks: [] };
        return content;
      }
    }
  },
};
