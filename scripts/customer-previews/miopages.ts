import path from "node:path";
import { manifest } from "../customer-initializers/miopages-c0";
import type { PreviewPlan, PreviewSection } from "./disposable";
import { continuingCarePreview } from "./miopages-continuing-care";
import { serviceLedPreview } from "./miopages-phase1";

const [review, service, experience] = (manifest.offering.payload as { actionIds: string[] }).actionIds;
type Presentation = PreviewSection["configuration"];
const section = (type: PreviewSection["type"], content: Record<string, unknown>, choices: Presentation = {}): PreviewSection => ({ type, content,
  configuration: { ...choices } });
const hero = (eyebrow: string, heading: string, text: string, actionId?: string) => section("hero", { eyebrow, heading, text, ...(actionId ? { actionId } : {}) });
const intro = (heading: string, text: string, actionId?: string, choices: Presentation = {}) => section("intro", { heading, text, ...(actionId ? { actionId } : {}) }, choices);
const group = (heading: string, items: { id: string; heading: string; text: string }[], text?: string, choices: Presentation = {}) => section("collection", { heading, ...(text ? { text } : {}), itemSource: "inline", items }, { composition: "grouped-field", columns: 2, surface: "subtle", ...choices });
const cta = (heading: string, text: string, actionId: string) => section("cta", { heading, text, actionId }, { composition: "conversion-band", surface: "accent" });
const previewNotice = "Preview only · MioPages is not open for service or Review requests. This page describes the service model; no information can be submitted here.";

// Customer-facing service-model proposals, not approved delivery commitments.
// Dates, proof permissions, final prices/terms and workflow readiness stay in the
// operator brief. The compact notice and informational Actions protect preview truth.
export const restrainedMioPagesPreview: PreviewPlan = {
  logo: { file: path.resolve("brand/miopages/MioPagesDV.png"), name: "MioPages horizontal brand lockup", alt: "MioPages" },
  siteConfiguration: { visualDirection: { grammar: { id: "restrained-editorial", version: 1 }, preferences: { density: "comfortable", motion: "off" } } },
  designConfiguration: {
    colors: { background: "#faf8f4", surface: "#f0ece5", text: "#211f2b", muted: "#625e68", accent: "#322f7e", onAccent: "#ffffff", border: "#d8d2c9" },
    typography: { bodyFont: "sans", headingFont: "sans", baseSize: 16, headingScale: 1.75, lineHeight: 1.6 },
    spacing: { unit: 8, section: 40 }, shape: { radius: 6 },
  },
  actionLabels: { [review]: "Explore the free Review", [service]: "Understand the Service", [experience]: "See the Experience" },
  pages: {
    "/": [
      hero("Managed Web Presence", "A clearer web presence. Less to manage.", "MioPages helps established service and technical businesses explain what they do, build confidence, and give prospects a clear next step. One managed service takes care of the web work around your business.", review),
      group("Your expertise deserves a clear explanation", [
        { id: "fit", heading: "For businesses with real expertise", text: "You have customers, useful knowledge, and work worth explaining. Your website may be outdated, unclear, or simply difficult to keep current." },
        { id: "care", heading: "For owners with other work to do", text: "You want a professional presence and someone responsible for its care. You do not want to become a website builder or manage every technical detail." },
      ], undefined, { spacing: "compact" }),
      intro("Launch gives you a foundation. Ongoing keeps it useful.", "Start with a clear explanation of your business, essential Pages, and a practical path to an enquiry. Continue with business updates, useful content improvements, and attention to what needs to happen next.\n\nMioPages combines a focused Launch with one Ongoing relationship, so the understanding built at the start carries forward.", service, { composition: "editorial-row" }),
      group("A sensible way to hand over the web work", [
        { id: "diy", heading: "Less work for you than DIY", text: "Bring your business knowledge and judgment. MioPages organizes the content and presentation around it, using professional design choices you can review." },
        { id: "project", heading: "More continuity than a one-off project", text: "A clear scope and a continuing service reduce the need to coordinate a large website engagement, then find someone else to look after the result." },
      ], undefined, { surface: "default", spacing: "compact" }),
      intro("Experience with businesses that need to be understood", "Historical work across technical, consulting, professional, and service businesses informs the approach: understand the offer, explain it clearly, and make the next step easy to find.", experience, { spacing: "compact" }),
      cta("Start with three useful priorities", "The free Web Presence Review gives you a practical view of what needs attention before you decide on a service.\n\n" + previewNotice, review),
    ],
    "/service": [
      hero("The MioPages service", "One managed service, from Launch onward.", "A focused Launch establishes your presence. Ongoing gives it continuing attention. You bring the knowledge of your business; MioPages takes care of turning it into a useful web presence.", review),
      group("Launch fits the work your business needs", [
        { id: "standard", heading: "Standard Launch", text: "Organize your offer and audience, prepare the core content, choose a professional visual direction, and establish the essential Pages and next steps. Agree any content move, domain coordination, and connections to existing services before work begins." },
        { id: "expanded", heading: "Expanded Launch", text: "For more locations, a larger service catalog, more content to move, or more coordination. It uses the same managed service and supported design choices, with a fixed scope and price confirmed after Review. It does not mean custom software or unlimited design work." },
      ]),
      intro("Ongoing keeps attention on your presence", "Your business changes. Your web presence should keep up. Ongoing brings business updates, content improvements, and clearer enquiry paths into one continuing relationship.\n\nThe aim is to make priorities understandable and changes purposeful, with your business knowledge and approval carried forward. Operation and maintenance support that work; they are not the whole reason for the service.", undefined, { composition: "editorial-row" }),
      group("Clear pricing. Agreed scope.", [
        { id: "launch", heading: "A fixed Launch fee", text: "Standard Launch has a fixed fee. Expanded Launch adds defined scope for supported complexity, with a fixed price confirmed before you proceed." },
        { id: "ongoing", heading: "One monthly Ongoing service", text: "Launch and Ongoing are separate. Applicable third-party costs are disclosed separately, so you can understand the full cost. Final prices will be published when the service opens." },
      ], undefined, { spacing: "compact" }),
      group("A practical division of responsibility", [
        { id: "customer", heading: "You know the business", text: "Supply accurate information, priorities, existing assets, and the account access needed for agreed work. Review the proposed content and presentation, and approve business claims and material changes." },
        { id: "miopages", heading: "MioPages handles the web work", text: "Organize and present the information, coordinate the agreed setup, and carry the knowledge into ongoing care. You review the result without having to specify layouts or technical instructions." },
      ], undefined, { surface: "default", spacing: "compact" }),
      intro("Keep useful connections. Keep the scope clear.", "Booking, contact, publishing, and other external services can be connected where a supported approach exists. Hosting, domains, and email can be coordinated where needed; they support the service rather than define it.\n\nMioPages is a good fit if you want a clear professional presence and continuing care. Bespoke applications, unlimited redesign, full CRM replacement, and broad social-media management are outside the service.", undefined, { width: "reading", spacing: "compact" }),
      intro("Your business stays yours", "Keep ownership of your presence and a clear path to leave. Account responsibilities and handover arrangements are agreed before work starts. Stay because the service remains useful, without lock-in.", undefined, { width: "reading", spacing: "compact" }),
      cta("Find the right scope before you commit", "Start with the free Review. Understand the priorities, check the fit, and decide whether Standard or Expanded Launch makes sense.\n\n" + previewNotice, review),
    ],
    "/experience": [
      hero("Experience and judgment", "Business understanding comes before the website.", "MioPages draws on historical business-site experience across technical, consulting, professional, and service organizations. That experience informs how we explain an offer, organize useful information, and help visitors find their next step."),
      group("What that experience brings to the service", [
        { id: "clarity", heading: "Respect for the subject", text: "Complex services need accurate explanation. The work starts with understanding what the business does, who it serves, and what a prospective customer needs to know." },
        { id: "judgment", heading: "Practical presentation", text: "Content, design, and navigation should help someone make sense of the business. The aim is a clear, credible presence rather than design complexity for its own sake." },
      ], undefined, { spacing: "compact" }),
      intro("Selected historical work", "Space is reserved for reviewed snapshots of TSG Performance, Ragan Design Group, and Theia LLC. Each will describe the business context and verified contribution once publication permission is confirmed.\n\nThese names are historical example candidates, not endorsements. No client imagery or results are presented here.", undefined, { width: "reading", spacing: "compact" }),
      intro("MioPages puts the approach into practice", "This presence is an early example of the managed approach. Historical experience informs the judgment behind it; it is separate from results produced by the new MioPages service.", service, { composition: "editorial-row", spacing: "compact" }),
      cta("Put the attention on your business", "See how the service brings your business knowledge, a focused Launch, and continuing care together.\n\n" + previewNotice, service),
    ],
    "/review": [
      hero("Free Web Presence Review", "Find the next useful step for your web presence.", "Get a practical view of what your presence explains well, what may be getting in the way, and roughly three priorities worth addressing. Useful clarity before you decide whether MioPages is right for you."),
      group("What we look at. What you take away.", [
        { id: "look", heading: "Your business and current presence", text: "What you offer, who you serve, your website and public profiles, the next step you want visitors to take, and the problem that matters most to you." },
        { id: "return", heading: "A short, useful assessment", text: "What we understand about the business, apparent obstacles, roughly three useful priorities, and a recommended next path. The Review can also conclude that MioPages is not a fit." },
      ]),
      intro("Enough information to make it useful", "Share your name and contact details, a brief explanation of the business, existing website or profile links, and your main concern. Mention any important account or system constraints.\n\nThe target is about two business days once the minimum information is available. The Review is a concise assessment, not a full strategy or custom consulting engagement.", undefined, { width: "reading", spacing: "compact" }),
      group("Choose the next step with a clearer view", [
        { id: "conversation", heading: "A short conversation", text: "Talk through a priority or an unanswered question before deciding what to do." },
        { id: "onboarding", heading: "Continue onboarding", text: "Add the business information needed to shape and review a proposal. Self-service is the secondary path once available." },
        { id: "launch", heading: "Confirm the Launch scope", text: "Establish whether Standard or Expanded Launch fits, and confirm the scope and price before proceeding." },
      ], undefined, { surface: "default", spacing: "compact" }),
      cta("A useful first step, without a commitment", "The Review is designed to be useful whether or not you choose MioPages.\n\n" + previewNotice, service),
    ],
  },
};
export const phase1MioPagesPreview = serviceLedPreview(restrainedMioPagesPreview);
export const mioPagesPreview = continuingCarePreview(phase1MioPagesPreview);
