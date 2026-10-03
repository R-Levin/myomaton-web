import frozen from "./myomaton-secondary-pages-v1-baseline.json";

export type Row = Record<string, unknown> & { id: string };
export const ids = {
  "about": "de8728f0-3bfe-40b4-a721-37f7779634d2",
  "projects": "c4bcb2b1-84e0-4ef5-a374-383563ed7c85",
  "principles": "5cdc56f1-d2f4-4d66-a0f8-d3871a612176",
  "projectsAction": "289247dc-d4d0-4cdc-aabb-46c2b4b38940",
  "principlesAction": "60eeae6f-ae85-433b-9fea-19548b556a7f",
  "returnAction": "ec47c6b5-e75d-4dd7-a59a-dac14a8737d3",
  "aboutHero": "b6142d7e-b8e1-41a7-9ade-ec96a5f37bc9",
  "why": "a6251ba4-01e7-41b4-87bf-288a864f5454",
  "physical": "2f42e897-8507-4345-a743-18a4a6bbf96e",
  "person": "33113b1e-3a54-49d7-81f0-3f9ebe36a150",
  "open": "e8290a76-95db-4da8-a815-a010cface1ff",
  "aboutCta": "46dc2e85-4b5a-4524-aebf-a9e2614fe45d",
  "projectsHero": "541bed47-e1e4-43d0-8229-b78c8ec91d8f",
  "currentProjects": "c984b810-387c-4b39-99b8-25ee6f23cd9b",
  "tabot": "211ff9f7-07fc-43df-9780-1f0ea771c047",
  "abot": "ca7d2a60-d54f-40b1-87fa-0673fe9e510a",
  "experiments": "4fd4e176-26a4-4c5a-b3dd-d626d80b3c29",
  "ecosystem": "1fb0bdd2-c451-4ca9-ab05-9c525685a768",
  "projectsCta": "a7d9b1ba-456f-4936-bc49-bfe861638bbf",
  "principlesHero": "c4edd287-d942-4fb0-868f-cc77fbeb614b",
  "core": "c1949ff0-f02f-4474-90e3-53ad7e7e74af",
  "ownership": "d1833556-8d59-4b41-a594-7a2c4fe7067c",
  "complexity": "49547304-277d-4a19-aa56-2bc19380feb4",
  "works": "7cbb70b2-ac0c-49b6-a269-3b3acdaf2be4",
  "sharing": "d7928e1a-1a50-4068-b635-841b90e1c96d",
  "principlesCta": "d0f519e2-27a9-4f67-9d67-118798c67543",
  "tabotUsage": "5172857b-99ec-4b70-bf36-4b1785f5637e",
  "abotUsage": "3cc28c9c-cbc8-4bae-b733-2ff77192e3e2",
  "navHome": "48e12793-6035-48a5-b722-054e84144c6a",
  "navProjects": "46fa0ce2-1bca-4b59-8760-67fd758abdc1",
  "navPrinciples": "8ff82bd1-d3c2-4e67-baa1-a22bd4e45487",
  "navAbout": "79a0b953-ce40-4e6e-b258-8132c64f7359"
} as const;
export const presenceId = frozen.web_presences[0].id;
export const siteId = frozen.managed_sites[0].id;
export const homeId = frozen.pages[0].id;
export const navigationId = frozen.navigations[0].id;
export const tabotAssetId = "eb1ea754-2f6d-4514-bf42-f4781f5f1d80";
export const abotAssetId = "2cd65369-3c6f-4017-a51d-71759d6115db";
export const unusedAbotAssetId = "e1a699d7-19ca-43a1-9dbe-3d7d523381ef";
const defaults = { status: "active", version: 1, configuration: {}, metadata: {} };
export const pageRows: Row[] = [
  { id: ids.about, name: "About", title: "About Myomaton", slug: "/about", sort_order: 30 },
  { id: ids.projects, name: "Projects", title: "Projects", slug: "/projects", sort_order: 10 },
  { id: ids.principles, name: "Principles", title: "Principles", slug: "/principles", sort_order: 20 },
].map(row => ({ ...defaults, ...row, managed_site_id: siteId }));
export const actionRows: Row[] = [
  { id: ids.projectsAction, name: "Projects Page CTA", label: "See what we’re building", destination: ids.projects },
  { id: ids.principlesAction, name: "Principles Page CTA", label: "What makes something Myomaton?", destination: ids.principles },
  { id: ids.returnAction, name: "Projects Return CTA", label: "See the projects", destination: ids.projects },
].map(row => ({ ...defaults, ...row, web_presence_id: presenceId, type: "page" }));

export function sectionRows(actions: readonly string[] = actionRows.map(row => row.id)): Row[] {
  const section = (id: string, page: string, order: number, type: string, heading: string, text?: string,
    extra: Record<string, unknown> = {}, variant = type === "intro" ? "stack" : type === "collection" ? "grid" : "default",
    configuration: Record<string, unknown> = {}) => ({
      ...defaults, id, page_id: page, sort_order: order, type, variant, name: heading,
      content: { heading, ...(text === undefined ? {} : { text }), ...extra }, configuration,
    });
  return [
    section(ids.aboutHero, ids.about, 0, "hero", "About Myomaton",
      "Practical personal robotics, built and tested in the real world."),
    section(ids.why, ids.about, 10, "intro", "Why this exists",
      "Myomaton starts with a simple question: what should a useful personal robot actually be?\n\nThe answer should not depend on novelty alone. A useful robot should be affordable enough to matter, understandable enough to own, repairable enough to keep, and practical enough to earn a place in everyday life."),
    section(ids.physical, ids.about, 20, "intro", "Reality is an excellent design review",
      "Floors have thresholds. Rooms have awkward corners. Wireless connections fail. Batteries run down. People walk through carefully planned routes.\n\nReal environments expose assumptions quickly. That is why Myomaton is built around physical experimentation rather than demonstrations that work only under ideal conditions."),
    section(ids.person, ids.about, 30, "intro", "One person, amplified",
      "Myomaton is being developed by one person working extensively with AI.\n\nAI contributes synthesis, code assistance, documentation, structural reasoning, exploration, and coordination. Human judgment provides continuity of purpose, physical-world experience, priorities, values, and ultimate responsibility.\n\nThe goal is not to blur those roles. It is to use each where it is strongest and keep important project state externalized so the work remains understandable and correctable."),
    section(ids.open, ids.about, 40, "intro", "Open Practical Robotics",
      "Useful work should be shared clearly enough that other people can understand it, reproduce it, improve it, or take it somewhere new.\n\nMyomaton is developed in that spirit: document what proves useful, keep unnecessary barriers low, and be clear about what has actually been demonstrated."),
    section(ids.aboutCta, ids.about, 50, "cta", "See what we’re building", undefined, { actionId: actions[0] }),
    section(ids.projectsHero, ids.projects, 0, "hero", "Projects",
      "Working robots, experiments, and systems built to answer practical questions."),
    section(ids.currentProjects, ids.projects, 10, "collection", "Current Projects", undefined,
      { itemSource: "subjects", items: [
        { id: "project-tabot", subjectId: "5a07b8d7-a388-48c4-9bc5-9b4b575d33cd" },
        { id: "project-abot", subjectId: "845c03b7-cd6d-4cc4-b6a5-de98893cc057" },
      ] }, "grid", { columns: 2 }),
    section(ids.tabot, ids.projects, 20, "intro", "TaBot",
      "TaBot is a practical rolling robot exploring useful household behavior — following, approaching when called, navigating real spaces, managing its own power, and eventually working alongside other robots.\n\nIt is where many Myomaton ideas meet physical reality: navigation, sensing, charging, safety, mechanical design, and the question of what behavior is actually useful around people.",
      {}, "split-text-first", { mediaFit: "natural" }),
    section(ids.abot, ids.projects, 30, "intro", "A-Bot",
      "A-Bot explores a different problem: how one robot might help other robots remain useful.\n\nThe first role is practical and deliberately narrow — connecting, charging, and servicing smaller resident robots. That makes A-Bot both a robot in its own right and part of the larger household ecosystem Myomaton is exploring.",
      {}, "split-image-first", { mediaFit: "natural" }),
    section(ids.experiments, ids.projects, 40, "intro", "Small robot experiments",
      "Not every experiment needs to become a permanent project.\n\nSmaller platforms such as Q-Scout, Root, and other inexpensive robots let us test specific ideas quickly — charging, communication, shared control, sensing, and the division of work between simple and more capable machines.\n\nWhen an experiment develops durable identity and value, it can become a first-class Project Subject later."),
    section(ids.ecosystem, ids.projects, 50, "intro", "More Than One Robot",
      "A useful robot may not need to do everything.\n\nA household can make more sense as a small ecosystem: different robots with different capabilities, sharing information and helping one another where useful."),
    section(ids.projectsCta, ids.projects, 60, "cta", "What makes something Myomaton?", undefined, { actionId: actions[1] }),
    section(ids.principlesHero, ids.principles, 0, "hero", "Principles",
      "Practical robotics should remain useful, understandable, and yours."),
    section(ids.core, ids.principles, 10, "collection", "Core principles", undefined,
      { itemSource: "inline", items: frozen.sections.find(row => row.id === "1d8815d4-147a-4f27-8e2b-65ca703e024e")!.content.items },
      "grid", { columns: 3 }),
    section(ids.ownership, ids.principles, 20, "intro", "Ownership matters",
      "A personal robot should remain useful because you own it, not because a subscription remains active or somebody else’s service keeps granting permission.\n\nCloud systems and AI can add capability, but basic ownership and usefulness should not depend on them."),
    section(ids.complexity, ids.principles, 30, "intro", "Complexity has a cost",
      "Sophistication is useful when it earns its keep.\n\nMyomaton favors systems that can be understood, repaired, and reasoned about. More complexity should be added when it produces clear practical value, not simply because it is technically possible."),
    section(ids.works, ids.principles, 40, "intro", "Use what works",
      "Local-first does not mean rejecting cloud services, commercial technology, or AI.\n\nThe question is whether a technology improves the system without unnecessarily taking ownership, reliability, or understanding away from the person using it."),
    section(ids.sharing, ids.principles, 50, "intro", "Share what proves useful",
      "Useful ideas should be documented clearly enough that other people can understand them, reproduce them, improve them, or adapt them.\n\nOpen work is most valuable when it is practical, honest about its limits, and grounded in what has actually been demonstrated."),
    section(ids.principlesCta, ids.principles, 60, "cta", "See the projects", undefined, { actionId: actions[2] }),
  ];
}
export const usageRows: Row[] = [
  { id: ids.tabotUsage, asset_id: tabotAssetId, entity_id: ids.tabot },
  { id: ids.abotUsage, asset_id: abotAssetId, entity_id: ids.abot },
].map(row => ({ ...row, web_presence_id: presenceId, entity_type: "section", role: "image",
  configuration: { image: { decorative: false } }, metadata: {}, version: 1 }));
export const navigationRows: Row[] = [
  { id: ids.navHome, name: "Home", target_reference: homeId },
  { id: ids.navProjects, name: "Projects", target_reference: ids.projects },
  { id: ids.navPrinciples, name: "Principles", target_reference: ids.principles },
  { id: ids.navAbout, name: "About", target_reference: ids.about },
].map((row, index) => ({ ...defaults, ...row, label: row.name, navigation_id: navigationId,
  parent_id: null, target_type: "page", sort_order: index * 10 }));
