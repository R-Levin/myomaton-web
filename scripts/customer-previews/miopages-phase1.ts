import type { PreviewPlan, PreviewSection } from "./disposable";

// Preserve the reviewed editorial proposal and pinned experiment; change only
// the disposable presentation proposal through reusable structured capabilities.
export function serviceLedPreview(previous: PreviewPlan): PreviewPlan {
  const p = structuredClone(previous);
  p.siteConfiguration = { visualDirection: { contractVersion: 2, grammar: { id: "service-led", version: 1 }, preferences: { motion: "off" } } };
  p.designConfiguration.palette = { version: 1,
    light: { background: "#faf8f4", text: "#211f2b" }, strong: { background: "#eee8df", text: "#211f2b" },
    tonal: { background: "#e5e1f3", text: "#322f7e" }, brand: { background: "#322f7e", text: "#ffffff" },
    supporting: { background: "#61502e", text: "#ffffff" }, contrast: { background: "#211f2b", text: "#faf8f4" }, border: "#bbb2cc", muted: "#625e68" };
  p.pageConfigurations = Object.fromEntries(["arrival", "service", "evidence", "assessment"].map((id, i) => [["/", "/service", "/experience", "/review"][i], { presentation: { recipe: { id, version: 1 } } }]));
  // Omitted fields participate in the plan. Intentional legacy composition
  // names do not select new-engine structures accidentally.
  for (const sections of Object.values(p.pages)) for (const s of sections) {
    const { width, anchor } = s.configuration;
    s.configuration = { ...(width ? { width } : {}), ...(anchor ? { anchor } : {}) };
  }
  p.pages["/"][0].content.valuePoints = [
    { id: "clarity", heading: "Explain your expertise", text: "Make the offer and its relevance easier to understand." },
    { id: "next", heading: "Make the next step clear", text: "Give prospects a useful path from interest to enquiry." },
    { id: "continuity", heading: "Keep it current", text: "Carry your business knowledge into continuing care." },
  ];
  const stage = (heading: string, launch: string, ongoing: string): PreviewSection => ({ type: "relationship", configuration: {}, content: { contractVersion: 1, kind: "stages", heading, items: [
    { id: "launch", heading: "Standard Launch", text: launch }, { id: "ongoing", heading: "Ongoing", text: ongoing } ] } });
  p.pages["/"][2] = stage("Start clearly. Keep moving.", "Bring your offer, audience and essential information together into a professional presence with a useful next step.", "Keep the same understanding in the relationship as your business changes, with updates and purposeful improvements.");
  p.pages["/"][3].configuration = { presentation: { surface: "tonal", region: "connected" } };
  p.pages["/"][5].configuration = { presentation: { surface: "brand" } };
  const original = previous.pages["/service"];
  p.pages["/service"] = [p.pages["/service"][0],
    stage("One relationship, from Launch onward.", String((original[1].content.items as { text: string }[])[0].text), String(original[2].content.text)),
    { type: "relationship", configuration: { presentation: { surface: "tonal" } }, content: { contractVersion: 1, kind: "scope", heading: "The right scope. A clear boundary.", items: [
      { id: "included", category: "included", heading: "A focused Standard Launch", text: "Your offer and audience, core content, professional presentation, essential Pages and a practical enquiry path." },
      { id: "expanded", category: "extension", heading: "Expanded Launch, when the work needs it", text: String((original[1].content.items as { text: string }[])[1].text) },
      { id: "boundary", category: "boundary", heading: "Supported scope, without bespoke development", text: "Bespoke applications, unlimited redesign, full CRM replacement and broad social-media management are outside the service." } ] } },
    p.pages["/service"][3],
    { type: "relationship", configuration: {}, content: { contractVersion: 1, kind: "responsibilities", heading: "You know the business. We handle the web work.", parties: [{ id: "customer", label: "Your part" }, { id: "miopages", label: "MioPages' part" }], rows: [
      { id: "understand", label: "Understand the business", cells: [{ partyId: "customer", text: "Supply accurate information, priorities and existing assets." }, { partyId: "miopages", text: "Organize the offer, audience and information into a clear presence." }] },
      { id: "approve", label: "Review and approve", cells: [{ partyId: "customer", text: "Approve business claims, presentation and material changes." }, { partyId: "miopages", text: "Prepare a professional result you can review without specifying layouts or technical instructions." }] },
      { id: "continue", label: "Keep the relationship useful", cells: [{ partyId: "customer", text: "Share business changes and provide necessary account access for agreed work." }, { partyId: "miopages", text: "Coordinate agreed setup and carry your business knowledge into ongoing care." }] } ] } },
    p.pages["/service"][5], p.pages["/service"][6], p.pages["/service"][7] ];
  p.pages["/service"][3].configuration = { presentation: { region: "connected" } };
  p.pages["/experience"][1].configuration = { presentation: { surface: "light", region: "connected" } };
  p.pages["/experience"][3].configuration = { presentation: { surface: "tonal" } };
  p.pages["/review"][1].configuration = { presentation: { surface: "tonal" } };
  p.pages["/review"][4].configuration = { presentation: { surface: "strong" } };
  return p;
}
