import path from "node:path";
import type { PreviewPlan } from "./disposable";
import type { Fpo } from "../../lib/platform/presentation/fpo";

// One recommendation. All artwork positions are disposable design evidence,
// not approved media or production content.
export function continuingCarePreview(previous: PreviewPlan): PreviewPlan {
  const p = structuredClone(previous);
  const review = Object.keys(p.actionLabels).find(id => p.actionLabels[id].includes("Review"))!;
  const service = Object.keys(p.actionLabels).find(id => p.actionLabels[id].includes("Service"))!;
  const fpo = (role: Fpo["role"], purpose: string, source: Fpo["source"], importance: Fpo["importance"] = "important"): Fpo => ({ version: 1, role, purpose, source, importance, aspect: role === "evidence-project" ? "wide-5:2" : "landscape-3:2", permission: "unresolved" });
  const note = "Preview only · MioPages is not open for service or Review requests. No information can be submitted here.";
  p.siteConfiguration = { visualDirection: { contractVersion: 2, grammar: { id: "service-led", version: 2 }, preferences: { motion: "off" } }, globals: { header: { contactActionId: review } } };
  p.logo.light = { file: path.resolve("brand/miopages/MioPagesDVw.png"), name: "MioPages approved light wordmark", alt: "MioPages" };
  p.designConfiguration.palette = { version: 1, light: { background: "#fbf7ef", text: "#26212d" }, strong: { background: "#f4e5d4", text: "#26212d" }, tonal: { background: "#e8e2f2", text: "#322f7e" }, brand: { background: "#322f7e", text: "#fbf7ef" }, supporting: { background: "#e9ba8e", text: "#26212d" }, contrast: { background: "#241d35", text: "#fbf7ef" }, border: "#9b8ea7", muted: "#62586a" };
  p.designConfiguration.colors = { background: "#fbf7ef", surface: "#e8e2f2", text: "#26212d", muted: "#62586a", accent: "#322f7e", onAccent: "#fbf7ef", border: "#9b8ea7" };
  p.designConfiguration.typography = { bodyFont: "sans", headingFont: "serif", baseSize: 18, headingScale: 2, lineHeight: 1.6 };
  for (const sections of Object.values(p.pages)) for (const section of sections) section.configuration = {};
  const home = p.pages["/"];
  home[0].content = { heading: "A clearer web presence. Less to manage.", eyebrow: "Managed Web Presence", text: "MioPages helps established service and technical businesses explain what they do and keep their web presence current. One focused Launch, followed by continuing care.", actionId: review, secondaryActionId: service };
  home[0].configuration = { presentation: { hero: "service-illustrated", surface: "light" }, previewMedia: fpo("service-illustration", "Business understanding → clear presence → continuing attention", "generated-illustrated") };
  home[1] = { type: "intro", configuration: { presentation: { region: "connected" } }, content: { heading: "Good at your work. Ready to hand over the web work.", text: "Your business has expertise worth explaining. But keeping the website useful competes with serving customers and running the business.\n\nMioPages is for established businesses that want a clear, professional presence and a sensible continuing relationship—without becoming website administrators." } };
  home[2].configuration = { presentation: { relationship: "connected-service", surface: "tonal" } };
  home[2].content.heading = "Clear work at the start. Continuing care after.";
  home[3] = { type: "intro", configuration: {}, content: { heading: "Your business judgment. Our web responsibility.", text: "You supply the knowledge and approve what the presence says about your business. MioPages shapes the content, presentation and agreed web work around it.\n\nRelevant experience across technical, consulting, professional and service businesses supports that work. The aim is useful clarity, with less administration for you.", actionId: Object.keys(p.actionLabels).find(id => p.actionLabels[id].includes("Experience")) } };
  home.splice(4, 1);
  home[4] = { type: "cta", configuration: { presentation: { conversion: "integrated-invitation", surface: "strong", region: "closing" }, previewMedia: fpo("review-artifact", "Make the shape of the free Review tangible, without inventing findings", "generated-illustrated") }, content: { heading: "Start with the next useful step.", text: "The free Web Presence Review offers a practical view of your current presence and roughly three useful priorities. Clarity before you decide on a service.\n\n" + note, actionId: review } };
  const servicePage = p.pages["/service"];
  servicePage[0].configuration = { presentation: { hero: "orientation" } };
  servicePage[1].configuration = { presentation: { relationship: "connected-service", region: "connected" } };
  servicePage[1].content = { ...servicePage[1].content, contractVersion: 2, extensions: [{ id: "expanded", stageId: "launch", heading: "Expanded Launch, where the scope needs it", text: "Supported complexity attaches to Launch: additional content, structure or agreed connections. Scope is confirmed before proceeding; this is not a third mandatory stage or bespoke development." }] };
  servicePage[2].configuration = { presentation: { region: "connected", surface: "tonal" } };
  servicePage[4].configuration = { presentation: { surface: "light" } };
  servicePage[5].configuration = { presentation: { region: "connected" } };
  servicePage[6].configuration = { width: "reading", presentation: { region: "connected" } };
  servicePage[7].configuration = { presentation: { conversion: "integrated-invitation", surface: "strong" } };
  const experience = p.pages["/experience"];
  experience[0].content.heading = "Experience that starts with understanding the business.";
  experience[0].configuration = { presentation: { hero: "editorial-masthead" } };
  experience[1].configuration = { presentation: { region: "connected" }, previewMedia: fpo("evidence-project", "A featured historical example, once contribution and visual permission are confirmed", "existing-site-reuse", "optional") };
  experience.at(-1)!.configuration = { presentation: { conversion: "focused-next-step", surface: "light" } };
  const assessment = p.pages["/review"];
  assessment[0].configuration = { presentation: { hero: "orientation" } };
  assessment[1].configuration = { presentation: { surface: "tonal" }, previewMedia: fpo("review-artifact", "An illustrative assessment outline: understanding, three priorities and a next path", "generated-illustrated") };
  assessment[2].configuration = { width: "reading", presentation: { region: "connected" } };
  assessment.at(-1)!.configuration = { presentation: { conversion: "focused-next-step", surface: "light" } };
  return p;
}
