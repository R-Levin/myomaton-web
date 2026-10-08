import { renderToStaticMarkup } from "react-dom/server";
import { ManagedSitePageView } from "../../components/managed-sites/managed-site-page";
import type { ManagedSitePage, ManagedSiteSection } from "../../lib/platform/managed-sites/service";
import { defaultDesignConfiguration } from "../../lib/platform/design-systems/configuration";
import { resolveVisualDirection } from "../../lib/platform/visual-direction/model";

// In-memory presentation examples, never production customers or finished designs.
export function grammarFixture(kind: "professional" | "local" | "technical", density = "comfortable"): ManagedSitePage {
  const examples = {
    professional: { name: "Example Legal Practice", heading: "Clear advice for consequential business decisions.", text: "Business law requires careful judgment and a clear understanding of your priorities. Understand the options and responsibilities before you proceed.", topics: ["Commercial agreements", "Practical dispute advice"], font: "serif", base: 18, space: 48, accent: "#293849" },
    local: { name: "Example Home Care", heading: "A reliable hand with the work around your home.", text: "Keep your home comfortable with dependable local help. Understand what is included, agree the work, and know who will be looking after it.", topics: ["Regular home maintenance", "Help with the next repair"], font: "sans", base: 17, space: 40, accent: "#745344" },
    technical: { name: "Example Industrial Consulting", heading: "Engineering guidance you can put to work.", text: "Understand operating constraints, review the available evidence, and plan a practical improvement. Technical advice connects the detail to your business decision.", topics: ["Operating requirements", "Evidence and evaluation"], font: "mono", base: 16, space: 32, accent: "#234759" },
  } as const;
  const e = examples[kind];
  const action = { id: "11111111-1111-4111-8111-111111111111", name: "Scope", type: "section" as const, label: "Understand the scope", destination: "#scope" };
  const section = (id: string, type: string, content: Record<string, unknown>, configuration = {}): ManagedSiteSection => ({ id, name: id, type, variant: "stack", content, configuration, action });
  return {
    managedSite: { id: "fixture", name: e.name }, page: { id: "fixture-page", name: "Home", title: "Home", slug: "/" },
    designSystem: { id: null, name: null, configuration: { ...defaultDesignConfiguration, colors: { ...defaultDesignConfiguration.colors, background: "#faf8f4", surface: "#efebe5", text: "#20242a", muted: "#525860", accent: e.accent }, typography: { ...defaultDesignConfiguration.typography, baseSize: e.base, headingFont: e.font, headingScale: 1.75 }, spacing: { unit: 8, section: e.space } } },
    visual: resolveVisualDirection({ visualDirection: { grammar: { id: "restrained-editorial", version: 1 }, preferences: { density, motion: "off" } } }),
    sections: [
      section("hero", "hero", { eyebrow: e.name, heading: e.heading, text: e.text, actionId: action.id }),
      section("scope", "intro", { heading: "Understand the work before you decide", text: e.text + "\n\nA clear scope makes the next step easier to assess." }, { anchor: "scope", width: "wide" }),
      section("areas", "collection", { heading: "Where we can help", itemSource: "inline", items: e.topics.map((heading, i) => ({ id: String(i), heading, text: "Agree the priorities, responsibilities, and useful next step." })) }, { composition: "grouped-field", columns: 2 }),
      section("next", "cta", { heading: "Start with a useful conversation", text: "Understand the scope before making a commitment.", actionId: action.id }, { composition: "conversion-band" }),
    ],
  };
}
export function renderGrammarFixtures(): Record<string, string> {
  return Object.fromEntries(["professional", "local", "technical", "professional-airy"].map(name => ["/" + name,
    renderToStaticMarkup(<ManagedSitePageView page={grammarFixture(name === "professional-airy" ? "professional" : name as "professional" | "local" | "technical", name.endsWith("airy") ? "airy" : "comfortable")} />)]));
}
