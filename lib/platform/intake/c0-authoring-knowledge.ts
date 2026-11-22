import { createHash } from "node:crypto";
import { fingerprint } from "../canonical/model";
import { validateMarketingAuthority, type MarketingAuthority } from "./presence-marketing-authority";
import type { WorkflowContext } from "./presence-workflow";
import type { PresenceEvidence } from "./presence-workflow-artifacts";

type Documents = { businessBrief: string; productModel: string };

function section(document: string, heading: string, level: number) {
  const prefix = "#".repeat(level) + " ";
  const all = document.split("\n");
  const matches = all.flatMap((line, index) => line === prefix + heading ? [index] : []);
  if (matches.length !== 1) throw Error("Exact canonical C0 section required: " + heading);
  const start = matches[0] + 1;
  const end = all.findIndex((line, index) => index >= start && new RegExp("^#{1," + level + "} ").test(line));
  return all.slice(start, end < 0 ? undefined : end).join("\n").trim();
}

function paragraph(body: string, start: string) {
  const matches = body.split(/\n\s*\n/u).filter(text => text.startsWith(start));
  if (matches.length !== 1) throw Error("Exact canonical C0 passage required: " + start);
  return matches[0];
}

/** An exact sentence run inside one paragraph, used where the paragraph's tail is
 * a document cross-reference or implementation-status note rather than offer. */
function span(body: string, start: string, end: string) {
  const text = paragraph(body, start);
  const stop = text.indexOf(end);
  if (stop < 0 || text.indexOf(end, stop + 1) >= 0) throw Error("Exact canonical C0 passage required: " + end);
  return text.slice(0, stop + end.length);
}

function within(body: string, start: string, end: string) {
  const from = body.indexOf(start);
  if (from < 0 || body.indexOf(start, from + 1) >= 0) throw Error("Exact canonical C0 passage required: " + start);
  const stop = body.indexOf(end, from);
  if (stop < 0) throw Error("Exact canonical C0 passage required: " + end);
  return body.slice(from, stop + end.length);
}

/** A proposal for a NEW source-bound C0 run, not a modification of any case/grant.
 * Canonical intended service direction stays service-direction, not verified
 * current operations or final public promises. No visitor prose is authored here. */
export function proposeC0AuthoringKnowledge(context: WorkflowContext, authority: MarketingAuthority, documents: Documents) {
  if (context.evaluation?.scenario !== "c0") throw Error("C0 knowledge cannot enter another evaluation case");
  validateMarketingAuthority(authority, fingerprint(context), context.evidence.map(fingerprint));
  const brief = documents.businessBrief.replaceAll("\r\n", "\n");
  const product = documents.productModel.replaceAll("\r\n", "\n");
  const offer = section(brief, "Launch and Ongoing offer", 2);
  const table = ["Ongoing"].map(label => {
    const rows = offer.split("\n").filter(line => line.startsWith("| " + label + " |"));
    if (rows.length !== 1) throw Error("Canonical C0 offer row required");
    return rows[0];
  });
  const position = section(product, "Positioning and intended outcome", 2);
  const continuing = section(product, "Continuing value after launch", 2);
  const primary = section(product, "One primary managed service", 3);
  const ongoing = section(product, "Ongoing: intended continuing value", 3);
  const launch = section(product, "Standard Launch: intended customer deliverables", 3);
  const launchBullets = [...launch.matchAll(/^- ([\s\S]*?)(?=^- |\n\n|(?![\s\S]))/gm)].map(match => match[0].trim());
  if (!launchBullets.length) throw Error("Canonical C0 Standard Launch deliverables required");
  // Keep the current substantive scope; the following sentence about an unrun
  // GA4 comparison is implementation context, not a staffed Google service claim.
  if (!launchBullets.some(bullet => bullet.startsWith("- First-party measurement") && bullet.includes("outcomes."))) throw Error("Canonical first-party measurement scope required");
  const launchPassages = launchBullets.map(bullet => bullet.startsWith("- First-party measurement") ?
    bullet.slice(0, bullet.indexOf("outcomes.") + "outcomes.".length) : bullet);
  if (launchPassages.some(passage => !passage.trim() || !launch.includes(passage))) throw Error("Exact Launch passages required");
  const records = [
    { key: "standard-launch", file: "miopages-c0-product-model.md", title: "Standard Launch: intended customer deliverables", body: launch,
      passages: [paragraph(launch, "A normal good-fit customer"), ...launchPassages, paragraph(launch, "The customer need not arrive")], document: documents.productModel },
    { key: "ongoing-summary", file: "miopages-c0-business-brief.md", title: "Launch and Ongoing offer", body: offer, passages: table, document: documents.businessBrief },
    { key: "positioning-and-outcomes", file: "miopages-c0-product-model.md", title: "Positioning and intended outcome", body: position,
      passages: [paragraph(position, "Customers provide business knowledge"), paragraph(position, "The intended middle ground"), paragraph(position, "The presence should help")], document: documents.productModel },
    { key: "continuing-growth", file: "miopages-c0-product-model.md", title: "Continuing value after launch", body: continuing,
      passages: [paragraph(continuing, "Launch starts the relationship."),
        within(continuing, "MioPages\nshould prove that loop", "technical lock-in is not a retention strategy.")], document: documents.productModel },
    { key: "managed-service", file: "miopages-c0-product-model.md", title: "One primary managed service", body: primary,
      passages: [paragraph(primary, "MioPages sells one primary"), paragraph(primary, "The service should help")], document: documents.productModel },
    { key: "ongoing-value", file: "miopages-c0-product-model.md", title: "Ongoing: intended continuing value", body: ongoing,
      // The second paragraph states Ongoing's core value; its document links and
      // implementation-status sentence stay out of the claim passage.
      passages: [paragraph(ongoing, "After Launch, service activities"),
        span(ongoing, "Ongoing is not primarily", "rather than lock-in.")], document: documents.productModel },
  ];
  const additions = records.map(record => ({
    id: "c0-canonical:" + record.key, kind: "service-direction" as const, label: record.title,
    reference: "docs/" + record.file + " · " + record.title, date: null, content: record.body,
    rawDigest: createHash("sha256").update(record.document).digest("hex"),
  } satisfies PresenceEvidence));
  if (additions.some(source => context.evidence.some(old => old.id === source.id))) throw Error("C0 authoring proposal already present; preserve its original binding");
  const proposed = { ...context, evidence: [...context.evidence, ...additions] };
  const selections = authority.projectionVersion === 2 ? [...authority.sourceSelections!] :
    authority.sources.filter(row => ["business-fact", "staffed-offer", "editorial"].includes(row.use)).map(row => {
      const source = context.evidence.find(source => fingerprint(source) === row.digest)!;
      return { digest: row.digest, passages: [source.content] };
    });
  const next: MarketingAuthority = { ...authority, projectionVersion: 2, earlyConceptReview: true, contextDigest: fingerprint(proposed),
    processingInstructions: [...authority.processingInstructions ?? [], {
      basis: "owner-direction", reference: "docs/miopages-c0-product-model.md · Launch and Ongoing customer deliverable summary / Marketing-preservation note",
      text: "Canonical service-direction records describe the intended offer, not proof that every workflow operates in the development installation. Preserve the substantive service proposition in original visitor copy without inserting development-readiness commentary. Keep unverified prices, performance, availability and customer proof unconfirmed.",
    }],
    sources: [...authority.sources, ...additions.map(source => ({ digest: fingerprint(source), use: "staffed-offer" as const }))],
    sourceSelections: [...selections, ...records.map((record, index) => ({ digest: fingerprint(additions[index]), passages: record.passages }))] };
  validateMarketingAuthority(next, fingerprint(proposed), proposed.evidence.map(fingerprint));
  return { context: proposed, authority: next, requiresFreshGrant: true as const,
    coverage: records.map((record, index) => ({ id: additions[index].id, reference: additions[index].reference,
      documentDigest: additions[index].rawDigest, selectedDigest: fingerprint(record.passages), use: "intended-service-direction" as const })) };
}
