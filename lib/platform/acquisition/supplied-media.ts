import { randomUUID } from "node:crypto";
import { realpath } from "node:fs/promises";
import path from "node:path";
import type { Pool, PoolClient } from "pg";
import { managedKey, provisionManagedObject, readManagedObject } from "../assets/local-storage";
import { prepareRaster } from "../assets/raster-ingestion";
import { validateStoredMedia } from "../assets/media-validation";
import { MAX_MANAGED_BYTES } from "../assets/source";
import { choice, fingerprint, object, text, uuid } from "../canonical/model";
import { hash, proposalScope, type Actor } from "../content-editing/proposal";
import { siteBase } from "../content-editing/proposal-context";
import { requireDisposableMedia } from "../content-editing/proposal-media";
import { appendEvent, candidateSubject, recordCandidateDecision, transaction, type Candidate } from "./service";
import { suppliedDecision, originalAsset, suppliedPolicy, suppliedSubjectMatches, type SuppliedDecision,
  type SuppliedLineage, type SuppliedPlacement, type SuppliedProvenance, type SuppliedReceipt, type SuppliedSource } from "./supplied-evidence";
import { readUploadPng, requireCurrentUploadAgreement, uploadAgreement, uploadRequest, type CustomerUploadAuthority } from "./customer-upload";
import { eligibleStock, stockPolicy, type StockSelection } from "./stock";

type Operation = "receive-supplied-media" | "review-supplied-media" | "revoke-supplied-media";
export interface SuppliedMediaAuthority {
  authorize(context: unknown, operation: Operation, placement: SuppliedPlacement): Promise<Actor>;
}

export function placementInput(value: SuppliedPlacement): SuppliedPlacement {
  const { webPresenceId, managedSiteId, pageId, sectionId } = object(value, ["webPresenceId", "managedSiteId", "pageId", "sectionId"]);
  return { ...proposalScope({ webPresenceId, managedSiteId }), pageId: uuid(pageId), sectionId: uuid(sectionId) };
}

function sourceInput(value: SuppliedSource): SuppliedSource {
  const raw = object(value, ["kind", "reference", "suppliedBy", "claim", "evidenceReference", "existingAssetId"]);
  const kind = choice(raw.kind, ["upload", "website-reuse", "authorized-asset"]);
  const existingAssetId = raw.existingAssetId == null ? null : uuid(raw.existingAssetId);
  if ((kind === "authorized-asset") !== Boolean(existingAssetId)) throw Error("Exact existing source Asset required only for authorized Asset reuse");
  return { kind, existingAssetId, reference: text(raw.reference, 300), suppliedBy: text(raw.suppliedBy, 200),
    claim: choice(raw.claim, ["ownership", "license", "specific-permission"]),
    evidenceReference: raw.evidenceReference == null ? null : text(raw.evidenceReference, 300) };
}

async function placementContext(db: PoolClient, placement: SuppliedPlacement) {
  const base = await siteBase(db, placement);
  const page = base.pages.find(row => row.id === placement.pageId && row.status === "active");
  const section = base.sections.find(row => row.id === placement.sectionId && row.page_id === page?.id
    && row.type === "intro" && row.status === "active");
  if (!page || !section) throw Error("Owned existing Intro placement required");
  return { digest: fingerprint({ graph: base.graph, page, section }), page, section };
}

async function ownedCandidate(db: PoolClient, placement: SuppliedPlacement, id: string, lock: boolean) {
  const rows = await db.query(`SELECT c.*,w.context_digest,w.status AS work_status FROM media_candidates c JOIN external_work w
    ON w.id=c.work_id AND w.web_presence_id=c.web_presence_id WHERE c.id=$1 AND c.web_presence_id=$2
    AND w.capability='supplied-raster'${lock ? " FOR UPDATE OF w,c" : ""}`, [uuid(id), placement.webPresenceId]);
  const candidate = rows.rows[0] as Candidate & { context_digest: string; work_status: string } | undefined;
  const provenance = candidate?.provenance as SuppliedProvenance | undefined;
  if (!candidate || !provenance || fingerprint(provenance.placement) !== fingerprint(placement)) throw Error("Owned supplied-media candidate required");
  return { candidate, provenance };
}

const overlaps = (a: string, b: string) => {
  const relative = path.relative(a, b);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(".." + path.sep));
};

// Trusted composition root. The upload request adapter has no installed route.
// Customer and Operator grants come from separate authority adapters.
export class SuppliedMediaIntake {
  constructor(private pool: Pool, private authority: SuppliedMediaAuthority, private quarantine: string, private managed: string, private customerUpload?: CustomerUploadAuthority) {}

  private get agreementVerifier() {
    return this.customerUpload?.verifyCurrent.bind(this.customerUpload);
  }

  private async actor(context: unknown, operation: Operation, placement: SuppliedPlacement) {
    const grant = object(await this.authority.authorize(context, operation, structuredClone(placement)), ["operatorId", "authorityReference"]);
    return { operatorId: text(grant.operatorId), authorityReference: text(grant.authorityReference, 300) };
  }

  private async boundary(db: PoolClient) {
    await requireDisposableMedia(db);
    await db.query("SELECT set_config('search_path', current_schema(), true)");
    await db.query("SET LOCAL TIME ZONE 'UTC'");
    const [quarantine, managed] = await Promise.all([realpath(this.quarantine), realpath(this.managed)]);
    if (overlaps(quarantine, managed) || overlaps(managed, quarantine)) throw Error("Private staging and managed storage must be separate");
  }

  async receive(context: unknown, target: SuppliedPlacement, input: { submissionId: string; source: SuppliedSource; bytes?: Buffer }) {
    const placement = placementInput(target), submissionId = uuid(input.submissionId), source = sourceInput(input.source);
    const actor = await this.actor(context, "receive-supplied-media", placement);
    if (source.existingAssetId ? input.bytes !== undefined
      : !Buffer.isBuffer(input.bytes) || !input.bytes.length || input.bytes.length > MAX_MANAGED_BYTES) throw Error("Exact bounded raster input required");
    return this.stage(placement, submissionId, { source, receivedBy: actor }, input.bytes && Buffer.from(input.bytes));
  }

  async receiveCustomer(request: Request, target: SuppliedPlacement) {
    const placement = placementInput(target), { credential, submissionId } = uploadRequest(request);
    if (!this.customerUpload) throw Error("Customer upload authority unavailable");
    const agreement = uploadAgreement(await this.customerUpload.authenticate(credential, structuredClone(placement)));
    const bytes = await readUploadPng(request);
    const candidate = await this.stage(placement, submissionId, {
      source: { kind: "authenticated-upload", agreement, existingAssetId: null },
    }, bytes);
    return { candidateId: candidate.id, subjectDigest: candidate.subject_digest, state: candidate.state };
  }

  async receiveStock(context: unknown, target: SuppliedPlacement, input: { submissionId: string; selection: StockSelection; bytes: Buffer }) {
    const placement = placementInput(target), submissionId = uuid(input.submissionId);
    const receivedBy = await this.actor(context, "receive-supplied-media", placement);
    const selection = eligibleStock(input.selection);
    if (!Buffer.isBuffer(input.bytes) || !input.bytes.length || input.bytes.length > MAX_MANAGED_BYTES) {
      throw Error("Exact bounded stock raster required");
    }
    return this.stage(placement, submissionId, { source: { kind: "permissioned-stock", selection, existingAssetId: null }, receivedBy },
      Buffer.from(input.bytes));
  }

  private async stage(placement: SuppliedPlacement, submissionId: string, receipt: SuppliedReceipt, submitted?: Buffer) {
    const { source } = receipt;
    return transaction(this.pool, async db => {
      await this.boundary(db);
      const owner = placement.webPresenceId;
      const identity = fingerprint({ capability: "supplied-raster", submissionId });
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`${owner}:${identity}`]);
      if (source.kind === "authenticated-upload") {
        await requireCurrentUploadAgreement(db, placement, source.agreement, this.agreementVerifier);
      }
      const original = source.existingAssetId ? await originalAsset(db, owner, source.existingAssetId) : null;
      const bytes = original ? await readManagedObject(this.managed, owner, original.source_reference) : submitted!;
      const sourceDigest = managedKey(bytes).slice(8);
      const stock = source.kind === "permissioned-stock" ? eligibleStock(source.selection) : null;
      if (stock && stock.representation.sourceDigest !== sourceDigest) throw Error("Selected stock representation bytes changed");
      const sourceKind = stock ? "permissioned-stock" : "customer-supplied";
      const provider = stock?.provider ?? "operator-assisted";
      const policy = stock ? stockPolicy : suppliedPolicy;
      const provenance: SuppliedProvenance = { ...receipt, sourceDigest,
        originalAssetDigest: original && fingerprint(original), transformation: original ? "reuse-prepared/1" : "managed-raster-prepare/1",
        placement, role: "image" };
      const prior = (await db.query(`SELECT c.* FROM external_work w JOIN media_candidates c ON c.work_id=w.id AND c.web_presence_id=w.web_presence_id
        WHERE w.web_presence_id=$1 AND w.identity=$2 AND w.capability='supplied-raster'`, [owner, identity])).rows[0] as Candidate | undefined;
      if (prior) {
        if (fingerprint(provenance) !== prior.provenance_digest) throw Error("Supplied-media submission idempotency conflict");
        if (["proposed", "approved"].includes(prior.state)) {
          await readManagedObject(this.quarantine, owner, prior.quarantine_key);
          if (source.kind === "authenticated-upload") await readManagedObject(this.quarantine, owner, managedKey(bytes));
        }
        return prior;
      }
      const { digest: contextDigest } = await placementContext(db, placement);
      const prepared = original ? { bytes, mimeType: "image/png", width: original.width, height: original.height } : await prepareRaster(bytes);
      if (prepared.mimeType !== "image/png" || prepared.bytes.length > 1024 * 1024) throw Error("Disposable intake requires a bounded PNG");
      await validateStoredMedia(prepared.bytes, prepared.mimeType, prepared);
      const key = managedKey(prepared.bytes);
      const work = (await db.query(`INSERT INTO external_work(web_presence_id,capability,identity,context_digest,context,provider,model,template_version,iteration,budget_micros)
        VALUES($1,'supplied-raster',$2,$3,$4,$5,'supplied-raster',$6,1,0) RETURNING id,web_presence_id`,
      [owner, identity, contextDigest, placement, provider, policy])).rows[0];
      await appendEvent(db, work, "queued", { submissionId, contextDigest });
      await db.query("UPDATE external_work SET status='running',version=version+1 WHERE id=$1", [work.id]);
      if (source.kind === "authenticated-upload") await provisionManagedObject(this.quarantine, owner, managedKey(bytes), bytes);
      await provisionManagedObject(this.quarantine, owner, key, prepared.bytes);
      const subject = { id: randomUUID(), web_presence_id: owner, revision: 1, bytes_digest: key.slice(8),
        provenance_digest: fingerprint(provenance), width: prepared.width, height: prepared.height, mime_type: prepared.mimeType, policy_version: policy };
      const candidate = (await db.query(`INSERT INTO media_candidates(id,web_presence_id,work_id,source_kind,provider,model,quarantine_key,bytes_digest,subject_digest,provenance_digest,provenance,width,height,mime_type,policy_version,expires_at)
        VALUES($1,$2,$3,$4,$5,'supplied-raster',$6,$7,$8,$9,$10,$11,$12,$13,$14,now()+interval '90 days') RETURNING *`,
      [subject.id, owner, work.id, sourceKind, provider, key, subject.bytes_digest, candidateSubject(subject), subject.provenance_digest, provenance,
        subject.width, subject.height, subject.mime_type, policy])).rows[0] as Candidate;
      await db.query("UPDATE external_work SET status='awaiting-review',version=version+1 WHERE id=$1", [work.id]);
      await appendEvent(db, work, "result", { preparedDigest: subject.bytes_digest }, candidate.id);
      return candidate;
    });
  }

  async inspect(context: unknown, target: SuppliedPlacement, candidateId: string) {
    const placement = placementInput(target);
    await this.actor(context, "review-supplied-media", placement);
    return transaction(this.pool, async db => {
      await this.boundary(db);
      const { candidate } = await ownedCandidate(db, placement, candidateId, false);
      if (!suppliedSubjectMatches(candidate) || candidate.state !== "proposed") throw Error("Supplied-media candidate is not reviewable");
      const { digest, page, section } = await placementContext(db, placement);
      if (digest !== candidate.context_digest) throw Error("Stale supplied-media placement");
      return { candidate, page, section, bytes: await readManagedObject(this.quarantine, placement.webPresenceId, candidate.quarantine_key) };
    });
  }

  async decide(context: unknown, target: SuppliedPlacement, input: {
    candidateId: string; subjectDigest: string; decision: SuppliedDecision["decision"]; reason: string;
    rights?: NonNullable<SuppliedDecision["rights"]>; altText?: string;
  }) {
    const placement = placementInput(target), candidateId = uuid(input.candidateId), subjectDigest = hash(input.subjectDigest);
    const decision = choice(input.decision, ["approve", "reject", "revoke"]);
    const actor = await this.actor(context, decision === "revoke" ? "revoke-supplied-media" : "review-supplied-media", placement);
    const rawRights = input.rights && object(input.rights, ["basis", "reference"]);
    const rights = rawRights ? { basis: choice(rawRights.basis, ["customer-attestation", "service-agreement", "provider-license", "independently-verified"]), reference: text(rawRights.reference, 300) } : null;
    const altText = input.altText === undefined ? null : text(input.altText, 500);
    if (decision === "approve" ? !rights || !altText : rights || altText) throw Error("Approval requires an exact rights basis and contextual alt text");
    const body = { decision, subjectDigest, actor, reason: text(input.reason, 500), rights, altText };
    const review: SuppliedDecision = { ...body, requestDigest: fingerprint(body) };
    return transaction(this.pool, async db => {
      await this.boundary(db);
      // Same relative lock order as release, before taking a candidate row lock.
      if (decision !== "revoke") await db.query("LOCK TABLE pages,sections,assets IN SHARE ROW EXCLUSIVE MODE");
      const { candidate, provenance } = await ownedCandidate(db, placement, candidateId, true);
      if (candidate.subject_digest !== subjectDigest || !suppliedSubjectMatches(candidate)) throw Error("Exact current supplied-media subject required");
      const source = provenance.source;
      if (decision === "approve" && source.kind === "authenticated-upload") {
        await requireCurrentUploadAgreement(db, placement, source.agreement, this.agreementVerifier);
        await readManagedObject(this.quarantine, placement.webPresenceId, "objects/" + hash(provenance.sourceDigest));
      }
      if (decision === "approve" && source.kind === "permissioned-stock") {
        const stock = eligibleStock(source.selection);
        if (stock.provider !== candidate.provider || stock.representation.sourceDigest !== provenance.sourceDigest
          || rights?.basis !== "provider-license" || rights.reference !== stock.license.reference) {
          throw Error("Exact reviewed stock license and representation required");
        }
      }
      const work = { id: candidate.work_id, web_presence_id: placement.webPresenceId };
      const previous = await suppliedDecision(db, candidate, decision);
      const priorAsset = await db.query("SELECT payload->>'assetId' AS id FROM external_work_events WHERE work_id=$1 AND candidate_id=$2 AND kind='ingestion' AND web_presence_id=$3",
        [work.id, candidateId, placement.webPresenceId]);
      if (previous?.requestDigest === review.requestDigest && candidate.state === ({ approve: "ingested", reject: "rejected", revoke: "revoked" })[decision]) {
        return { decision, assetId: decision === "approve" ? uuid(priorAsset.rows[0]?.id) : null };
      }
      if (decision === "revoke") {
        if (!["proposed", "ingested"].includes(candidate.state)) throw Error("Candidate is not revocable");
      } else {
        if (candidate.work_status !== "awaiting-review" || candidate.state !== "proposed") throw Error("Candidate is not reviewable");
        if ((await placementContext(db, placement)).digest !== candidate.context_digest) throw Error("Stale supplied-media placement");
        if (provenance.source.existingAssetId &&
          fingerprint(await originalAsset(db, placement.webPresenceId, provenance.source.existingAssetId)) !== provenance.originalAssetDigest) {
          throw Error("Supplied-media source Asset changed");
        }
        if (rights && source.kind !== "permissioned-stock") {
          const assertion = source.kind === "authenticated-upload"
            ? { basis: "service-agreement", reference: source.agreement.acceptanceReference, references: [source.agreement.acceptanceReference] }
            : { basis: "customer-attestation", reference: source.evidenceReference ?? source.reference, references: [source.reference, source.evidenceReference] };
          const matches = rights.basis === "independently-verified"
            ? !assertion.references.includes(rights.reference)
            : rights.basis === assertion.basis && rights.reference === assertion.reference;
          if (!matches) throw Error("Rights review conflicts with the supplied evidence");
        }
      }
      const bytes = decision === "approve" ? await readManagedObject(this.quarantine, placement.webPresenceId, candidate.quarantine_key) : null;
      await recordCandidateDecision(db, work, candidateId, review);
      let assetId: string | null = null;
      if (bytes) {
        assetId = randomUUID();
        const acquisition: SuppliedLineage = { candidateId, subjectDigest, reviewDigest: fingerprint(review) };
        await provisionManagedObject(this.managed, placement.webPresenceId, candidate.quarantine_key, bytes);
        await db.query(`INSERT INTO assets(id,web_presence_id,name,type,mime_type,width,height,alt_text,source_type,source_reference,metadata)
          VALUES($1,$2,'Reviewed supplied image','image',$3,$4,$5,$6,'managed',$7,$8)`,
        [assetId, placement.webPresenceId, candidate.mime_type, candidate.width, candidate.height, altText, candidate.quarantine_key, { acquisition }]);
        await db.query("UPDATE media_candidates SET state='ingested',version=version+1,updated_at=now() WHERE id=$1", [candidateId]);
        await appendEvent(db, work, "ingestion", { assetId, reviewDigest: acquisition.reviewDigest, preparedDigest: candidate.bytes_digest }, candidateId);
      }
      if (candidate.work_status === "awaiting-review") await db.query("UPDATE external_work SET status='completed',version=version+1 WHERE id=$1", [work.id]);
      return { decision, assetId };
    });
  }
}
