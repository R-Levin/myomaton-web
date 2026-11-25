import type { PresenceWorkflowOperations, WorkflowRun } from "../../lib/platform/intake/presence-workflow";

export const workflowFixture: PresenceWorkflowOperations = {
  mode: "fixture",
  async run(run, retain) {
    const result = fixture(run);
    const bytes = Buffer.from(JSON.stringify(result));
    await retain(bytes);
    return JSON.parse(bytes.toString("utf8"));
  },
  async recover(_run, bytes) { return JSON.parse(bytes.toString("utf8")); },
};

function fixture({ input, work }: WorkflowRun) {
  const originalSource = input.evidence.find(source => source.kind === "owner-confirmed") ?? input.evidence[0];
  const source = input.knowledgeReassessment ? input.evidence.find(source => source.reference.startsWith("canonical:knowledge/"))!
    : input.evidence.find(source => source.kind === "owner-confirmed") ?? input.evidence[0];
  const sourceIds = [source.id];
  const correction = input.corrections.find(item => item.finding.id === "existing-website");
  const visitorPriority = input.knowledgeReassessment?.confirmations[0]?.value ?? correction?.text ?? "Learn what the business offers and how to get in touch.";
  const anchor = { label: "Discuss your project", kind: "request-contact", destination: null };
  const sitePages = ["/", "/project"];
  switch (work.operation) {
    case "research":
      return [{ id: "fixture-research", kind: "public-research", label: "Recorded transport example", date: "2026-11-15",
        reference: "https://example.org/", content: "This recorded example represents a research result. No website was contacted." }];
    case "report":
      return { title: "Business understanding", summary: "This local example uses the saved business brief to make two findings available for correction.",
        // An open correction: the recorded example lists its first sentence, in the correction's own words, as the fact it states.
        ...(input.openCorrections?.length && { correctionFacts: input.corrections.filter(item => input.openCorrections!.includes(item.finding.id))
          .map(item => ({ findingId: item.finding.id, statement: item.text.split(/(?<=[.!?])\s/u)[0], publicUse: true })) }),
        findings: [
          { id: "business-offer", heading: "What the business offers", body: "Launch establishes a managed site. Ongoing keeps it useful as the business changes.",
            status: source.kind === "owner-confirmed" ? "established" : "proposed", sourceIds: [originalSource.id] },
          { id: "existing-website", heading: "What the next visitor should do", body: visitorPriority, status: "proposed", sourceIds },
        ] };
    case "direction":
      return { positioning: "One managed Web Presence service", approach: visitorPriority,
        visitorDecisions: ["Understand the managed offer", "Decide whether to discuss a project"], sourceIds };
    case "blueprint":
      return {
        pages: [{ path: "/", label: "Home", purpose: "Explain the offer", sourceIds,
          ...(input.knowledgeReassessment && { change: "retain", changeReason: "Recorded fixture decision: retain the existing Home verbatim." }) },
          { path: "/project", label: "Project conversation", purpose: "Prepare the first conversation", sourceIds,
            ...(input.knowledgeReassessment && { change: "revise", changeReason: "Recorded fixture decision: revise the conversation Page using the confirmed correction." }) }],
        navigation: sitePages,
        articles: [{ title: "What to have ready", question: "What helps a first website conversation?", target: "/project", sourceIds }],
      };
    case "page": {
      const home = work.path === "/";
      return { path: work.path, heading: home ? "A website that keeps up" : "Prepare for your first conversation",
        searchTitle: home ? "Managed Web Presence" : "Discuss your website project",
        searchDescription: home ? "Launch and manage a website with a clear next step." : "Get ready to talk about your next website.",
        sections: [{ heading: home ? "A useful next step" : "What to bring", body: visitorPriority, sourceIds,
          visual: { status: "text-only", purpose: "Make the next step clear", brief: "Set the answer in a short text block.", altIntent: "Heading and text carry the meaning." } }],
        actions: [anchor, { label: home ? "Prepare the conversation" : "See how it works", kind: "navigate", destination: home ? "/project" : "/" }],
        internalLinks: [home ? "/project" : "/"],
      };
    }
    case "editorial":
      return { summary: "Local fixture check. The planned conversation cannot accept an inquiry.",
        concerns: input.revisionRequest ? [] : [{ path: "/project", concern: "Clarify what an existing-site visitor should bring." }] };
  }
}
