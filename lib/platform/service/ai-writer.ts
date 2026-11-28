import { fingerprint } from "../canonical/model";
import { coreAuthoringInstructions } from "../intake/core-authoring-instructions";
import { meteredPresenceWorkflow, type ResponsesRates, type ResponsesTransport, type WorkflowUsageScope } from "../intake/intelligent-responses";
import { artifactSchemas, creativePageSchema, designedDirectionSchema, readBlueprint, readDirection, readPage, readReport, strategyBlueprintSchema,
  type PresenceEvidence } from "../intake/presence-workflow-artifacts";
import { bindCitations } from "../intake/presence-workflow-provider";
import { readSiteFooter, siteFooterSchema } from "./site-footer";
import { applyWordEdits, fillLayout, mendLayout, type Layout, type Piece, type WordEdits } from "./page-words";
import { nativeComponentSchema } from "../intake/presence-native-component";
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
  retain?: (entry: { at: string; kind: string; path?: string; requests: string[]; answer: unknown; digest?: string }) => Promise<void>;
  /** How many answers to this same work were refused before. Each retry is new work for the ledger, which refuses paying twice for the same. */
  refusals?: (digest: string) => Promise<number>;
  /** The outputs of earlier refused answers to this same work, oldest first, re-checked before paying again. */
  refused?: (digest: string) => Promise<unknown[]>;
  /** Reads an Evidence image (a brand asset, a peer site's screenshot). Without it Core reads Evidence as text only. */
  readImage?: (file: string) => Promise<Buffer>;
};

/** The stages that look at Evidence images: the Direction sets the visual design, from the brand and the peer sites. */
const seesImages = new Set<WriteInput["kind"]>(["direction"]);

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
        : input.kind === "site-plan" ? sitePlanSchema(input) : input.grain === "page-layout" ? layoutSchema(input.words!)
        : input.grain === "page-words" ? wordsSchema(input.words!) : pageSchema(input.page!.path);
      const payload = { knowledge: known.map(({ id, kind, label, content }) => ({ id, standing: kind === "owner-confirmed" ? "confirmed" : "proposed", label, content })),
        ...(gathered.length && { evidence: gathered.map(({ id, kind, label, date, content }, index) => ({ id, standing: kind === "owner-confirmed" ? "client-approved" : "gathered", date, label, content,
          ...(input.evidence![index]!.images?.length && seesImages.has(input.kind) && config.readImage && { images: input.evidence![index]!.images!.map(image => image.caption) }) })) }),
        ...(input.report !== undefined && { report: input.report }), ...(input.direction !== undefined && { direction: input.direction }),
        ...(plan && { sitePlan: plan }), ...(input.page && { page: input.page }),
        // A words or layout change sees the page as numbered pieces and their arrangement, not the page itself.
        ...(input.grain && input.grain !== "page" ? { words: input.words, arrangement: input.arrangement, ...(input.example !== undefined && { example: input.example }) }
          : input.previous !== undefined && { previous: input.previous }), ...(input.requests.length && { requests: input.requests }) };
      const instructions = [coreAuthoringInstructions(stage[input.kind]),
        "Cite only the supplied knowledge and evidence ids. Knowledge marked proposed is not yet confirmed by the Client: never present it as established.",
        gathered.length ? "Evidence is the Client's fuller material: their approved documents and recorded direction, each dated. Use all of it, not only the short Knowledge entries. " +
          "Later direction from the Client overrides earlier material, and the Knowledge is their current word: where sources disagree, follow the latest and do not repeat the superseded view. " +
          "Describe the business as it stands now; do not narrate earlier versions, corrections or how the understanding changed. " +
          "Evidence marked gathered is not the Client's confirmed word." : "",
        "Knowledge or evidence not for the website informs your understanding but must not appear in site copy.",
        input.requests.length ? "Rework the previous version to answer each request, in the requester's own words where they give them; keep what is still right." : "",
        input.page ? `Write only the page ${JSON.stringify(input.page.path)}: ${input.page.purpose}` : "",
        input.grain === "page-layout" ? layoutInstructions(input) : input.grain === "page-words" ? wordsInstructions : ""].filter(Boolean).join("\n\n");
      const images = seesImages.has(input.kind) && config.readImage ? await evidenceImagesFor(input.evidence ?? [], config.readImage) : [];
      const request = { model: config.rates.model, instructions,
        input: images.length ? [{ role: "user" as const, content: [{ type: "input_text" as const, text: JSON.stringify(payload) }, ...images] }] : JSON.stringify(payload),
        text: { format: { type: "json_schema", name: "core_" + (input.grain && input.grain !== "page" ? input.grain.replace("-", "_") : stage[input.kind]), strict: true, schema: bindCitations(schema, ids) } } };
      const digest = fingerprint({ kind: input.kind, payload });
      // A paid answer refused only by a check that has since been corrected is taken, not bought again.
      for (const output of [...await config.refused?.(digest) ?? []].reverse()) {
        try {
          const reused = checked(input, output, sources, ids, paths);
          await config.retain?.({ at: new Date().toISOString(), kind: input.kind, ...(input.page && { path: input.page.path }), requests: input.requests, answer: reused });
          return reused;
        } catch { /* still refused */ }
      }
      let answer: unknown, refusal = "";
      // A refused answer gets one more attempt, told why it was refused (as a reviewer would say).
      for (let attempt = 0; ; attempt++) {
        const retry = await config.refusals?.(digest) ?? 0;
        const asked = refusal ? { ...request, instructions: request.instructions + "\n\nYour previous answer to this was refused by Core's check: " +
          refusal + ". Return the complete answer again with that corrected." } : request;
        const output = await dispatch({ ownerDigest, workDigest: retry ? fingerprint({ digest, retry }) : digest }, asked);
        // A refused answer was still paid for: keep it with the reason, so it can be looked at rather than lost.
        try { answer = checked(input, output, sources, ids, paths); break; }
        catch (error) {
          refusal = error instanceof Error ? error.message : "refused";
          await config.retain?.({ at: new Date().toISOString(), kind: input.kind, ...(input.page && { path: input.page.path }), requests: input.requests,
            digest, answer: { refused: refusal, output } });
          if (attempt >= 1 || !config.refusals) throw error;
        }
      }
      await config.retain?.({ at: new Date().toISOString(), kind: input.kind, ...(input.page && { path: input.page.path }), requests: input.requests, answer });
      return answer;
    },
  };
}

/** Each Evidence image, labeled with the Evidence it belongs to, as the AI's image input. */
export async function evidenceImagesFor(evidence: readonly Evidence[], read: (file: string) => Promise<Buffer>) {
  const parts: ({ type: "input_text"; text: string } | { type: "input_image"; image_url: string; detail: "high" })[] = [];
  for (const item of evidence) for (const image of item.images ?? []) {
    const type = /.png$/iu.test(image.file) ? "image/png" : /.jpe?g$/iu.test(image.file) ? "image/jpeg" : null;
    if (!type) throw Error("Evidence images are PNG or JPEG: " + image.file);
    parts.push({ type: "input_text", text: `Image from evidence:${item.id}: ${image.caption}` },
      { type: "input_image", image_url: `data:${type};base64,${(await read(image.file)).toString("base64")}`, detail: "high" });
  }
  return parts;
}

/**
 * The Site plan asks, for each page, the decision brief that says what it must achieve: the
 * Report findings, Direction steps and Knowledge it rests on.
 */
function sitePlanSchema(input: WriteInput) {
  const report = input.report as { findings?: { id: string }[] } | undefined, direction = input.direction as { visitorDecisions?: string[] } | undefined;
  if (!report?.findings?.length || !direction?.visitorDecisions?.length) throw Error("The Site plan needs the confirmed Report and Direction");
  const schema = structuredClone(strategyBlueprintSchema) as unknown as { properties: { pages: { items: { properties: {
    decisionBrief: { properties: Record<string, unknown> } } } }; navigation: Record<string, unknown>;
    articles: { items: { properties: { target: Record<string, unknown> } } } } };
  // Say what each reference must be: the checker accepts only a path the plan itself declares.
  schema.properties.navigation.description = "The menu, in order: each the path of a page in pages.";
  // The footer is part of the plan (the Principal, Nov 27).
  const plan = schema as unknown as { properties: Record<string, unknown>; required: string[] };
  plan.properties.footer = siteFooterSchema;
  plan.required = [...plan.required, "footer"];
  schema.properties.articles.items.properties.target.description = "The path of the one page in pages that answers this question: a single path, never several.";
  const fields = schema.properties.pages.items.properties.decisionBrief.properties;
  schema.properties.pages.items.properties.decisionBrief.properties = { ...fields,
    findingIds: { type: "array", description: "Use IDs from report.findings.", items: { type: "string", enum: report.findings.map(item => item.id) } },
    claimIds: { type: "array", description: "Use only the supplied knowledge and evidence ids.", items: { type: "string",
      enum: [...knowledgeSources(input.knowledge), ...evidenceSources(input.evidence ?? [])].map(item => item.id) } },
    directionSteps: { type: "array", description: "Use zero-based indices into direction.visitorDecisions.",
      items: { type: "integer", enum: direction.visitorDecisions.map((_, index) => index) } } };
  return schema;
}

const layoutInstructions = (input: WriteInput) => "This is a layout change. The page's words are approved and fixed: you receive them as numbered pieces " +
  "(words: w1, w2, …) and the page's current arrangement with those numbers in place of the text (arrangement). Return a new arrangement of the page that " +
  "places every piece exactly once, by its number, in a designed component for each section (version 2, mode section). A section is named by the number of " +
  "its heading, and its component's own opening heading uses that same number. Headings take heading pieces; paragraphs, list items, quotes, details, " +
  "captions and placeholder notes take text pieces. Buttons take no text: their labels come from the page's Actions. You cannot add, change, shorten or " +
  "drop a word; arrange, group, order, style and illustrate them as the design needs. Pictures and their frames are yours to decide, but a picture is " +
  "placed only where its section asks for it: image node section-N is that section's visual (N is the section's position, from 0), and section-N-k is the " +
  "k-th entry (from 1) of its moreVisuals; a section whose visual is text-only has no section-N picture. Before answering, check that every piece " +
  "number appears exactly once." +
  (input.example !== undefined ? " example is an earlier version of this page whose arrangement the requester liked: follow it where the same words appear." : "");
const wordsInstructions = "This is a word change. The page's layout stays as it is: you receive its words as numbered pieces (words: w1, w2, …) and its " +
  "arrangement with those numbers in place of the text. Return only the pieces you change (change: their number and new text), remove (remove: their numbers) " +
  "or add (add: the piece to add it after, its text, and whether it is a paragraph, a heading or a list item). Change only what the requests ask for; " +
  "every other word stays exactly as it is.";

/** A layout change: each section names its heading piece, and every text in its component is a piece number (task 1a). */
function layoutSchema(words: Piece[]) {
  // Piece numbers by pattern, not a list of every number: a long page would pass the format's limit on listed values.
  // Core's check refuses any number that isn't one of the page's pieces, or the wrong kind, and says which.
  const has = (kind: Piece["kind"]) => words.some(piece => piece.kind === kind);
  const number = { type: "string", pattern: "^w[1-9][0-9]*$" };
  const one = (kind: Piece["kind"], nullable = false) => has(kind)
    ? nullable ? { type: ["string", "null"], pattern: number.pattern } : number : { type: "null" };
  const defs = structuredClone(nativeComponentSchema.$defs) as unknown as { nativeNode: { anyOf: { properties: Record<string, unknown> }[] } } & Record<string, unknown>;
  for (const shape of defs.nativeNode.anyOf) {
    const kind = (shape.properties.kind as { enum: string[] }).enum[0]!;
    shape.properties.text = kind === "heading" ? one("heading") : ["paragraph", "details", "placeholder", "quote"].includes(kind) ? one("text")
      : kind === "image" ? one("text", true) : { type: "null" };
    const items = shape.properties.items as Record<string, unknown>;
    shape.properties.items = { ...items, items: kind === "list" ? one("text") : { type: "string" } };
  }
  const page = creativePageSchema.properties.sections.items.properties;
  const component = { type: "object", additionalProperties: false, required: ["version", "name", "purpose", "mode", "root"],
    properties: { ...nativeComponentSchema.properties, version: { type: "integer", enum: [2] }, mode: { type: "string", enum: ["section"] } } };
  return { type: "object", additionalProperties: false, required: ["sections"], $defs: defs,
    properties: { sections: { type: "array", items: { type: "object", additionalProperties: false, required: ["heading", "role", "visual", "moreVisuals", "block"],
      properties: { heading: one("heading"), role: page.role, visual: page.visual, moreVisuals: page.moreVisuals, block: component } } } } };
}

/** A word change: only the pieces it changes, removes or adds (task 1a). */
function wordsSchema(words: Piece[]) {
  const id = { type: "string", pattern: "^w[1-9][0-9]*$", description: `One of the page's pieces, w1 to w${words.length}` };
  const list = (properties: Record<string, unknown>) => ({ type: "array", items: { type: "object", additionalProperties: false, required: Object.keys(properties), properties } });
  return { type: "object", additionalProperties: false, required: ["change", "remove", "add"], properties: {
    change: list({ id, text: { type: "string" } }), remove: { type: "array", items: id },
    add: list({ after: id, text: { type: "string" }, as: { type: "string", enum: ["paragraph", "heading", "item"] } }) } };
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
      const { footer, ...rest } = output as Record<string, unknown>;
      const blueprint = readBlueprint(rest, ids, true, true);
      // Each page keeps the decision brief that says what it must achieve; Core writes the page from it.
      const plan: SitePlan = { pages: blueprint.pages.map(page => ({ path: page.path, label: page.label, purpose: page.purpose,
        inMenu: blueprint.navigation.includes(page.path), sourceIds: page.sourceIds,
        ...("decisionBrief" in page && { decisionBrief: page.decisionBrief }) })),
        footer: readSiteFooter(footer, blueprint.pages.map(page => page.path)) };
      if (!plan.pages.some(page => page.path === "/")) throw Error("The Site plan needs a Home page");
      return plan;
    }
    case "page": {
      // A layout places the page's own pieces; a word change edits them in place. Either way the result is a whole page, checked as one.
      // A designer's slips in placing the pieces are mended without touching a word (mendLayout); new words are still refused.
      const mended = input.grain === "page-layout" ? mendLayout(input.previous as PageContent, output as Layout) : undefined;
      if (mended?.mended.length) console.log(`Layout of ${input.page!.path} mended: ${mended.mended.join("; ")}`);
      const page = mended ? fillLayout(input.previous as PageContent, mended.layout)
        : input.grain === "page-words" ? applyWordEdits(input.previous as PageContent, output as WordEdits) : output;
      // The stored page's identities are the engine's to keep (versionedPage), not part of what is checked.
      const bare = (item: Record<string, unknown>) => { const rest = { ...item }; delete rest.id; delete rest.version; return rest; };
      const checkable = page === output ? page : { ...bare(page as Record<string, unknown>),
        sections: (page as PageContent).sections.map(section => bare(section)),
        // A stored Action without a placement had none (null), as Core answered it.
        actions: ((page as PageContent).actions as Record<string, unknown>[] | undefined)?.map(action => ({ sectionIndex: null, ...action })) };
      return readPage(checkable, input.page!.path, paths, ids, {}, true, false, true) as unknown as PageContent;
    }
  }
}
