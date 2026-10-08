import { mioPagesPreview } from "./miopages";
import type { PreviewPlan } from "./disposable";
import type { Fpo } from "../../lib/platform/presentation/fpo";

export function businessInFocusPreview(previous: PreviewPlan): PreviewPlan {
  const p = structuredClone(previous);
  p.siteConfiguration.visualDirection = { contractVersion: 2, grammar: { id: "service-led", version: 3 }, preferences: { motion: "off" } };
  p.designConfiguration.typography = { bodyFont: "sans", headingFont: "sans", baseSize: 18, headingScale: 2.5, lineHeight: 1.55 };
  p.designConfiguration.palette = { version: 1, light: { background: "#fbf7ef", text: "#26212d" }, strong: { background: "#e9ba8e", text: "#26212d" }, tonal: { background: "#e8e2f2", text: "#322f7e" }, brand: { background: "#322f7e", text: "#fbf7ef" }, supporting: { background: "#555ccc", text: "#ffffff" }, contrast: { background: "#241d35", text: "#fbf7ef" }, border: "#9b8ea7", muted: "#62586a" };
  const slot = (role: Fpo["role"], purpose: string, importance: Fpo["importance"] = "important", aspect: Fpo["aspect"] = "landscape-3:2"): Fpo => ({ version: 1, role, purpose, importance, aspect, source: role === "evidence-project" ? "existing-site-reuse" : "customer-owned", permission: "unresolved" });
  for (const sections of Object.values(p.pages)) for (const s of sections) s.configuration = { presentation: { region: "connected", surface: "light" } };
  p.pages["/"][0].configuration = { presentation: { hero: "service-illustrated", surface: "brand", layer: "field-bridge", region: "emphasized" }, previewMedia: slot("service-illustration", "Business understanding → clear public presence → continuing attention") };
  p.pages["/"][2].configuration = { presentation: { relationship: "connected-service", region: "emphasized", surface: "light" } };
  p.pages["/"][4].configuration = { presentation: { surface: "brand", layer: "artifact-bridge", region: "closing" }, previewMedia: slot("review-artifact", "Illustrative Review deliverable; no findings or customer data", "important", "portrait-4:5") };
  const service = p.pages["/service"];
  service[0].configuration = { presentation: { surface: "brand", region: "emphasized" } };
  service[1].configuration = { presentation: { relationship: "connected-service", region: "emphasized" } };
  service[7].configuration = { presentation: { surface: "tonal", region: "closing" } };
  const evidence = p.pages["/experience"];
  evidence[0].configuration = { presentation: { surface: "brand", region: "emphasized" } };
  evidence[1].configuration = { presentation: { surface: "light", region: "emphasized" }, previewMedia: slot("evidence-project", "Featured historical work, subject to verified contribution and permission", "important", "wide-5:2") };
  evidence[2].content.text = "Supporting examples will explain the business context and the operator’s verified contribution. Selection and permission remain unresolved. No client imagery, results or endorsements are presented here.";
  evidence[2].configuration = { presentation: { surface: "tonal" }, previewMedia: slot("evidence-project", "Supporting project or application evidence; identity withheld", "optional") };
  evidence[4].configuration = { presentation: { surface: "light", region: "closing" } };
  const review = p.pages["/review"];
  review[0].configuration = { presentation: { surface: "brand", region: "emphasized" } };
  review[1].configuration = { presentation: { surface: "brand", layer: "artifact-bridge", region: "emphasized" }, previewMedia: slot("review-artifact", "Report outline with explanation fragments, not a real customer assessment", "important", "portrait-4:5") };
  review[4].configuration = { presentation: { surface: "tonal", region: "closing" } };
  return p;
}
export const focusMioPagesPreview = businessInFocusPreview(mioPagesPreview);
