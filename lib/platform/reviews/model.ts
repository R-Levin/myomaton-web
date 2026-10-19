import { fingerprint, object, text, uuid } from "../canonical/model";
import type { Answers, EntryIntent } from "../intake/model";
import { snapshotQuestionnaire, validateQuestionnaire, type QuestionnaireContext } from "./questionnaire";
import { fullServiceGuidance, internalCustomerTerms, validateSolutionContext, type SolutionContext } from "./synthesis-context";

export type Owner = { webPresenceId: string; managedSiteId: string };
export type Submission = { id: string; intake_id: string; web_presence_id: string; entry_intent: EntryIntent; questionnaire_version: string; draft_version: number; answers: Answers; provenance: Record<string, { source: string; confirmation: string; suppliedAt: string }>; digest: string; submitted_at: string };
export type Evidence = { id: string; kind: "public-web" | "operator"; source: string; capturedAt: string; text: string; coverage: string };
export type PresenceCoverage = { version: "development-presence/1"; label: string; baseUrl: string; observedVersion: string; discovered: { route: string; title: string }[]; reviewed: { route: string; purpose: string; capturedAt: string; limitations: string; evidenceId: string; snapshotSha256: string }[]; omitted: { route: string; reason: string }[] };
export type ReviewEvidencePacket = { version: "review-evidence/1"; owner: Owner; submission: Submission; evidence: Evidence[]; coverage: string; presence?: PresenceCoverage; questionnaireContext?: QuestionnaireContext; solutionContext?: SolutionContext; digest: string };
export const claimKinds = ["FACT", "PROSPECT_SUPPLIED_UNCONFIRMED", "OBSERVATION", "RECOMMENDATION", "UNKNOWN"] as const;
export type ParagraphClaim = { id?: string; kind: typeof claimKinds[number]; text: string; evidence: string[]; serviceUses?: { capability: string; mode: "direction" | "current-operation" }[]; referenceReview?: { status: "candidate"; sourceLocation: string; sourceClaimId?: string; candidateEvidence: string[] } };
export type Claim = ParagraphClaim & { additionalParagraphs?: ParagraphClaim[] };
export const claimParagraphs = (claim: Claim): ParagraphClaim[] => [claim, ...(claim.additionalParagraphs ?? [])];
export type ReviewDraft = { format?: "consultative/1" | "consultative/2"; ongoing?: Claim; understanding: Claim; startingPoint: { framing: "existing" | "starting-from-scratch"; content: Claim }; opportunities: { title: string; what: Claim; why: Claim; direction: Claim }[]; firstDirection: Claim; conversion: Claim; fit: { assessment: "strong" | "conditional" | "insufficient-information" | "not-a-good-fit"; content: Claim }; teaser: { status: "not-generated"; content: Claim } };
const date = (s: string) => { if (!Number.isFinite(Date.parse(s))) throw Error("Invalid evidence timestamp"); };
export function assertOwner(a: Owner, b: Owner) { if (a.webPresenceId !== b.webPresenceId || a.managedSiteId !== b.managedSiteId) throw Error("Foreign Review owner"); }
export function submissionDigest(s: Submission) { return fingerprint({ intent: s.entry_intent, questionnaireVersion: s.questionnaire_version, draftVersion: s.draft_version, answers: s.answers, provenance: s.provenance }); }
export function validatePacket(packet: ReviewEvidencePacket) {
  object(packet, ["version", "owner", "submission", "evidence", "coverage", "presence", "questionnaireContext", "solutionContext", "digest"]);
  if (packet.version !== "review-evidence/1") throw Error("Unsupported evidence packet");
  object(packet.owner, ["webPresenceId", "managedSiteId"]); uuid(packet.owner.webPresenceId); uuid(packet.owner.managedSiteId);
  const s = packet.submission; uuid(s.id); uuid(s.intake_id); date(s.submitted_at);
  if (s.web_presence_id !== packet.owner.webPresenceId || s.entry_intent !== "FREE_REVIEW" || submissionDigest(s) !== s.digest) throw Error("Invalid immutable submission");
  if (JSON.stringify(s).length > 40000 || !Number.isSafeInteger(s.draft_version) || s.draft_version < 1) throw Error("Invalid submission bounds");
  for (const key of Object.keys(s.answers)) { const p = s.provenance[key]; if (!p || p.source !== "prospect-supplied" || p.confirmation !== "unconfirmed") throw Error("Unconfirmed source required"); date(p.suppliedAt); }
  if (packet.questionnaireContext !== undefined) validateQuestionnaire(packet.questionnaireContext, s);
  if (packet.solutionContext !== undefined) validateSolutionContext(packet.solutionContext);
  text(packet.coverage, 1200, true);
  if (!Array.isArray(packet.evidence) || packet.evidence.length > 8) throw Error("Evidence limit");
  const ids = new Set<string>();
  for (const e of packet.evidence) {
    object(e, ["id", "kind", "source", "capturedAt", "text", "coverage"]);
    if (!/^[a-z][a-z0-9-]{0,59}$/.test(e.id) || ids.has(e.id) || !["public-web", "operator"].includes(e.kind)) throw Error("Invalid evidence identity");
    ids.add(e.id); text(e.text, 1800, true); text(e.source, 1000); text(e.coverage, 1000, true); date(e.capturedAt);
    if (e.kind === "public-web" && ![s.answers.website, s.answers.publicProfile].includes(e.source)) throw Error("Only submitted public URLs permitted");
  }
  if (packet.presence) {
    const p = packet.presence; object(p, ["version", "label", "baseUrl", "observedVersion", "discovered", "reviewed", "omitted"]);
    const base = new URL(p.baseUrl);
    if (p.version !== "development-presence/1" || base.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) || !base.port || base.username || base.password || base.pathname !== "/" || base.search || base.hash) throw Error("Explicit loopback development evidence required");
    text(p.label, 120); text(p.observedVersion, 1000);
    if (!Array.isArray(p.discovered) || p.discovered.length < 2 || p.discovered.length > 20 || !Array.isArray(p.reviewed) || p.reviewed.length < 2 || p.reviewed.length > 8 || !Array.isArray(p.omitted) || p.omitted.length > 20) throw Error("Representative coverage bounds");
    const routes = new Set<string>(), covered = new Set<string>(), refs = new Set<string>();
    for (const page of p.discovered) { object(page, ["route", "title"]); if (!/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/.test(page.route) || routes.has(page.route)) throw Error("Invalid discovered route"); routes.add(page.route); text(page.title, 200); }
    for (const page of p.reviewed) {
      object(page, ["route", "purpose", "capturedAt", "limitations", "evidenceId", "snapshotSha256"]);
      const e = packet.evidence.find(e => e.id === page.evidenceId);
      if (!routes.has(page.route) || covered.has(page.route) || refs.has(page.evidenceId) || !e || e.kind !== "operator" || e.source !== new URL(page.route, base).href || e.capturedAt !== page.capturedAt || !/^[a-f0-9]{64}$/.test(page.snapshotSha256)) throw Error("Development Page evidence mismatch");
      covered.add(page.route); refs.add(page.evidenceId); text(page.purpose, 1000); text(page.limitations, 1000); date(page.capturedAt);
    }
    for (const page of p.omitted) { object(page, ["route", "reason"]); if (!routes.has(page.route) || covered.has(page.route)) throw Error("Invalid omitted route"); covered.add(page.route); text(page.reason, 1000); }
    if (covered.size !== routes.size || refs.size !== packet.evidence.length) throw Error("Unclassified routes or mixed evidence sources");
  }
  const { digest, ...body } = packet; if (fingerprint(body) !== digest) throw Error("Changed evidence packet");
}
export function evidencePacket(owner: Owner, submission: Submission, evidence: Evidence[], coverage: string, presence?: PresenceCoverage, solutionContext?: SolutionContext): ReviewEvidencePacket {
  const body = structuredClone({ version: "review-evidence/1" as const, owner, submission, evidence, coverage, questionnaireContext: snapshotQuestionnaire(submission), ...(presence ? { presence } : {}), ...(solutionContext ? { solutionContext } : {}) });
  const packet = { ...body, digest: fingerprint(body) }; validatePacket(packet); return packet;
}
// Structural limits plus explicit operator QC enforce the free/paid boundary.
// Text checks are defense in depth, not a claim that a regex proves semantic truth.
const forbidden = /<|>|```|\b(?:wireframes?|final sitemap|finished page copy|keyword spreadsheet|content calendar|SEO implementation plan|conversion architecture specification|dashboard|system prompt|chain.of.thought|api[_ -]?key|provider metadata|fixture|NODE_ENV)\b|(?:^|\n)\s*\d+[.)]\s|\b(?:paste this|run this command|install the plugin|add this code)\b/i;
export function validateDraft(value: unknown, packet: ReviewEvidencePacket): ReviewDraft {
  validatePacket(packet);
  const r = object(value, ["format", "ongoing", "understanding", "startingPoint", "opportunities", "firstDirection", "conversion", "fit", "teaser"]);
  const consultative = r.format === "consultative/1" || r.format === "consultative/2";
  if (r.format === "consultative/2" && !packet.solutionContext?.writingGuidance) throw Error("Refined format requires a bound writing guidance snapshot");
  if (r.format !== undefined && !consultative || consultative && !packet.solutionContext || r.ongoing !== undefined && !consultative) throw Error("Consultative format requires internal solution context");
  const evidence = new Map(packet.evidence.map(e => [e.id, e]));
  const claimIds = new Set<string>();
  const paragraph = (v: unknown, customerCopy = true): ParagraphClaim => {
    const c = object(v, ["id", "kind", "text", "evidence", "serviceUses", "referenceReview"]); const body = text(c.text, 550, true);
    if (c.id !== undefined) { if (typeof c.id !== "string" || !/^claim_[a-f0-9]{24}$/.test(c.id) || claimIds.has(c.id)) throw Error("Invalid/duplicate claim identity"); claimIds.add(c.id); }
    if (!claimKinds.includes(c.kind as Claim["kind"]) || forbidden.test(body) || !Array.isArray(c.evidence) || (!c.evidence.length && c.referenceReview === undefined) || c.evidence.length > 5) throw Error("Invalid Review claim/boundary");
    let referenceReview: ParagraphClaim["referenceReview"];
    if (c.referenceReview !== undefined) {
      const rr = object(c.referenceReview, ["status", "sourceLocation", "sourceClaimId", "candidateEvidence"]);
      if (rr.status !== "candidate" || c.evidence.length || c.kind === "FACT" || typeof rr.sourceLocation !== "string" || !/^(?:understanding|startingPoint\.content|opportunities\.[0-2]\.(?:what|why|direction)|firstDirection|conversion|ongoing|fit\.content|teaser\.content)(?:\.paragraphs\.[1-4])?$/.test(rr.sourceLocation) || !Array.isArray(rr.candidateEvidence) || !rr.candidateEvidence.length || rr.candidateEvidence.length > 5 || rr.candidateEvidence.some(ref => typeof ref !== "string")) throw Error("Invalid candidate reference review");
      if (rr.sourceClaimId !== undefined && (typeof rr.sourceClaimId !== "string" || !/^claim_[a-f0-9]{24}$/.test(rr.sourceClaimId))) throw Error("Invalid candidate source identity");
      referenceReview = { status: "candidate", sourceLocation: rr.sourceLocation, ...(rr.sourceClaimId ? { sourceClaimId: rr.sourceClaimId as string } : {}), candidateEvidence: [...new Set(rr.candidateEvidence as string[])] };
    }
    const effectiveEvidence = referenceReview?.candidateEvidence ?? c.evidence;
    for (const ref of effectiveEvidence) if (typeof ref !== "string" || !(ref.startsWith("intake:") ? Object.hasOwn(packet.submission.answers, ref.slice(7)) : evidence.has(ref))) throw Error("Unsupported evidence reference");
    if (c.kind === "FACT" && (!c.evidence.every(ref => evidence.has(ref)) || !c.evidence.some(ref => evidence.get(ref)?.text.includes(body)))) throw Error("Facts require exact captured support");
    if (c.kind === "PROSPECT_SUPPLIED_UNCONFIRMED" && (!/^you\b|^based on your answers\b/i.test(body) || !effectiveEvidence.every(ref => ref.startsWith("intake:")))) throw Error("Prospect claims must stay attributed and unconfirmed");
    if (c.kind === "OBSERVATION" && effectiveEvidence.every(ref => ref.startsWith("intake:")) && !/\b(?:you|your|appears?|suggests?|may|could)\b/i.test(body)) throw Error("Intake-only interpretation must retain attribution/uncertainty");
    if (consultative && /\b(?:AVAILABLE_PROVEN|DEFINED_EVOLVING|PLANNED_DEFERRED|EXTERNAL_INTEGRATION|production.tested|sampled routes|reviewed implementation|migration|capability status)\b|MioPages (?:already )?(?:automatically analyzes every visitor|continuously rewrites|guarantees)/i.test(body)) throw Error("Internal status or unsupported automation promise in customer copy");
    if (r.format === "consultative/2" && customerCopy && internalCustomerTerms.test(body)) throw Error("Internal terminology in customer copy");
    let serviceUses: Claim["serviceUses"];
    if (c.serviceUses !== undefined) {
      if (!Array.isArray(c.serviceUses) || !c.serviceUses.length || c.serviceUses.length > 4 || !packet.solutionContext || c.kind !== "RECOMMENDATION") throw Error("Invalid internal service use");
      serviceUses = c.serviceUses.map(v => { const u = object(v, ["capability", "mode"]); const capability = packet.solutionContext!.capabilities.find(k => k.id === u.capability); if (!capability || !["direction", "current-operation"].includes(String(u.mode))) throw Error("Unknown service capability/use"); if (u.mode === "current-operation" && (capability.status !== "AVAILABLE_PROVEN" || capability.scope !== "production")) throw Error("Unproven capability cannot be promised as currently operational"); return { capability: capability.id, mode: u.mode as "direction" | "current-operation" }; });
    }
    return { ...(c.id !== undefined ? { id: c.id as string } : {}), ...(serviceUses ? { serviceUses } : {}), ...(referenceReview ? { referenceReview } : {}), kind: c.kind as Claim["kind"], text: body, evidence: [...new Set(c.evidence)] };
  };
  const claim = (v: unknown, customerCopy = true): Claim => {
    const raw = object(v, ["id", "kind", "text", "evidence", "serviceUses", "referenceReview", "additionalParagraphs"]);
    const { additionalParagraphs, ...head } = raw; const first = paragraph(head, customerCopy);
    if (additionalParagraphs === undefined) return first;
    if (!Array.isArray(additionalParagraphs) || !additionalParagraphs.length || additionalParagraphs.length > 4) throw Error("One to five flat paragraph units required");
    return { ...first, additionalParagraphs: additionalParagraphs.map(p => paragraph(p, customerCopy)) };
  };
  const start = object(r.startingPoint, ["framing", "content"]), fit = object(r.fit, ["assessment", "content"]), teaser = object(r.teaser, ["status", "content"]);
  const framing = packet.submission.answers.project === "Build a new Web presence from scratch" ? "starting-from-scratch" : "existing";
  if (start.framing !== framing || !["strong", "conditional", "insufficient-information", "not-a-good-fit"].includes(String(fit.assessment)) || teaser.status !== "not-generated") throw Error("Invalid Review framing/fit/teaser");
  if (!Array.isArray(r.opportunities) || r.opportunities.length !== 3) throw Error("Exactly three primary opportunities required");
  const opportunities = r.opportunities.map(v => { const o = object(v, ["title", "what", "why", "direction"]); const title = text(o.title, 90); if (forbidden.test(title) || r.format === "consultative/2" && internalCustomerTerms.test(title)) throw Error("Invalid opportunity title"); const direction = claim(o.direction); if (direction.kind !== "RECOMMENDATION") throw Error("Direction must remain judgment"); return { title, what: claim(o.what), why: claim(o.why), direction }; });
  const result: ReviewDraft = { understanding: claim(r.understanding), startingPoint: { framing, content: claim(start.content) }, opportunities, firstDirection: claim(r.firstDirection), conversion: claim(r.conversion), fit: { assessment: fit.assessment as ReviewDraft["fit"]["assessment"], content: claim(fit.content) }, teaser: { status: "not-generated", content: claim(teaser.content, r.format !== "consultative/2") } };
  if (r.format === "consultative/1" || r.format === "consultative/2") { result.format = r.format; if (r.ongoing !== undefined) { result.ongoing = claim(r.ongoing); if (result.ongoing.kind !== "RECOMMENDATION") throw Error("Ongoing direction must remain judgment"); } }
  if (/\b(?:will generate|will receive|guaranteed|we promise)\b/i.test(result.teaser.content.text)) throw Error("No Home concept promise");
  if (result.firstDirection.kind !== "RECOMMENDATION" || [...reviewClaims(result).map(row => row.claim.text), ...result.opportunities.map(o => o.title)].join(" ").split(/\s+/).length > 1000) throw Error("Review must remain concise direction");
  return result;
}
export function reviewClaimSlots(d: ReviewDraft): { location: string; claim: Claim }[] {
  return [{ location: "understanding", claim: d.understanding }, { location: "startingPoint.content", claim: d.startingPoint.content }, ...d.opportunities.flatMap((o, i) => ["what", "why", "direction"].map(k => ({ location: `opportunities.${i}.${k}`, claim: o[k as "what" | "why" | "direction"] }))), { location: "firstDirection", claim: d.firstDirection }, { location: "conversion", claim: d.conversion }, ...(d.ongoing ? [{ location: "ongoing", claim: d.ongoing }] : []), { location: "fit.content", claim: d.fit.content }, { location: "teaser.content", claim: d.teaser.content }];
}
export function reviewClaims(d: ReviewDraft): { location: string; claim: ParagraphClaim }[] {
  return reviewClaimSlots(d).flatMap(row => claimParagraphs(row.claim).map((claim, i) => ({ location: i ? row.location + ".paragraphs." + i : row.location, claim })));
}
// Bounded fixed-schema identity, not semantic matching/reordering or generalized lineage.
export function bindClaimIdentities(draft: ReviewDraft, reviewId: string): ReviewDraft {
  uuid(reviewId); const copy = structuredClone(draft);
  for (const { location, claim } of reviewClaims(copy)) { const expected = "claim_" + fingerprint({ reviewId, location }).slice(0, 24); if (claim.id && claim.id !== expected) throw Error("Claim identity belongs to a different Review/schema location"); claim.id = expected; }
  return copy;
}
export type ReviewSynthesisRequest = { packet: ReviewEvidencePacket; operation: "free-review"; authorizedAttempts: 1 };
export interface ReviewSynthesisProvider { readonly mode: "development-manual" | "live"; synthesize(request: ReviewSynthesisRequest & { guidance?: string }): Promise<unknown> }
export function developmentOnly(env: Record<string, string | undefined> = process.env) { if (env.NODE_ENV !== "development" || env.MIOPAGES_REVIEW_SYNTHESIS !== "local-operator") throw Error("Trusted local DEVELOPMENT Review tooling only"); }
export async function synthesize(request: ReviewSynthesisRequest, provider: ReviewSynthesisProvider, env = process.env): Promise<ReviewDraft> {
  developmentOnly(env); validatePacket(request.packet);
  if (request.operation !== "free-review" || request.authorizedAttempts !== 1 || provider.mode !== "development-manual") throw Error("Live provider dispatch is not implemented/authorized");
  object(request, ["packet", "operation", "authorizedAttempts"]);
  return validateDraft(await provider.synthesize(structuredClone({ ...request, ...(request.packet.solutionContext ? { guidance: request.packet.solutionContext.writingGuidance?.text ?? fullServiceGuidance } : {}) })), request.packet);
}
export const manualModelAdapter = (draft: unknown): ReviewSynthesisProvider => ({ mode: "development-manual", async synthesize() { return structuredClone(draft); } });
export const qualityChecks = ["faithfulUnderstanding", "supportedObservations", "reasonablePriority", "usefulDirection", "freePaidBoundary", "credibleFit", "concisePlainCopy", "noUnsupportedClaims", "honestUncertainty", "noInternalTerminology"] as const;
