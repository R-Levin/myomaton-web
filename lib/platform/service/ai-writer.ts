import { fingerprint } from "../canonical/model";
import { coreAuthoringInstructions } from "../intake/core-authoring-instructions";
import { meteredPresenceWorkflow, type ResponsesRates, type ResponsesTransport, type WorkflowUsageScope } from "../intake/intelligent-responses";
import { artifactSchemas, creativePageSchema, designedDirectionSchema, readBlueprint, readDirection, readPage, readReport, strategyBlueprintSchema,
  type PresenceEvidence } from "../intake/presence-workflow-artifacts";
import { bindCitations } from "../intake/presence-workflow-provider";
import type { KnownItem, KnownOffering } from "../knowledge/account";
import type { PageContent, SitePlan, WriteInput, Writer } from "./cycle";
import type { Evidence } from "./evidence";

/**
 * The engine's real writer (rebuild plan, milestone 1): Core's AI, through the kept Responses
 * connection. Every call is priced and recorded in the usage ledger and stops at its cap, which
 * is the Account's budget. The AI cites only the Account's own Knowledge, and each answer is
 * checked before it becomes a proposed Version. Nothing here is specific to any one Client.
 */
export type AiWriterConfig = {
  account: { webPresenceId: string; managedSiteId: string };
  ledgerDirectory: string; rates: ResponsesRates; transport: ResponsesTransport;
  /** The Account's budget: requests, generations, tokens and money, enforced at every call. */
  budget: WorkflowUsageScope; outputLimit: number;
  /** Keeps each checked answer (outside Git), so the run's work survives the preview it ran in. */
  retain?: (entry: { at: string; kind: string; path?: string; requests: string[]; answer: unknown }) => Promise<void>;
};

/** The Account's Knowledge as the sources the AI may cite: the Client's confirmed word, or proposed. */
export function knowledgeSources(knowledge: readonly unknown[]): PresenceEvidence[] {
  return knowledge.map((item, index) => {
    if (item && typeof item === "object" && "key" in item) {
      const known = item as KnownItem;
      return { id: "knowledge:" + known.key, kind: known.status === "confirmed" ? "owner-confirmed" as const : "customer-unconfirmed" as const,
        label: known.kind + (known.forWebsite ? "" : " (not for the website)"), reference: "Account Knowledge", date: null, content: known.value };
    }
    const offering = item as KnownOffering;
    return { id: "offering:" + (offering.name ?? index), kind: offering.status === "confirmed" ? "owner-confirmed" as const : "customer-unconfirmed" as const,
      label: "Offering " + offering.name, reference: "Account Offering", date: null, content: JSON.stringify(offering) };
  });
}

/** The Account's Evidence as sources the AI may cite. Only the Client's own approved word can support an established finding. */
export function evidenceSources(evidence: readonly Evidence[]): PresenceEvidence[] {
  return evidence.map(item => ({ id: "evidence:" + item.id, kind: item.standing === "client" ? "owner-confirmed" as const : "service-direction" as const,
    label: item.label + (item.forWebsite ? "" : " (not for the website)"), reference: item.reference, date: item.date, content: item.content }));
}

const stage = { report: "report", direction: "direction", "site-plan": "blueprint", page: "page" } as const;

export function createAiWriter(config: AiWriterConfig): Writer {
  const dispatch = meteredPresenceWorkflow(config.ledgerDirectory, config.rates, config.transport, config.budget, config.outputLimit);
  const ownerDigest = fingerprint(config.account);
  return {
    async write(input: WriteInput) {
      const known = knowledgeSources(input.knowledge), gathered = evidenceSources(input.evidence ?? []);
      const sources = [...known, ...gathered], ids = sources.map(source => source.id);
      const plan = input.sitePlan, paths = plan?.pages.map(entry => entry.path) ?? [];
      const schema = input.kind === "report" ? artifactSchemas.report : input.kind === "direction" ? designedDirectionSchema
        : input.kind === "site-plan" ? sitePlanSchema(input) : pageSchema(input.page!.path);
      const payload = { knowledge: known.map(({ id, kind, label, content }) => ({ id, standing: kind === "owner-confirmed" ? "confirmed" : "proposed", label, content })),
        ...(gathered.length && { evidence: gathered.map(({ id, kind, label, date, content }) => ({ id, standing: kind === "owner-confirmed" ? "client-approved" : "gathered", date, label, content })) }),
        ...(input.report !== undefined && { report: input.report }), ...(input.direction !== undefined && { direction: input.direction }),
        ...(plan && { sitePlan: plan }), ...(input.page && { page: input.page }),
        ...(input.previous !== undefined && { previous: input.previous }), ...(input.requests.length && { requests: input.requests }) };
      const instructions = [coreAuthoringInstructions(stage[input.kind]),
        "Cite only the supplied knowledge and evidence ids. Knowledge marked proposed is not yet confirmed by the Client: never present it as established.",
        gathered.length ? "Evidence is the Client's fuller material: their approved documents and recorded direction, each dated. Use all of it, not only the short Knowledge entries. " +
          "Later direction from the Client overrides earlier material, and the Knowledge is their current word: where sources disagree, follow the latest and do not repeat the superseded view. " +
          "Describe the business as it stands now; do not narrate earlier versions, corrections or how the understanding changed. " +
          "Evidence marked gathered is not the Client's confirmed word." : "",
        "Knowledge or evidence not for the website informs your understanding but must not appear in site copy.",
        input.requests.length ? "Rework the previous version to answer each request, in the requester's own words where they give them; keep what is still right." : "",
        input.page ? `Write only the page ${JSON.stringify(input.page.path)}: ${input.page.purpose}` : ""].filter(Boolean).join("\n\n");
      const request = { model: config.rates.model, instructions, input: JSON.stringify(payload),
        text: { format: { type: "json_schema", name: "core_" + stage[input.kind], strict: true, schema: bindCitations(schema, ids) } } };
      const output = await dispatch({ ownerDigest, workDigest: fingerprint({ kind: input.kind, payload }) }, request);
      const answer = checked(input, output, sources, ids, paths);
      await config.retain?.({ at: new Date().toISOString(), kind: input.kind, ...(input.page && { path: input.page.path }), requests: input.requests, answer });
      return answer;
    },
  };
}

/**
 * The Site plan asks, for each page, the decision brief that says what it must achieve: the
 * Report findings, Direction steps and Knowledge it rests on.
 */
function sitePlanSchema(input: WriteInput) {
  const report = input.report as { findings?: { id: string }[] } | undefined, direction = input.direction as { visitorDecisions?: string[] } | undefined;
  if (!report?.findings?.length || !direction?.visitorDecisions?.length) throw Error("The Site plan needs the confirmed Report and Direction");
  const schema = structuredClone(strategyBlueprintSchema) as unknown as { properties: { pages: { items: { properties: {
    decisionBrief: { properties: Record<string, unknown> } } } } } };
  const fields = schema.properties.pages.items.properties.decisionBrief.properties;
  schema.properties.pages.items.properties.decisionBrief.properties = { ...fields,
    findingIds: { type: "array", description: "Use IDs from report.findings.", items: { type: "string", enum: report.findings.map(item => item.id) } },
    claimIds: { type: "array", description: "Use only the supplied knowledge and evidence ids.", items: { type: "string",
      enum: [...knowledgeSources(input.knowledge), ...evidenceSources(input.evidence ?? [])].map(item => item.id) } },
    directionSteps: { type: "array", description: "Use zero-based indices into direction.visitorDecisions.",
      items: { type: "integer", enum: direction.visitorDecisions.map((_, index) => index) } } };
  return schema;
}

/** A page in Core's block format, fixed to the one page asked for. */
function pageSchema(path: string) {
  const schema = structuredClone(creativePageSchema) as unknown as { properties: Record<string, unknown> };
  schema.properties.path = { type: "string", enum: [path] };
  return schema;
}

/** Each answer is checked before it can become a proposed Version. */
function checked(input: WriteInput, output: unknown, sources: PresenceEvidence[], ids: string[], paths: string[]): unknown {
  switch (input.kind) {
    case "report": return readReport(output, sources, true);
    case "direction": return readDirection(output, ids, true);
    case "site-plan": {
      const blueprint = readBlueprint(output, ids, true, true);
      // Each page keeps the decision brief that says what it must achieve; Core writes the page from it.
      const plan: SitePlan = { pages: blueprint.pages.map(page => ({ path: page.path, label: page.label, purpose: page.purpose,
        inMenu: blueprint.navigation.includes(page.path), sourceIds: page.sourceIds,
        ...("decisionBrief" in page && { decisionBrief: page.decisionBrief }) })) };
      if (!plan.pages.some(page => page.path === "/")) throw Error("The Site plan needs a Home page");
      return plan;
    }
    case "page": return readPage(output, input.page!.path, paths, ids, {}, true, false, true) as unknown as PageContent;
  }
}
