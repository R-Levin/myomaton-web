/**
 * The design rules for every site Core designs (the Principal, Nov 27: approved in
 * docs/design-rules-proposal.md). This is service Knowledge, kept in one place: Core is told these
 * rules, the checks enforce them, and docs/design-rules.md is the same list for people to review
 * (a test keeps the two identical). Code cites a rule by number and adds no rules of its own.
 * Everything else (colour, corners, layout, section order, density, number of pictures, typefaces
 * within the licensed set) is Core's design decision.
 */
export const designRules = [
  { number: 1, name: "Safe", rule: "The site loads nothing from outside and runs nothing Core wrote; styling never reaches WordPress admin.", reason: "Security." },
  { number: 2, name: "Faithful", rule: "Every word on the page is Core's approved copy, unchanged; styling adds no text.", reason: "Core writes, the Specialist approves (Part 1)." },
  { number: 3, name: "Structured", rule: "One page title per page, headings in order, every picture described for screen readers.", reason: "Accessibility and search; legal exposure." },
  { number: 4, name: "Readable", rule: "Text meets standard contrast (WCAG AA) against its background, and body text is at a readable size on phones.", reason: "Visitors; accessibility." },
  { number: 5, name: "Reachable", rule: "Every approved word and link can be reached on desktop and phone; the menu works by touch and keyboard.", reason: "Visitors; accessibility." },
  { number: 6, name: "Fits the phone", rule: "No sideways scrolling of the page; nothing pinned covers more than a small part of a phone screen; buttons and links are big enough to tap.", reason: "Visitors." },
  { number: 7, name: "Honest about gaps", rule: "FPO frames and missing-material notices stay clearly visible and recognisable.", reason: "Part 1 #12." },
  { number: 8, name: "Licensed", rule: "Fonts and pictures come from licensed sources, with credits recorded.", reason: "Legal." },
  { number: 9, name: "Respectful of motion", rule: "Animation stops for visitors who ask their device for reduced motion.", reason: "Accessibility." },
] as const;

/** The rules as Core reads them. */
export const designRulesText = "Design rules (the only limits; everything else is your design decision, informed by your research and the Client's taste): " +
  designRules.map(r => `${r.number}. ${r.name}: ${r.rule}`).join(" ");
