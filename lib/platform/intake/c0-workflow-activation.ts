import { createHash } from "node:crypto";
import { fingerprint, object, uuid } from "../canonical/model";
import { c0DisclosureManifest } from "./c0-workflow-knowledge";
import type { WorkflowContext } from "./presence-workflow";
import type { PresenceWorkflowGrant } from "./presence-workflow-provider";
import { validateDiscovery, validateMarketSearch, validateResearchSources, type MarketSearch, type PublicResearchSource, type ResearchDiscovery } from "./presence-workflow-research";

import { hash } from "../content-editing/proposal";
import { validatePresenceImageGrant } from "./presence-workflow-visual";

export function c0HostedRunGrant(context: WorkflowContext, bytes: Buffer, approvedDigest: string, ledgerBytes: Buffer, now = Date.now()): PresenceWorkflowGrant {
  if (createHash("sha256").update(bytes).digest("hex") !== hash(approvedDigest)) throw Error("Exact owner-reviewed hosted manifest required");
  const plan = object(JSON.parse(bytes.toString("utf8")), ["schema", "scope", "sourceEvidence", "existingLedger", "provider", "research", "images", "rollout"]);
  if (plan.schema !== "miopages.c0-hosted-presence/2" || fingerprint(plan.scope) !== fingerprint(context.scope)) throw Error("Hosted run scope refused");
  // Host/plugin installation and actual staging are separate approval operations
  // enumerated in the reviewed manifest. This compiler enables worker dispatch only.
  const rollout = object(plan.rollout, ["commit", "artifactSha256", "coreOrigin", "wordpressOrigin", "wordpressPluginSha256",
    "installationId", "siteProposalId", "privateOnly", "expiresAt", "rollback", "retentionDays", "policy"]);
  if (typeof rollout.commit !== "string" || !/^[a-f0-9]{40}$/u.test(rollout.commit) ||
      rollout.coreOrigin !== "https://wp-acceptance.miopages.com" || rollout.wordpressOrigin !== "https://miopages.org" ||
      rollout.privateOnly !== true || typeof rollout.installationId !== "string" ||
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(rollout.installationId)) throw Error("Reviewed WordPress rehearsal scope required");
  hash(rollout.artifactSha256);
  hash(rollout.wordpressPluginSha256);
  uuid(rollout.siteProposalId);
  const rollback = object(rollout.rollback, ["materializedRevision", "materializedDigest", "highWater", "highWaterDigest", "pages"]);
  if (!Number.isSafeInteger(rollback.materializedRevision) || !Number.isSafeInteger(rollback.highWater) ||
      Number(rollback.materializedRevision) < 1 || Number(rollback.highWater) < Number(rollback.materializedRevision) ||
      !Array.isArray(rollback.pages) || !rollback.pages.length ||
      !Number.isSafeInteger(rollout.retentionDays) || Number(rollout.retentionDays) < 1 || Number(rollout.retentionDays) > 30) {
    throw Error("Hosted rollback and retention scope refused");
  }
  hash(rollback.materializedDigest);
  hash(rollback.highWaterDigest);
  for (const page of rollback.pages) {
    const record = object(page, ["path", "id", "wordPressId", "slug", "sha256"]);
    if (typeof record.path !== "string" || !record.path.startsWith("/") || typeof record.slug !== "string" ||
        !Number.isSafeInteger(record.wordPressId) || Number(record.wordPressId) < 1) throw Error("Hosted rollback Page refused");
    uuid(record.id);
    hash(record.sha256);
  }
  const policy = object(rollout.policy, ["workflowSqlSha256", "rolePolicySha256"]);
  hash(policy.workflowSqlSha256);
  hash(policy.rolePolicySha256);
  const expiresAt = typeof rollout.expiresAt === "string" ? Date.parse(rollout.expiresAt) : NaN;
  if (!Number.isFinite(expiresAt) || expiresAt <= now || expiresAt > now + 7 * 86_400_000) throw Error("Exact hosted expiry required");
  const source = object(plan.sourceEvidence, ["contextDigest", "exactCandidates", "approvedCorrections"]);
  const current = c0DisclosureManifest(context);
  if (source.contextDigest !== current.contextDigest || !Array.isArray(source.exactCandidates) || !source.exactCandidates.length ||
      !Array.isArray(source.approvedCorrections)) throw Error("Hosted knowledge projection differs");
  const approvedSources = source.exactCandidates.map(raw => {
    const item = object(raw, ["id", "digest"]);
    if (!current.approvedSourceCandidates.some(allowed => allowed.id === item.id && allowed.digest === item.digest)) {
      throw Error("Protected source has changed from manifest");
    }
    return hash(item.digest);
  });
  if (new Set(approvedSources).size !== approvedSources.length || !context.evidence.some(item =>
      item.kind === "owner-confirmed" && approvedSources.includes(fingerprint(item)))) throw Error("Hosted sources refused");
  const provider = object(plan.provider, ["model", "store", "automaticRetries", "requests", "generations", "maxInputTokens",
    "maxInputBytes", "maxOutputTokens", "additionalCapMicros", "maxRetries", "maxEditorialRevisions", "siteComposition"]);
  const bound = (value: unknown, min: number, max: number) => {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) throw Error("Hosted usage bound refused");
    return value;
  };
  if (provider.model !== "gpt-5.4-mini-2026-03-17" || provider.store !== false || provider.automaticRetries !== 0 ||
      (provider.siteComposition !== undefined && provider.siteComposition !== "managed-v1")) throw Error("Hosted provider scope refused");
  const generations = bound(provider.generations, 1, 128);
  const requests = bound(provider.requests, generations * 2, 256);
  const research = object(plan.research, ["roots", "market", "maxSourceBytes"]);
  const roots = research.roots as PublicResearchSource[];
  const marketSearch = research.market as MarketSearch;
  validateResearchSources(roots);
  validateMarketSearch(marketSearch);
  const images = validatePresenceImageGrant(plan.images);
  const baseline = object(plan.existingLedger, ["digest", "attempts", "uncertainReservation", "uncertainMicros"]);
  const digest = hash(baseline.digest), attempts = bound(baseline.attempts, 1, 10_000);
  const uncertain = hash(baseline.uncertainReservation);
  const receipts = (JSON.parse(ledgerBytes.toString("utf8")) as { attempts?: unknown[] }).attempts;
  if (createHash("sha256").update(ledgerBytes).digest("hex") !== digest || receipts?.length !== attempts) throw Error("Hosted usage ledger changed");
  let found = false;
  for (const item of receipts) {
    const receipt = item as { status?: string; countDispatched?: boolean; generationDispatched?: boolean; reservedMicros?: number; estimatedMicros?: number };
    if (!found && receipt.status === "uncertain" && receipt.countDispatched && receipt.generationDispatched &&
        fingerprint(receipt) === uncertain && receipt.reservedMicros === baseline.uncertainMicros) {
      bound(receipt.reservedMicros, 1, 1_000_000);
      found = true;
    } else if (!["completed", "rejected"].includes(receipt.status ?? "") ||
      bound(receipt.estimatedMicros, 0, 20_000_000) > bound(receipt.reservedMicros, 0, 20_000_000)) {
      throw Error("Unreconciled hosted usage");
    }
  }
  if (!found) throw Error("Prior reservation changed");
  return {
    contextDigest: current.contextDigest, approvedSources, approvedCorrections: source.approvedCorrections.map(hash),
    researchSources: roots, marketSearch, images, researchResponseBytes: bound(research.maxSourceBytes, 1000, 2_000_000),
    expiresAt, maxOutputTokens: bound(provider.maxOutputTokens, 1000, 64_000),
    maxRetries: bound(provider.maxRetries, 0, generations), maxEditorialRevisions: bound(provider.maxEditorialRevisions, 0, generations),
    retainedReservation: uncertain,
    ...(provider.siteComposition === "managed-v1" && { siteComposition: provider.siteComposition }),
    ledger: { id: fingerprint({ approvedDigest, context: current.contextDigest }), startingLedger: digest, baselineAttempts: attempts,
      requests, generations, capMicros: bound(provider.additionalCapMicros, 1, 20_000_000),
      inputTokens: bound(provider.maxInputTokens, 1000, 300_000), inputBytes: bound(provider.maxInputBytes, 1000, 900_000) },
  };
}

export function c0ActivationGrant(context: WorkflowContext, manifestBytes: Buffer, approvedDigest: string, ledgerBytes: Buffer, now = Date.now()): PresenceWorkflowGrant {
  if (!/^[0-9a-f]{64}$/u.test(approvedDigest) || createHash("sha256").update(manifestBytes).digest("hex") !== approvedDigest) {
    throw Error("Exact owner-reviewed manifest required");
  }
  const plan = JSON.parse(manifestBytes.toString("utf8")) as {
    sourceEvidence: { selectedDigest: string; exactCandidates: { id: string; digest: string }[] };
    existingLedger: { digest: string; attempts: number };
    provider: { model: string; store: boolean; tools: unknown[]; maxInputTokens: number; maxOutputTokens: number;
      maximumGenerations: number; maximumTotalRequests: number; maximumDeliberateRetries: number; maximumEditorialRevisions: number;
      additionalCapUsd: string; automaticRetries: number; expiryHours: number };
    research: { roots: PublicResearchSource[]; discovery: ResearchDiscovery; readsMaximum: number; maxSourceBytes: number };
  };
  const { provider, research } = plan;
  if (provider.model !== "gpt-5.4-mini-2026-03-17" || provider.store !== false || provider.tools.length || provider.automaticRetries !== 0 ||
      provider.expiryHours !== 24 || provider.additionalCapUsd !== "1.00" ||
      provider.maximumGenerations !== 12 || provider.maximumTotalRequests !== 24 || provider.maximumDeliberateRetries !== 2 ||
      provider.maximumEditorialRevisions !== 1 || provider.maxInputTokens !== 32_000 || provider.maxOutputTokens !== 12_000) {
    throw Error("C0 provider envelope refused");
  }
  validateResearchSources(research.roots);
  validateDiscovery(research.roots, research.discovery);
  if (research.roots.length + research.discovery.maxDiscovered !== research.readsMaximum ||
      research.readsMaximum > 11 || research.maxSourceBytes !== 450_000) throw Error("C0 research envelope refused");

  const current = c0DisclosureManifest(context);
  const exact = plan.sourceEvidence.exactCandidates;
  const approvedSources = exact.map(source => source.digest);
  if (exact.length !== 20 || new Set(exact.map(item => item.id)).size !== exact.length ||
      fingerprint(approvedSources) !== plan.sourceEvidence.selectedDigest || exact.some(item =>
        !current.approvedSourceCandidates.some(candidate => candidate.id === item.id && candidate.digest === item.digest))) {
    throw Error("Protected intake differs from the reviewed evidence");
  }
  const ledgerHash = createHash("sha256").update(ledgerBytes).digest("hex");
  const ledger = JSON.parse(ledgerBytes.toString("utf8"));
  const receipts = ledger?.attempts as { status: string; reservedMicros: number; countDispatched: boolean; generationDispatched: boolean }[];
  if (!Array.isArray(receipts) || ledgerHash !== plan.existingLedger.digest || receipts.length !== plan.existingLedger.attempts) {
    throw Error("Protected usage baseline differs");
  }
  const [reservation] = receipts.filter(item => item.status === "uncertain");
  if (receipts.some(item => item.status === "pending") ||
      receipts.filter(item => item.status === "uncertain").length !== 1 || reservation.reservedMicros !== 8_400 ||
      !reservation.countDispatched || !reservation.generationDispatched) throw Error("Protected usage baseline differs");
  return {
    contextDigest: current.contextDigest, approvedSources, approvedCorrections: [], researchSources: research.roots,
    discovery: research.discovery, researchResponseBytes: research.maxSourceBytes, expiresAt: now + 86_400_000,
    maxOutputTokens: provider.maxOutputTokens, maxRetries: provider.maximumDeliberateRetries,
    maxEditorialRevisions: provider.maximumEditorialRevisions, retainedReservation: fingerprint(reservation),
    ledger: { id: fingerprint({ approvedDigest, context: current.contextDigest }), startingLedger: ledgerHash, baselineAttempts: receipts.length,
      requests: provider.maximumTotalRequests, generations: provider.maximumGenerations, capMicros: 1_000_000,
      inputTokens: provider.maxInputTokens, inputBytes: 144_000 },
  };
}
