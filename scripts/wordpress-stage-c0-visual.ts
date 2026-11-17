import assert from "node:assert/strict";
import { createHash, createPrivateKey, createPublicKey, randomBytes, randomUUID } from "node:crypto";
import { lstat, readFile, realpath, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { managedKey, provisionManagedObject, readManagedObject } from "../lib/platform/assets/local-storage";
import { validateStoredMedia } from "../lib/platform/assets/media-validation";
import { fingerprint } from "../lib/platform/canonical/model";
import { pageProposal } from "../lib/platform/content-editing/proposal";
import { siteBase } from "../lib/platform/content-editing/proposal-context";
import { resolveProposalCandidate, type PrivateProposalMedia, type ResolvePrivateVisuals } from "../lib/platform/content-editing/proposal-media";
import { readNativeDraftEnvelope } from "../lib/platform/wordpress-delivery/native-draft-envelope";
import { NativeDraftReceiptJournal } from "../lib/platform/wordpress-delivery/native-draft-receipt";
import { migrationRole, operatorRole, protectedConnection, protectedPool, verifyProtectedSession } from "../lib/platform/wordpress-delivery/protected-connection";
import { protectedOperatorServices } from "../lib/platform/wordpress-delivery/protected-services";

const manifestSha = "36f5dbffa00da0a8a407fa268adb83177def9adeb21b219b62f0cded2eb8b28d";
const site = {
  organizationId: "b3b46645-0364-4329-83c7-86a6ea9e56c4",
  webPresenceId: "819d007a-595d-4374-a2f0-96b900d46559",
  managedSiteId: "1d92a248-416f-4e22-baaf-d2f1fca70352",
};
const scope = { webPresenceId: site.webPresenceId, managedSiteId: site.managedSiteId };
const installationId = "d84ebc69-46d5-4c64-adc6-ac7b87468f89";
const origin = "https://miopages.org";
const siteProposalId = "1e28f792-624d-4141-96db-45c4ba05e17d";
const previousDigest = "2fd1dd2b6780a5f4e8af35c45f80845578032de06b632b05a9012ff52a455ae0";
const rollback = { revision: 3, digest: "85786f251ed5b93e42d9ae2b8c7247d85d99280aa9b1bc5932a1321330a043db" };
const baselinePages = [{ id: "e3252729-a647-4bd8-9124-83facde5ac26", path: "/" },
  { id: "8324102e-7436-4bfd-87b0-1271d4b1b533", path: "/service" }];
const canonicalBase = "8c342e25aa3c962b98a9292bfd871873aca87364b0a6d44b3be6847c09a11ebd";
const authorGrants = ["prepare-site-proposal", "preview-site-proposal"] as const;
const independentGrants = ["approve-site-proposal", "review-private-stage", "authorize-native-draft"] as const;
const restrictions = ["inspect-site-proposal", "revise-site-proposal", "issue", "enroll", "rotate", "revoke"] as const;
const mandate = { kind: "accepted-authority", subjectId: "synthetic-native-draft-fixture",
  authorityReference: "Owner approved non-public C0 visual staging only " + manifestSha };
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

function stableId(value: unknown) {
  const s = fingerprint([manifestSha, value]);
  return s.slice(0, 8) + "-" + s.slice(8, 12) + "-5" + s.slice(13, 16) + "-8" + s.slice(17, 20) + "-" + s.slice(20, 32);
}

async function guarded(name: string, directory = false) {
  const s = await lstat(name);
  assert.ok((directory ? s.isDirectory() : s.isFile()) && s.uid === process.getuid?.() &&
    (s.mode & 0o777) === (directory ? 0o700 : 0o600) && await realpath(name) === name);
}

async function file(name: string) {
  await guarded(name);
  return readFile(name);
}

const readJson = async (name: string) => JSON.parse((await file(name)).toString("utf8"));
const save = (name: string, data: unknown) => writeFile(name, JSON.stringify(data) + "\n", { flag: "wx", mode: 0o600 });

type EvaluatedPage = { id: string; path: string; title: string; composition: "managed-v1"; navigationLabel: string;
  sections: { id: string; type: "hero" | "intro" | "cta"; content: { heading: string; text: string } }[] };
type EvaluatedImage = { sectionId: string; file: string; digest: string; alt: string; width: number; height: number };

async function exactPacket(root: string) {
  const manifest = await file(join(root, "manifest.json"));
  assert.equal(sha(manifest), manifestSha);
  const approved = JSON.parse(manifest.toString());
  assert.equal(approved.destination.installationId, installationId);
  const bytes = await file(join(root, "site-6801.json"));
  assert.equal(sha(bytes), approved.candidate.renderFileSha256);
  const packet = JSON.parse(bytes.toString());
  const exactPages: EvaluatedPage[] = packet.candidate.pages;
  const images: EvaluatedImage[] = packet.images;
  assert.equal(packet.digest, approved.candidate.evaluatedVisualDigest);
  assert.equal(packet.coreRenderDigest, approved.candidate.coreRenderDigest);
  assert.equal(packet.evaluationOnly, true);
  assert.deepEqual(exactPages.map(p => p.path), approved.candidate.paths);
  assert.equal(exactPages.flatMap(p => p.sections).length, approved.candidate.sections);
  assert.equal(packet.candidate.actions.length, approved.candidate.actions);
  assert.equal(images.length, approved.candidate.images.length);
  const mediaRoot = join(root, "asset-custody");
  const media = new Map<string, PrivateProposalMedia>();
  const editorial = (text: string) => ({ kind: "editorial", text, rationale: mandate.authorityReference });
  const pages = exactPages.map(p => pageProposal({
    operation: "create-page", pageId: baselinePages.find(x => x.path === p.path)?.id ?? p.id,
    slug: p.path, title: editorial(p.title), purpose: p.navigationLabel, composition: p.composition, navigationLabel: p.navigationLabel,
    workflowReview: { intakeId: approved.candidate.evaluationCase, candidateDigest: packet.digest },
    sections: p.sections.map(s => {
      const image = images.find(x => x.sectionId === s.id);
      if (!image) return { id: s.id, type: s.type, heading: editorial(s.content.heading), text: editorial(s.content.text) };
      const pin = approved.candidate.images.find((x: { path: string; sectionId: string }) => x.path === p.path && x.sectionId === s.id);
      assert.equal(image.digest, pin?.sha256);
      assert.equal(basename(image.file), image.file);
      const assetId = stableId(["asset", image.digest]), usageId = stableId(["usage", s.id]);
      media.set(s.id, { sectionId: s.id, assetId, usageId, role: "image",
        configuration: { image: { altText: image.alt, decorative: false } }, preparedDigest: image.digest,
        mimeType: "image/png", width: image.width, height: image.height, priorUsage: null,
        evidence: { source: "private-generated", permission: "non-public-draft-only", sourceDigest: image.digest,
          provenanceDigest: p.path === "/" ? packet.homeEvidenceDigest : packet.coreRenderDigest,
          reviewDigest: packet.digest, reference: mandate.authorityReference } });
      return { id: s.id, type: s.type, heading: editorial(s.content.heading), text: editorial(s.content.text),
        image: { assetId, usageId, altText: image.alt } };
    }),
  }));
  assert.equal(media.size, 2);
  const mediaBytes = new Map<string, Buffer>();
  for (const image of images) {
    const master = await file(join(root, image.file));
    assert.equal(sha(master), image.digest);
    await validateStoredMedia(master, "image/png", image);
    mediaBytes.set(image.digest, master);
  }
  const draft = { installationId, siteProposalId, revision: 6, previousDigest, rollback, baselinePages,
    navigation: packet.candidate.navigation, actions: packet.candidate.actions };
  const resolve: ResolvePrivateVisuals = async (selection, proposed, resolved) => {
    assert.deepEqual(selection, scope);
    assert.deepEqual(proposed, pages.find(p => p.pageId === proposed.pageId));
    const projection = exactPages.find(p => p.path === proposed.slug)!;
    assert.equal(resolved.title, projection.title);
    assert.deepEqual(resolved.sections.map(s => ({ id: s.id, type: s.type, content: s.content })), projection.sections);
    const placements = proposed.sections.flatMap(s => media.get(s.id) ?? []);
    const privateImages = Object.fromEntries(await Promise.all(placements.map(async m => {
      const bytes = await readManagedObject(mediaRoot, scope.webPresenceId, "objects/" + m.preparedDigest);
      return [m.sectionId, { assetId: m.assetId, src: "data:image/png;base64," + bytes.toString("base64"),
        width: m.width, height: m.height, alt: m.configuration.image.altText }];
    })));
    return { media: placements, images: privateImages };
  };
  return { approved, pages, draft, resolve, mediaRoot, mediaBytes, exactPages };
}

type Principal = { id: string; token: string; grants: { id: string; permission: typeof authorGrants[number] | typeof independentGrants[number] }[] };
const grants = [authorGrants, ...independentGrants.map(p => [p] as const)];
let stage = "custody", grantState = "not-started";

async function main() {
  const home = await realpath(process.env.HOME ?? "");
  assert.equal(home, "/home/virtual/vps-bef564/5/53b4381d42");
  const root = join(home, "miopages-c0-stage-36f5dbff");
  assert.equal(await realpath(process.cwd()), root);
  await guarded(root, true);
  const [operation] = process.argv.slice(2);
  assert.ok(process.argv.length === 3 && ["preflight", "authorize", "issue", "reconcile-apply", "issue-restore", "reconcile-restore"].includes(operation));
  const packet = await exactPacket(root);
  const retained = join(home, "miopages-native-draft-enrollment-LaSVWc");
  await guarded(retained, true);
  const { installation, signingKey, secretHex } = await readJson(join(retained, "session.json"));
  assert.equal(installation.origin, origin);
  assert.equal(installation.installationId, installationId);
  const secret = Buffer.from(secretHex, "hex");
  const journal = new NativeDraftReceiptJournal(join(retained, "receipts"));
  const recovery = { journal, secret, credentialId: installation.credentialId };
  stage = "baseline";
  const expectedPosts = packet.approved.baseline.drafts.map((p: { path: string; wordPressId: number; sha256: string }) =>
    ({ path: p.path, id: p.wordPressId, contentSha256: p.sha256 }));
  const restored = await journal.verifyMaterializedBaseline({ installationId, siteProposalId, requestedDigest: previousDigest,
    appliedDigest: rollback.digest, revision: rollback.revision, paths: baselinePages.map(p => p.path) }, secret);
  assert.deepEqual(restored.posts, expectedPosts);
  for (const bytes of packet.mediaBytes.values()) await provisionManagedObject(packet.mediaRoot, scope.webPresenceId, managedKey(bytes), bytes);

  const saved = await readJson(join(home, "miopages-wp-db-20261105T181534Z/wordpress-role-credentials.json"));
  const ca = await readFile(join(home, "supabase-ca.crt"), "utf8");
  const operator = protectedPool(saved.operator.url, operatorRole, ca);
  const services = protectedOperatorServices(operator, db => protectedConnection(db, operatorRole, "postgres"),
    "https://wp-acceptance.miopages.com", { root: packet.mediaRoot, resolve: packet.resolve });
  const authenticate = async (principals: Principal[]) => {
    assert.equal(new Set(principals.map(p => p.id)).size, grants.length);
    assert.deepEqual(principals.map(p => p.grants.map(g => g.permission)), grants);
    return Promise.all(principals.map(async p => {
      const actor = await services.operator.authenticate(p.token);
      for (const g of p.grants) {
        const effective = await services.operator.authorize(actor, g.permission, scope);
        assert.deepEqual(effective, { operatorId: p.id, authorityReference: g.id,
          ...(g.permission === "approve-site-proposal" && { customer: mandate }) });
        await assert.rejects(services.operator.authorize(actor, g.permission, { ...scope, managedSiteId: randomUUID() }), /refused/);
      }
      for (const permission of [...authorGrants, ...independentGrants, ...restrictions]) {
        if (!p.grants.some(g => g.permission === permission)) await assert.rejects(services.operator.authorize(actor, permission, scope), /refused/);
      }
      return actor;
    }));
  };

  try {
    if (operation === "preflight") {
      stage = "read-only-projection";
      const db = await operator.connect();
      try {
        await verifyProtectedSession(db, operatorRole, "postgres");
        await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
        const baseline = await siteBase(db, scope);
        assert.equal(fingerprint(baseline), canonicalBase);
        for (const page of packet.pages) await resolveProposalCandidate(db, scope, page, baseline, undefined, undefined, packet.resolve);
        await db.query("ROLLBACK");
      } finally { db.release(); }
      console.log(JSON.stringify({ status: "PASS", operation, pages: packet.pages.length, privateImages: packet.mediaBytes.size }));
      return;
    }

    if (operation === "authorize") {
      stage = "migration-password";
      const [password, extra] = (await readFile("/dev/stdin", "utf8")).split("\n");
      assert.ok(password && extra === "");
      const url = new URL(saved.operator.url);
      assert.ok(url.username.startsWith(operatorRole + ".") && url.hostname === "aws-0-us-east-1.pooler.supabase.com");
      url.username = url.username.replace(operatorRole + ".", migrationRole + ".");
      url.password = encodeURIComponent(password);
      const migration = protectedPool(url.href, migrationRole, ca);
      const principals = grants.map(assigned => ({ id: randomUUID(), token: randomBytes(32).toString("hex"),
        grants: assigned.map(permission => ({ permission, id: randomUUID() })) }));
      const expiresAt = new Date(Date.now() + 48 * 3_600_000).toISOString();
      stage = "grant-preflight";
      try {
        const db = await migration.connect();
        try {
          await verifyProtectedSession(db, migrationRole, "postgres");
          await db.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
          try {
            await db.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'");
            await db.query("SELECT pg_advisory_xact_lock(hashtext('miopages-c0-stage-36f5dbff'))");
            assert.equal(fingerprint(await siteBase(db, scope)), canonicalBase);
            const { rows: [i] } = await db.query(
              "SELECT i.origin,i.status,i.generation,i.organization_id,i.web_presence_id,i.managed_site_id,k.credential_id,k.key_id,k.public_key FROM wordpress_installations i JOIN wordpress_installation_keys k ON k.installation_id=i.id AND k.generation=i.generation WHERE i.id=$1", [installationId]);
            assert.deepEqual(i, { origin, status: "active", generation: 1, organization_id: site.organizationId, web_presence_id: site.webPresenceId,
              managed_site_id: site.managedSiteId, credential_id: installation.credentialId, key_id: installation.keyId, public_key: installation.publicKeyBase64 });
            const { rows: [head] } = await db.query("SELECT revision,candidate_digest,site_proposal_id FROM wordpress_native_draft_authorizations WHERE installation_id=$1 ORDER BY revision DESC LIMIT 1", [installationId]);
            assert.deepEqual(head, { revision: 5, candidate_digest: previousDigest, site_proposal_id: siteProposalId });
            const active = await db.query("SELECT permission FROM wordpress_operator_grants g JOIN wordpress_operator_credentials c ON c.id=g.operator_id WHERE g.web_presence_id=$1 AND g.managed_site_id=$2 AND g.permission=ANY($3::text[]) AND g.revoked_at IS NULL AND c.revoked_at IS NULL AND c.expires_at>clock_timestamp()", [scope.webPresenceId, scope.managedSiteId, [...authorGrants, ...independentGrants]]);
            assert.deepEqual(active.rows.map(p => p.permission), ["prepare-site-proposal"]);
            stage = "provision-scoped-grants";
            await save(join(root, "custody.json"), { expiresAt, principals, manifestSha });
            for (const p of principals) {
              await db.query("INSERT INTO wordpress_operator_credentials(id,token_sha256,expires_at) VALUES($1,$2,$3)", [p.id, sha(Buffer.from(p.token, "hex")), expiresAt]);
              for (const g of p.grants) {
                await db.query("INSERT INTO wordpress_operator_grants(id,operator_id,web_presence_id,managed_site_id,permission,customer) VALUES($1,$2,$3,$4,$5,$6)",
                  [g.id, p.id, scope.webPresenceId, scope.managedSiteId, g.permission, g.permission === "approve-site-proposal" ? mandate : null]);
              }
            }
            grantState = "commit-pending";
            await db.query("COMMIT");
            grantState = "committed";
          } catch (error) { await db.query("ROLLBACK"); throw error; }
        } finally { db.release(); }
      } finally { await migration.end(); }
      stage = "independent-grant-readback";
      await authenticate(principals);
      console.log(JSON.stringify({ status: "PASS", operation, expiresAt, grants: 5, principals: 4 }));
      return;
    }

    const { principals, expiresAt, manifestSha: custodySha } = await readJson(join(root, "custody.json"));
    assert.equal(custodySha, manifestSha);
    assert.ok(Date.parse(expiresAt) > Date.now());
    const [author, approver, reviewer, authorizer] = await authenticate(principals);
    const key = createPrivateKey(signingKey);
    const publicKey = createPublicKey(key).export({ format: "jwk" });
    assert.ok(publicKey.crv === "Ed25519" && publicKey.x);
    assert.equal(Buffer.from(publicKey.x, "base64url").toString("base64"), installation.publicKeyBase64);
    if (operation === "issue") {
      const references = [];
      for (const page of packet.pages) {
        stage = "prepare:" + page.slug;
        const proposalId = stableId(["proposal", page.slug]);
        const event = await services.proposals(author).prepare(author, proposalId, scope, stableId(["prepare", page.slug]), page);
        const binding = event.revision?.binding;
        assert.ok(binding && binding.baseFingerprint === canonicalBase);
        stage = "preview:" + page.slug;
        const preview = await services.proposals(author).preview(author, binding, stableId(["preview", page.slug]));
        stage = "approve:" + page.slug;
        const approved = await services.proposals(approver).approve(approver, { binding, previewDigest: preview.digest,
          previewEvent: preview.event, requestId: stableId(["approve", page.slug]), reference: mandate.authorityReference });
        references.push({ proposalId, approvalId: approved.hash });
      }
      stage = "native-draft-preview";
      const preview = await services.review.previewSiteDraft(reviewer, site, references, packet.draft);
      assert.deepEqual(preview.candidate.pages, packet.exactPages.map(p => ({ ...p, id: baselinePages.find(x => x.path === p.path)?.id ?? p.id })));
      assert.deepEqual(preview.candidate.navigation, packet.draft.navigation);
      assert.deepEqual(preview.candidate.actions, packet.draft.actions);
      assert.equal(preview.candidate.media?.length, 2);
      stage = "independent-site-authorization";
      await services.review.authorizeSiteDraft(authorizer, reviewer, site, references, packet.draft, preview.digest, recovery);
      stage = "issue-exact-bundle";
      const bundle = await services.review.issueSiteDraftBundle(authorizer, reviewer, site, references, packet.draft, preview.digest, key, recovery);
      const signed = readNativeDraftEnvelope(bundle.envelope, installation.keyId, installation.publicKeyBase64);
      assert.equal(signed.digest, preview.digest);
      assert.equal(signed.operation, "apply");
      assert.equal(bundle.copies.length, 2);
      await save(join(root, "bundle.json"), bundle);
      await save(join(root, "signing-evidence.json"), { manifestSha, candidateDigest: preview.digest, expiresAt, references });
      console.log(JSON.stringify({ status: "PASS", operation, candidateDigest: preview.digest, pages: references.length, images: bundle.copies.length, expiresAt }));
      return;
    }

    const bundle = await readJson(join(root, "bundle.json"));
    if (operation === "issue-restore") {
      stage = "exact-rollback-signature";
      const envelope = await services.review.issueRetainedSiteDraftRestore(authorizer, reviewer, site, installationId, bundle.envelope, key, recovery);
      await save(join(root, "restore.json"), envelope);
      console.log(JSON.stringify({ status: "PASS", operation, revision: rollback.revision }));
      return;
    }
    stage = "receipt-verification";
    const apply = operation === "reconcile-apply";
    const envelope = apply ? bundle.envelope : await readJson(join(root, "restore.json"));
    const decision = await services.review.nativeDraftReceiptDecision(reviewer, site, installationId, envelope);
    assert.equal(decision.credentialId, installation.credentialId);
    const receipt = await readJson(join(root, apply ? "receipt-apply.json" : "receipt-restore.json"));
    const proof = await journal.record(decision.expected, secret, receipt);
    if (!apply) assert.deepEqual(proof.posts, expectedPosts);
    console.log(JSON.stringify({ status: "PASS", operation, revision: proof.revision, pages: proof.posts.length,
      images: proof.attachments?.length ?? 0, appliedDigest: proof.appliedDigest, posts: proof.posts.map(p => ({ path: p.path, id: p.id })) }));
  } finally { secret.fill(0); await operator.end(); }
}

void main().catch((error: { code?: string }) => {
  console.error(JSON.stringify({ status: "BLOCKED", stage, grantState, code: error.code && /^[0-9A-Z_]{3,50}$/u.test(error.code) ? error.code : "VERIFICATION" }));
  process.exitCode = 1;
});
