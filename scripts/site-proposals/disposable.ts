import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { activationFixture } from "../activation/disposable";
import { intakeAnswersV2 } from "../../tests/helpers/intake";
import { fingerprint } from "../../lib/platform/canonical/model";
import { inspectCanonical } from "../../lib/platform/canonical/writes";
import { SiteProposalService } from "../../lib/platform/content-editing/proposals";
import { PostgresProposalPersistence } from "../../lib/platform/content-editing/proposal-postgres";
import { type Actor, type CustomerAuthority, type Copy, type PageProposal, type Permission, type ProposalAuthority } from "../../lib/platform/content-editing/proposal";
import type { Scope } from "../../lib/platform/content-editing/authority";

// Synthetic fixture authority only; never an authentication/customer-identity adapter.
export async function siteProposalFixture(databaseUrl: string, durable = false) {
  const f = await activationFixture(databaseUrl), activation = f.service();
  try {
    const a = await f.submit("DIRECT_START", intakeAnswersV2());
    const created = await activation.create(a.context, { requestId: randomUUID(), scope: a.scope, submissionId: a.submission.id, submissionDigest: a.submission.digest });
    await activation.update(a.context, created.id, a.scope, 1, randomUUID(), "confirm-commercial", { source: "agreement-order", reference: "Synthetic commercial authorization", confirmedAt: new Date().toISOString(), launchScope: "One representative draft", ongoingScope: "Continuing care" });
    const init = f.grant(a.scope, ["initialize-customer", "inspect"]), plan = await activation.canonicalReadiness(init, created.id, a.scope);
    const initialized = await activation.initializeCanonicalCustomer(init, created.id, a.scope, { requestId: randomUUID(), expectedVersion: 2, expectedCustomerFingerprint: plan.customerStateFingerprint, identity: { organizationName: "Synthetic confirmed business", webPresenceName: "Synthetic presence", managedSiteName: "Synthetic inactive site", confirmation: { reference: "Synthetic identity confirmation", confirmedAt: new Date().toISOString() } } });
    const b = initialized.canonicalBinding!, customer = { organizationId: b.organizationId, webPresenceId: b.webPresenceId, managedSiteId: b.managedSiteId };
    const scope: Scope = { webPresenceId: b.webPresenceId, managedSiteId: b.managedSiteId };
    const confirm = f.grantScopes([a.scope, { ...scope, pendingCustomerId: a.scope.pendingCustomerId }], ["confirm-business-information"]);
    const confirmed: Awaited<ReturnType<typeof activation.confirmBusinessInformation>>[] = [];
    for (const fact of [{ field: "audience" as const, key: "audience", value: "Independent regional businesses" }, { field: "offer" as const, key: "advisory", type: "service" as const, name: "Business advisory", summary: "Practical advice for independent businesses.", detail: "Confirmed business planning and operational advice." }]) {
      const current = await activation.inspect(init, created.id, a.scope), at = new Date().toISOString();
      confirmed.push(await activation.confirmBusinessInformation(confirm, created.id, a.scope, { requestId: randomUUID(), expectedVersion: current.version, customer, record: { id: null, expectedVersion: null, expectedFingerprint: null }, fact, source: { kind: "onboarding", reference: "Synthetic customer fact confirmation", suppliedAt: at }, confirmation: { confirmed: true, reference: "Synthetic customer attestation", at } }));
    }
    const grants = new WeakMap<object, { scope: Scope; operations: Permission[]; actor: Actor; customer?: CustomerAuthority }>();
    const authority: ProposalAuthority = { async authorize(context, operation, selected) {
      const g = context && typeof context === "object" ? grants.get(context) : undefined;
      if (!g || !g.operations.includes(operation) || fingerprint(g.scope) !== fingerprint(selected)) throw Error("Missing scoped proposal authority");
      return { ...g.actor, ...(g.customer ? { customer: g.customer } : {}) };
    } };
    const grant = (operations: Permission[], customer?: CustomerAuthority, selected = scope) => { const token = Object.freeze({}); grants.set(token, { scope: selected, operations, actor: { operatorId: "synthetic-proposal-operator", authorityReference: "synthetic-capability" }, ...(customer ? { customer } : {}) }); return token; };
    const operator = grant(["prepare-site-proposal", "inspect-site-proposal", "revise-site-proposal", "preview-site-proposal"]);
    const approver = grant(["approve-site-proposal"], { kind: "business-representative", subjectId: "synthetic-customer-representative", authorityReference: "Synthetic verified representative mandate" });
    const service = new SiteProposalService(f.pool, authority, durable ? new PostgresProposalPersistence(f.pool) : undefined);
    const editorial = (text: string): Copy => ({ kind: "editorial", text, rationale: "Editorial framing only; not a new business fact" });
    const fact = (index: number, field: string): Copy => ({ kind: "canonical", source: { domain: index === 0 ? "knowledge" : "offering", recordId: confirmed[index].confirmation.recordId, revision: confirmed[index].confirmation.revision, fingerprint: confirmed[index].confirmation.revisionFingerprint, field } });
    const page: PageProposal = { operation: "create-page", pageId: randomUUID(), slug: "/", title: editorial("A practical starting point"), purpose: "Representative synthetic page to prove proposal mechanics; not a real Home direction", sections: [
      { id: randomUUID(), type: "hero", heading: fact(1, "name"), text: fact(1, "summary") },
      { id: randomUUID(), type: "intro", heading: editorial("Who this is for"), text: fact(0, "audience") },
      { id: randomUUID(), type: "intro", heading: editorial("A focused starting point"), text: fact(1, "detail") },
    ] };
    return { ...f, activation, caseId: created.id, service, authority, scope, operator, approver, grant, page, confirmed, editorial, fact,
      canonical: async (index: number) => inspectCanonical(f.pool, index === 0 ? "knowledge" : "offering", scope.webPresenceId, confirmed[index].confirmation.recordId) };
  } catch (error) { await f.stop(); throw error; }
}

export async function writeProposalProof(f: Awaited<ReturnType<typeof siteProposalFixture>>, id: string) {
  const before = await f.service.inspect(f.operator, id, f.scope), revision = before.revisions.at(-1)!;
  const preview = await f.service.preview(f.operator, revision.binding, randomUUID());
  const approval = await f.service.approve(f.approver, { binding: revision.binding, requestId: randomUUID(), previewDigest: preview.digest, previewEvent: preview.event, reference: "Synthetic human inspected this exact full preview" });
  const after = await f.service.inspect(f.operator, id, f.scope);
  const directory = "runtime-content/site-proposal-proof"; await mkdir(directory, { recursive: true });
  await writeFile(`${directory}/candidate.html`, preview.html);
  await writeFile(`${directory}/inspection.json`, JSON.stringify({ label: "SYNTHETIC DISPOSABLE EVIDENCE ONLY; source fixture removed after proof", confirmedSources: f.confirmed.map(c => ({ confirmation: c.confirmation, revision: c.revision })), proposal: after, approval, previewDigest: preview.digest, activeContentChanged: false }, null, 2));
  await writeFile(`${directory}/inspection.md`, `# Synthetic Managed Site change proposal\n\nNot a real customer site or Home direction. Direct Start; no Review dependency.\n\nProposal: ${id}\nRevision: ${revision.binding.revision}\nDigest: ${revision.binding.digest}\nBase: ${revision.binding.baseFingerprint}\nState: ${after.state}\nPublication: none\n\nOpen candidate.html to read the full candidate using the existing Section renderer. CTA links are inert; no external requests or submissions.\n\nFacts: confirmed Offering name/summary/detail; confirmed audience Knowledge. Copy origin is labeled per field in the preview. Full immutable sources, current inactive graph, ordered Sections, earlier revisions and approval mandate are in inspection.json and the local proposal ledger. All canonical/site rows remain unchanged by preparation, preview and approval. The disposable schema is removed after proof.\n`);
  return after;
}
