import type { SiteDesign } from "../design-systems/site-design";
import type { PageContent, SitePlan, WriteInput, Writer } from "./cycle";

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
  components: { opening: { variant: "split" }, text: { variant: "single" }, "text-picture": { variant: "picture-right" }, points: { variant: "columns" },
    steps: { variant: "row" }, questions: { variant: "folded" }, gallery: { variant: "grid" }, call: { variant: "band" } },
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
        const previous = input.previous as PageContent | undefined;
        // A layout-only change: the stand-in flips the first section's variant; a content-only change: it marks the first heading.
        if (input.grain === "page-layout") return { ...previous!, layout: previous!.layout.map((section, index) => index === 0
          ? { ...section, variant: section.variant === "centered" ? "split" : "centered" } : section) };
        if (input.grain === "page-words") return { ...previous!, content: previous!.content.map((item, index) => index === 0 && item.type === "heading"
          ? { ...item, text: `${item.text} (${label}${answering ? ":" + answering : ""})` } : item) };
        const page = input.page!;
        const home = page.path === "/", next = home ? "/start" : "/";
        // A few confirmed facts, and any Proposed ones meant for the website (Core may use them in drafts), each cited.
        const shown = [...facts.filter(item => item.status !== "proposed").slice(0, 2), ...facts.filter(item => item.status === "proposed")];
        const content: PageContent = { path: page.path, title: page.label, menuLabel: page.label, searchTitle: page.label, searchDescription: page.purpose,
          sourceIds: shown.filter(item => item.key).map(item => "knowledge:" + item.key),
          content: [
            { id: "c1", type: "heading", text: page.label },
            { id: "c2", type: "text", text: `${label}. ${page.purpose}${answering}` },
            { id: "c3", type: "picture", shows: "The service at work (placeholder until real imagery is chosen)", alt: "The service" },
            { id: "c4", type: "action", label: home ? "Get started" : "Home", page: next },
            { id: "c5", type: "heading", text: "What the business knows" },
            ...shown.slice(0, 3).map((item, index) => ({ id: `c${6 + index}`, type: "item" as const, title: item.kind ?? "Fact", text: item.value ?? "" })),
          ],
          layout: [
            { id: "s1", component: "opening", variant: null, band: "contrast", slots: { heading: ["c1"], text: ["c2"], picture: ["c3"], actions: ["c4"] } },
            ...(shown.length ? [{ id: "s2", component: "points" as const, variant: null, band: "light" as const,
              slots: { heading: ["c5"], items: shown.slice(0, 3).map((_, index) => `c${6 + index}`) } }] : []),
          ] };
        return content;
      }
    }
  },
};
