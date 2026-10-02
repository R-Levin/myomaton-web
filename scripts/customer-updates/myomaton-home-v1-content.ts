// Approved Customer #1 transition input. Never imported by seed, bootstrap or runtime.
// These UUIDs are reserved operator identities, independent of display copy.
export const homeV1Ids = {
  ownership: "7cb671bc-8d5b-423e-bd17-87922bd5f9b0",
  projects: "c6cf2724-3fc4-49ab-9ccd-134ab614c423",
  ecosystem: "9d7472fd-f453-4690-8596-fd3e57c9ddca",
  principles: "1d8815d4-147a-4f27-8e2b-65ca703e024e",
  reality: "07d7c37b-4345-4721-9f70-4a8c8b935d53",
  sharing: "e79a7b8f-a8f9-4da7-9c7a-a8424464d4e3",
  tabot: "5a07b8d7-a388-48c4-9bc5-9b4b575d33cd",
  abot: "845c03b7-cd6d-4cc4-b6a5-de98893cc057",
  projectsAction: "af558c75-18b1-44b5-9c79-d14a7a66e13f",
} as const;

export const projectDrafts = [
  { id: homeV1Ids.tabot, name: "TaBot", description: "A practical rolling robot exploring useful household behavior — following, approaching when called, navigating real spaces, managing its own power, and eventually working alongside other robots." },
  { id: homeV1Ids.abot, name: "A-Bot", description: "An attendant robot concept that helps other robots stay useful — beginning with the practical problem of connecting, charging, and servicing smaller resident robots." },
];

export const projectsActionDraft = {
  id: homeV1Ids.projectsAction, name: "See what we're building", type: "section",
  label: "See what we're building", destination: "#current-projects",
};

export function homeV1Sections(ids: { hero: string; introduction: string; cta: string; action: string; tabot: string; abot: string }) {
  return [
    { id: ids.hero, name: "Hero", type: "hero", variant: "default", configuration: {}, content: {
      heading: "Myomaton", eyebrow: "My Own Robot",
      text: "What should a useful personal robot actually be?\n\nMyomaton explores practical robots that are affordable, understandable, repairable, and genuinely useful — machines people can adapt, maintain, and keep using on their own terms.",
      actionId: ids.action,
    } },
    { id: homeV1Ids.ownership, name: "Ownership", type: "intro", variant: "stack", configuration: { anchor: "about" }, content: {
      heading: 'What does "My Own Robot" mean?',
      text: "A robot you can actually call your own.\n\nA useful personal robot should not stop being yours because a subscription expires, a cloud service disappears, or the manufacturer decides the hardware is finished.\n\nMyomaton explores robots that can be understood, repaired, modified, and kept useful over time. Cloud services and AI can add capability, but ownership should not depend on them.",
    } },
    { id: ids.introduction, name: "Introduction", type: "intro", variant: "split-text-first", configuration: {}, content: {
      heading: "Build. Test. Learn. Repeat.",
      text: "Useful robots have to work in the physical world.\n\nSo we build things, run them, find out what fails, change them, and try again. Navigation, sensing, charging, mechanical design, software, and interaction all look a little different once the robot leaves the workbench.\n\nThe machines shown here are working experiments. The point is not to make every prototype look finished. The point is to learn what actually works.",
    } },
    { id: homeV1Ids.projects, name: "Current Projects", type: "collection", variant: "grid", configuration: { anchor: "current-projects", columns: 2 }, content: {
      heading: "Current Projects", itemSource: "subjects", items: [
        { id: "project-001", subjectId: ids.tabot }, { id: "project-002", subjectId: ids.abot },
      ],
    } },
    { id: homeV1Ids.ecosystem, name: "Robot Ecosystem", type: "intro", variant: "stack", configuration: {}, content: {
      heading: "More Than One Robot",
      text: "A useful robot may not need to do everything.\n\nA household can make more sense as a small ecosystem: different robots with different capabilities, sharing information and helping one another where useful.\n\nMyomaton is exploring both the individual machines and the common system that lets simpler and more capable robots work together.",
    } },
    { id: homeV1Ids.principles, name: "Principles", type: "collection", variant: "grid", configuration: { columns: 3 }, content: {
      heading: "What makes something Myomaton?", itemSource: "inline", items: [
        { id: "principle-001", heading: "Affordable", text: "Practical robotics becomes much more interesting when ordinary hardware can participate." },
        { id: "principle-002", heading: "Understandable", text: "The system should be possible to inspect, explain, modify, and repair." },
        { id: "principle-003", heading: "Repairable", text: "Useful machines should not become disposable because one component or service disappears." },
        { id: "principle-004", heading: "Local-first", text: "Core behavior and safety should remain close to the robot rather than depending unnecessarily on remote services." },
        { id: "principle-005", heading: "No mandatory cloud or subscription", text: "Cloud and AI services can add capability, but basic ownership and usefulness should not depend on continuing payments or Internet access." },
      ],
    } },
    { id: homeV1Ids.reality, name: "Physical Experimentation", type: "intro", variant: "stack", configuration: {}, content: {
      heading: "Reality is an excellent design review",
      text: "Floors have thresholds. Rooms have awkward corners. Wireless connections fail. Batteries run down. People walk through the path you carefully planned.\n\nReal environments have an efficient way of exposing assumptions.\n\nThat is why Myomaton is built around physical experimentation rather than demonstrations that work only under ideal conditions.",
    } },
    { id: homeV1Ids.sharing, name: "Sharing", type: "intro", variant: "stack", configuration: {}, content: {
      heading: "Share what proves useful",
      text: "Not every experiment deserves to become a project.\n\nThe things that do prove useful should be explained well enough that other people can understand them, reproduce them, improve them, or take them somewhere we didn't.\n\nMyomaton is being developed in that spirit: document the work, share the useful parts, and be clear about what has actually been demonstrated.",
    } },
    { id: ids.cta, name: "Primary Call to Action", type: "cta", variant: "default", configuration: {}, content: {
      heading: "See what happens next.",
      text: "Follow the builds, experiments, failures, fixes, and occasional moments when the robot actually does what we hoped it would.",
      // No confirmed canonical YouTube destination was present at review. No URL inferred.
    } },
  ].map((section, index) => ({ ...section, sort_order: index * 10 }));
}
