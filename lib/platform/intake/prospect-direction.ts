import type { Answers } from "./model";

const routes = {
  review: {
    action: "Request a Free Review",
    heading: "See what your Web Presence needs",
    body: "Get an outside view of what visitors can understand today, what may be getting in their way, and which improvements are worth considering first.",
  },
  conversation: {
    action: "Talk about getting started",
    heading: "Talk through a new site or an existing one",
    body: "Tell us what you want your site to help customers do. If you already have a site, bring its address so we can discuss what to keep and what needs attention.",
  },
};

/** Planning projection. The copy is editorial and destinations remain under review. */
export function prospectDirection(answers: Answers) {
  const emphasis = answers.sitePriority === "Conversation first" ? "conversation"
    : answers.sitePriority === "Review first" || answers.visitorRoute === "Request a Free Review" ? "review"
    : answers.visitorRoute === "Start a conversation" ? "conversation" : null;
  if (!emphasis) return null;
  const primary = routes[emphasis];
  const secondary = routes[emphasis === "review" ? "conversation" : "review"];
  return {
    primary, secondary,
    finding: emphasis === "review"
      ? "Lead with a useful assessment for people who are still deciding what to change."
      : "Lead with a conversation for people who already want help and are ready to discuss the work.",
    home: {
      title: "MioPages",
      heading: "A managed Web Presence for your business",
      body: "MioPages is developing one managed service for businesses that want their website and ongoing improvements handled together.",
      nextStep: primary,
    },
    service: {
      title: "Managed Web Presence",
      heading: "From Launch to Ongoing care",
      body: "Launch sets up or updates the site around what customers need to know and do. Ongoing care keeps the information useful and gives improvements a place in the service.",
      nextStep: primary,
    },
    open: "Confirm where each action leads and who follows up before enabling it. Review what evidence can support claims about results.",
  };
}
