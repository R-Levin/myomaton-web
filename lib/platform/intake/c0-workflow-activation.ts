import { createHash } from "node:crypto";
import { fingerprint } from "../canonical/model";
import { c0DisclosureManifest } from "./c0-workflow-knowledge";
import type { WorkflowContext } from "./presence-workflow";
import type { PresenceWorkflowGrant } from "./presence-workflow-provider";
import { validateDiscovery, validateResearchSources, type PublicResearchSource, type ResearchDiscovery } from "./presence-workflow-research";

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
