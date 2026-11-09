import type { PreparedSource, PreparedUnderstanding } from "../../lib/platform/intake/adaptive";
import { mioPagesIntakeOwner } from "../../lib/platform/intake/availability";
import { approvedReviewDigest, loadC0Review } from "../operator-overview/c0-review";

const walkthrough = "docs/c0-adaptive-onboarding-walkthrough.md";
const benchmark = "docs/fictional-customer-2-tree-service-onboarding-scenario.md";
const hostShop = "https://my.miopages.com/login";

export async function prepareC0(): Promise<PreparedUnderstanding> {
  const review = await loadC0Review(mioPagesIntakeOwner);
  const earlierReview: PreparedSource[] = review ? [
    { id: "review-answers", title: "October 14 Free Review interview", kind: "Earlier Review answer",
      reference: "Retained C0 human Free Review submission · foundational-intake/1", date: review.submittedAt.slice(0, 10),
      detail: "Selected original business answers. Private contact fields omitted. This is a separate, later interview; its answers record what was supplied at the time.",
      entries: review.answers.map(answer => ({ label: answer.question, value: Array.isArray(answer.answer) ? answer.answer.join("; ") : answer.answer })) },
    { id: "review-assessment", title: "Free Review assessment · approved, undelivered", kind: "Earlier Review assessment",
      reference: "Retained C0 Draft D revision 3 · " + approvedReviewDigest, date: review.approvedAt.slice(0, 10),
      detail: "The exact approved text is retained as earlier analysis and recommendations. The approval was for the Review; delivery and approval of its underlying business claims are separate.",
      entries: review.sections.map(section => ({ label: section.title, value: section.paragraphs.join("\n\n") })) },
  ] : [];
  return {
    scenario: "c0", name: "MioPages · Customer 0",
    context: "Founder-led local rehearsal. The founder may develop strategy with ChatGPT and retains the final decisions. The approved October discovery, public site inventory and later Free Review each carry their own provenance.",
    summary: "The confirmed direction is one managed Web Presence service for established local service, professional and technical firms. Launch leads into Ongoing. The new marketing excludes all legacy offers, and existing customers retain the separate HostShop sign-in.",
    scopeSummary: "Use the founder’s established Launch and Ongoing direction. Explore Standard scope first and review expanded migration or integration separately. Earlier Review evidence keeps its own approval and delivery status.",
    sources: [
      { id: "discovery", title: "October 5–6 business discovery", kind: "Owner-confirmed",
        reference: "docs/miopages-c0-business-brief.md · approved three-pass synthesis", date: "October 5–6, 2026",
        detail: "Approved synthesis. Some original prompts survive; the complete interview transcript is unavailable.",
        entries: [{ label: "Offer", value: "One managed Web Presence service, beginning with Launch and continuing with Ongoing." },
          { label: "Business intent", value: "Help expertise-led US businesses explain their work and keep their Web presence useful with less administrative burden." }] },
      { id: "site", title: "November 9 public site inventory", kind: "Website observation", reference: walkthrough + " · The existing site review", date: "November 9, 2026",
        detail: "Read-only observation of miopages.com. Existing copy shows what visitors see; it can be stale.",
        entries: [{ label: "Legacy offers", value: "The old website presents separate website, hosting/email and support services. The sitemap still exposes a QR/self-managed offer." },
          { label: "Existing-customer utility", value: "The existing hosting-account button reaches the separate HostShop sign-in at " + hostShop + "." }] },
      ...earlierReview,
      { id: "direction", title: "November 9 launch decision", kind: "Owner-confirmed", reference: "GitHub Issue #10 · owner decisions, November 9", date: "November 9, 2026",
        detail: "Approved catalog transition and target audience direction. The expanded local-service market remains a hypothesis to validate.",
        entries: [{ label: "Catalog and audience", value: "Retire every legacy offering. Target established local service and trade firms alongside professional and technical firms." },
          { label: "HostShop", value: "Preserve only the verified existing-customer login as the legacy service-related destination: " + hostShop + "." }] },
    ],
    reconciliation: { title: "The current direction differs from earlier evidence", sources: ["site", ...(review ? ["review-answers"] : []), "direction"], status: "conflict",
      detail: "The old site still lists offers the owner has retired." +
        (review ? " The October 14 interview mentioned startups and small businesses. The current direction focuses on established local service, professional and technical firms." : "") +
        " Carry forward the approved direction and flag any consequential correction or transition dependency." },
    reviewGap: review
      ? "The earlier Review assessment is approved and undelivered in the retained record. Other clarifications and delivery evidence have not been established."
      : "The October 14 interview and approved assessment are known historical records, but the protected local copy could not be verified for this run.",
    offeringPrompt: "Working scope from the C0 business brief and launch-readiness contract: Standard Launch establishes a managed site with core content and a visitor action. Expanded Launch is separately scoped. Ongoing handles routine care, updates and improvement. These are service directions. The local tool implements intake persistence; delivery, commercial commitments and launch readiness remain separate. Focus on what customers receive and what moves a job outside Standard.",
    proposal: "Explain the managed relationship and customer responsibilities on Home and Service. Use a text-led Experience page until relevant proof is cleared. Present a Free Review as a candidate entry and keep HostShop separate.",
    fit: "A likely fit is an established local service, professional or technical firm with real expertise and limited time for site administration. Treat one-off DIY or out-of-scope integrations as scope review, and validate the buying trigger and handoff.",
    inventory: [
      { item: "Separate legacy offers, including QR/self-managed websites", disposition: "Exclude from the new service marketing · owner-approved", reference: "November 9 launch decision" },
      { item: "HostShop existing-customer sign-in · " + hostShop, disposition: "Keep the existing account utility · owner-approved", reference: "November 9 decision and public website observation" },
      { item: "Old URLs, links and existing commitments", disposition: "Investigate transition separately", reference: "November 9 site inventory" },
    ],
  };
}

export function prepareC2(): PreparedUnderstanding {
  return {
    scenario: "c2", name: "Tree service · Fictional Customer 2",
    context: "Fictional benchmark for ordinary managed onboarding. It describes an outdated website without a supplied URL. No real customer or site was inspected.",
    summary: "The fictional site describes preventive and emergency tree work for homeowners and small businesses in Bucks and Montgomery Counties, with yard clearing and some seasonal services. These are historical website claims awaiting confirmation.",
    foundationGap: "For this direct-start run, the site tells us what was advertised. It does not tell us the main business outcome for the replacement site.",
    scopeSummary: "Consider one managed replacement site for the described service area. The proposed scope is to clarify tree care and emergency work and give people a suitable way to get in touch. Confirm the priority and treat unverified claims and old URLs as review items.",
    sources: [{ id: "site", title: "Outdated tree-service website · scenario notes", kind: "Website observation", reference: benchmark,
      detail: "Owner-supplied description of fictional site observations. All business claims require confirmation.",
      entries: [{ label: "Audience and area", value: "Homeowners and small businesses in Bucks and Montgomery Counties, Pennsylvania." },
        { label: "Offer priorities", value: "Primary: preventative tree care and emergency service. Secondary: yard clearing. Seasonal: firewood and winter plowing." },
        { label: "Contact and proof", value: "The site describes emergency calls, ordinary requests by phone/text/form/email, free estimates, 10+ years in business and potential bonding/insurance proof. Actual contacts, availability and proof are missing." },
        { label: "Content and operations", value: "No blog or content-marketing function. The scenario mentions no CRM and lists payment methods, which do not imply a need for CRM or ecommerce." }] }],
    reconciliation: { title: "The current offer may differ from old website copy", sources: ["site"], status: "needs confirmation",
      detail: "Check which advertised services and priorities still apply. Exact jobs, service boundaries and emergency availability are unknown." },
    reviewGap: "No actual Free Review answers, follow-ups or delivered assessment were supplied for this fictional benchmark. A direct-start customer can legitimately have no prior Review.",
    offeringPrompt: "Use the existing description of preventative care and urgent work. Describe specific jobs, exclusions and how a caller is triaged. Keep any out-of-hours or response commitment open until verified.",
    proposal: "Consider a replacement site with distinct tree-care and emergency paths, a routine estimate route and new useful FAQs or seasonal education. Confirm actual routing, coverage and proof before marketing claims.",
    fit: "A likely routine visitor wants a specific tree-care estimate within the service area. An urgent visitor needs a verified call path and out-of-hours guidance. Jobs outside the real service area or capability need clear boundaries.",
    inventory: [{ item: "Outdated site without a content section", disposition: "Proposed replacement · confirm useful content and URL continuity", reference: benchmark }],
  };
}
