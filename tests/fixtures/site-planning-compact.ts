export type ProofPage = {
  path: string; title: string; purpose: string; seo: string; refs: number[];
  action: { label: string; kind: "learn" | "compare" | "request-contact"; to: string | null };
  sections: { heading: string; body: string; refs: number[] }[];
};

const section = (heading: string, body: string, ...refs: number[]) => ({ heading, body, refs });
const action = (label: string, kind: ProofPage["action"]["kind"], to: string | null) => ({ label, kind, to });

// Authored examples for sizing and regression only.
export const c0 = {
  positioning: "A managed Web Presence for established small service businesses that want their website to work without managing it themselves.",
  offering: "Start with a Free Web Presence Review or a short conversation. Launch and ongoing care are parts of one managed service.",
  audience: "Small businesses that sell expertise and already have a website they would like to make more useful.",
  refs: [1, 2],
  open: ["What qualifies a business for Launch?", "What criteria determine eligibility for ongoing care?",
    "Where should the Review request and short-conversation actions be routed?"],
  pages: [
    { path: "/", title: "Make your website useful again", purpose: "Explain the managed service and help an existing-site owner choose a first step.",
      seo: "Explore a managed Web Presence for your small business. Start with a Free Review of your current site or a short conversation.",
      refs: [1, 2], action: action("See what the Free Review covers", "learn", "/free-review"), sections: [
        section("Start with the website you have", "If your website no longer explains your work clearly, start by looking at what it already does well and what needs attention. MioPages is developing a managed service for small businesses that want clearer content and a better next step for visitors without taking on website management themselves.", 1, 2),
        section("Choose how to begin", "Use the Free Web Presence Review to understand what to retain or improve before committing. If you would rather talk through the situation first, start with a short conversation about the website and the most important action for its visitors.", 2, 3),
      ] },
    { path: "/free-review", title: "Free Web Presence Review", purpose: "Set expectations before a prospect requests the review.",
      seo: "Learn what to bring to a Free Web Presence Review and how it can clarify what to keep or improve on your existing website.",
      refs: [2, 3], action: action("Request a Free Review", "request-contact", null), sections: [
        section("What to bring", "Have the address of your current website handy. Think of the one action you most want an interested visitor to take, such as starting a conversation. That goal gives the review a focus and helps identify which parts of the current site are already useful.", 2, 3),
        section("What comes after looking at the site", "Discuss access, migration and ongoing support after the website has been reviewed. Those topics depend on what is already there and what needs to change. You can use the review to decide whether a longer conversation is worthwhile.", 2, 3),
      ] },
    { path: "/managed-service", title: "Launch and ongoing care", purpose: "Explain the relationship between Launch and continuing website care without promising eligibility.",
      seo: "Understand how MioPages connects Launch and ongoing care within one managed Web Presence service for small businesses.",
      refs: [1, 2, 3], action: action("Start a conversation", "request-contact", null), sections: [
        section("One managed service", "Launch and ongoing care belong to the same managed Web Presence service. Start by discussing what the website needs to communicate and what prospects should do when they arrive. Then review practical questions about the existing website and what support might be useful.", 1, 3),
        section("Bring your situation to the discussion", "Tell us which website you have now and what outcome you want from it. A first conversation helps identify what to examine. It does not determine eligibility for ongoing care, and Launch qualification criteria are still being worked through.", 2, 3),
      ] },
  ] satisfies ProofPage[],
};

export const c2 = {
  positioning: "Help property owners choose a safe storm-damage assessment or prepare a useful estimate request for routine tree work.",
  offering: "Routine pruning and tree care estimates, storm-damage assessment, and secondary property clearing work.",
  audience: "Homeowners and small-business property managers in Bucks and Montgomery Counties, Pennsylvania.",
  refs: [1, 2],
  open: ["What is the verified urgent contact path?", "What service boundaries, emergency hours and response times can the business confirm?",
    "Which licenses and insurance can be verified?", "Which seasonal services are currently available?"],
  pages: [
    { path: "/", title: "Tree care and storm-damage assessment", purpose: "Help a visitor identify whether they need urgent triage or a routine estimate.",
      seo: "Choose between a storm-damage assessment and an estimate for planned tree care in Bucks or Montgomery County.",
      refs: [1, 2], action: action("Read the storm-damage guidance", "learn", "/storm-damage"), sections: [
        section("When a tree has been damaged", "Storm damage calls for a different conversation from routine pruning. Stay clear of the damaged tree and describe what you can observe from a safe place. The assessment route asks about the location and anything that makes the situation urgent.", 1, 2),
        section("When you are planning tree work", "For routine pruning or tree care, use the estimate guidance. Describe what you want done, where the trees are and any access constraints. Collect photos only where you can do so safely.", 1, 2),
      ] },
    { path: "/storm-damage", title: "Storm damage and safe next steps", purpose: "Triage an urgent situation without advertising unverified response availability.",
      seo: "See what details help with a storm-damage assessment. Emergency response availability and coverage need confirmation.",
      refs: [1, 2], action: action("Request a storm-damage assessment", "request-contact", null), sections: [
        section("Describe the situation from a safe place", "Give the property location and explain what changed during the storm. If you can see from a safe place that a tree or branch is affecting a building or blocking access, include that detail. Do not move closer or put yourself at risk to take a photo.", 2),
        section("Confirm the contact route", "The urgent contact path, hours, response time and exact coverage need to be confirmed. Treat an assessment request as a request for triage and avoid relying on an unverified service promise.", 2),
      ] },
    { path: "/tree-care-estimates", title: "Estimates for routine tree care", purpose: "Help planned-work prospects provide information that supports an estimate.",
      seo: "Prepare a pruning or routine tree care estimate request with property location, photos and details about the work.",
      refs: [1, 2], action: action("Request a tree care estimate", "request-contact", null), sections: [
        section("Describe the trees and the work", "Say which trees need attention and what you are trying to achieve. Include the property location, how someone could reach the trees, and photos taken from a safe spot. Mention whether the request is for one tree or several.", 1, 2),
        section("Explain how the property is used", "Tell us if trees overhang an entrance, parking area or other place people use regularly. That context helps distinguish the planned job from an urgent request and makes the estimate inquiry more useful.", 2),
      ] },
    { path: "/clearing-and-seasonal", title: "Clearing and seasonal services", purpose: "Keep secondary work discoverable and confirm availability before setting expectations.",
      seo: "Ask about yard clearing and seasonal services, including whether the work and property fit the current schedule.",
      refs: [1, 2], action: action("See what to include in an estimate request", "learn", "/tree-care-estimates"), sections: [
        section("Describe the clearing work", "Include the property location, the areas that need attention and whether there are access constraints. If the request includes trees or storm debris, describe the work and avoid photographing unsafe areas.", 1, 2),
        section("Check seasonal availability", "Yard clearing and seasonal work are secondary services. Ask about current availability and what can be included when you describe the project.", 1),
      ] },
    { path: "/service-area", title: "Where to ask about tree work", purpose: "Help visitors check whether their property is in the described service area.",
      seo: "Check the described tree service area in Bucks and Montgomery Counties and see what location details to include.",
      refs: [1, 2], action: action("Prepare a routine estimate request", "learn", "/tree-care-estimates"), sections: [
        section("Share the municipality and county", "The described service area includes Bucks and Montgomery Counties. Give the municipality and county so coverage can be confirmed for the job. Use the storm-damage guidance if the situation is urgent.", 1, 2),
      ] },
  ] satisfies ProofPage[],
};
