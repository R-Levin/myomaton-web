import assert from "node:assert/strict";
import type { PoolClient } from "pg";
import { object, uuid } from "../../lib/platform/canonical/model";

export const rehearsalSite = { organizationId: "b3b46645-0364-4329-83c7-86a6ea9e56c4",
  webPresenceId: "819d007a-595d-4374-a2f0-96b900d46559", managedSiteId: "1d92a248-416f-4e22-baaf-d2f1fca70352" };
export const rehearsalPermissions = {
  "rehearsal-owner-approver": ["inspect-site-proposal", "preview-site-proposal", "approve-site-proposal"],
  "rehearsal-technical-reviewer": ["prepare-site-proposal", "inspect-site-proposal", "preview-site-proposal", "review-private-stage", "enroll", "issue", "revoke"],
} as const;
const mandate = { kind: "accepted-authority", subjectId: "synthetic-technical-rehearsal-only",
  authorityReference: "Owner-authorized functional test of separate authenticated principals; not independent human governance or real customer mandate. No publication authorization." };

export function principalManifest(value: unknown) {
  const m = object(value, ["version", "principals"]);
  assert.equal(m.version, 1);
  assert.ok(Array.isArray(m.principals) && m.principals.length === 2);
  const principals = m.principals.map((value, index) => {
    const p = object(value, ["reference", "id", "tokenSha256", "grants"]);
    const reference = Object.keys(rehearsalPermissions)[index] as keyof typeof rehearsalPermissions;
    assert.equal(p.reference, reference);
    assert.equal(typeof p.tokenSha256, "string");
    assert.match(p.tokenSha256 as string, /^[a-f0-9]{64}$/);
    assert.ok(Array.isArray(p.grants));
    assert.equal(p.grants.length, rehearsalPermissions[reference].length);
    return { reference, id: uuid(p.id), tokenSha256: p.tokenSha256 as string,
      grants: p.grants.map((value, i) => {
        const g = object(value, ["id", "permission"]);
        assert.equal(g.permission, rehearsalPermissions[reference][i]);
        return { id: uuid(g.id), permission: g.permission as string };
      }) };
  });
  assert.equal(new Set(principals.map(p => p.tokenSha256)).size, 2);
  const ids = principals.flatMap(p => [p.id, ...p.grants.map(g => g.id)]);
  assert.equal(new Set(ids).size, ids.length);
  return { version: 1, principals };
}

// Caller owns the transaction and must authenticate the migration role first.
// Scope is passed separately so disposable tests exercise the same SQL; the
// hosted entry point pins it to rehearsalSite, never to user input.
export async function rehearsalPrincipals(db: PoolClient, value: unknown, site: typeof rehearsalSite, action: "create" | "verify") {
  const manifest = principalManifest(value);
  assert.ok(action === "create" || action === "verify");
  const readOnly = (await db.query("SHOW transaction_read_only")).rows[0].transaction_read_only;
  assert.equal(readOnly, action === "verify" ? "on" : "off");
  await db.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'");
  if (action === "create") await db.query("SELECT pg_advisory_xact_lock(hashtextextended('wordpress-rehearsal-principals/1',0))");
  return principalState(db, manifest, site, action === "create", action === "verify");
}

async function principalState(db: PoolClient, manifest: ReturnType<typeof principalManifest>, site: typeof rehearsalSite, create: boolean, readOnly: boolean) {
  const graph = (await db.query(`SELECT o.status AS organization_status,w.status AS presence_status,s.status AS site_status,w.primary_domain
    FROM public.organizations o JOIN public.web_presences w ON w.organization_id=o.id
    JOIN public.managed_sites s ON s.web_presence_id=w.id WHERE o.id=$1 AND w.id=$2 AND s.id=$3`,
  [site.organizationId, site.webPresenceId, site.managedSiteId])).rows;
  assert.deepEqual(graph, [{ organization_status: "inactive", presence_status: "inactive", site_status: "inactive", primary_domain: null }], "Inactive rehearsal graph required");
  assert.equal((await db.query("SELECT 1 FROM public.managed_site_hostnames WHERE web_presence_id=$1 OR managed_site_id=$2",
    [site.webPresenceId, site.managedSiteId])).rowCount, 0, "Unhosted rehearsal required");
  const ids = manifest.principals.map(p => p.id), hashes = manifest.principals.map(p => p.tokenSha256);
  let credentials = (await db.query(`SELECT id,token_sha256,revoked_at,expires_at>clock_timestamp() AS valid
    FROM miopages_wp.wordpress_operator_credentials WHERE id=ANY($1::uuid[]) OR token_sha256=ANY($2::text[]) ORDER BY id`, [ids, hashes])).rows;
  const grants = () => db.query(`SELECT id,operator_id,web_presence_id,managed_site_id,permission,customer,revoked_at
    FROM miopages_wp.wordpress_operator_grants WHERE operator_id=ANY($1::uuid[]) OR id=ANY($2::uuid[])
    OR (web_presence_id=$3 AND managed_site_id=$4 AND revoked_at IS NULL) ORDER BY id`,
  [ids, manifest.principals.flatMap(p => p.grants.map(g => g.id)), site.webPresenceId, site.managedSiteId]);
  let existing = (await grants()).rows;
  let created = 0;
  if (credentials.length === 0 && existing.length === 0 && create) {
    for (const p of manifest.principals) {
      await db.query(`INSERT INTO miopages_wp.wordpress_operator_credentials(id,token_sha256,expires_at)
        VALUES($1,$2,clock_timestamp()+interval '24 hours')`, [p.id, p.tokenSha256]);
      for (const g of p.grants) await db.query(`INSERT INTO miopages_wp.wordpress_operator_grants
        (id,operator_id,web_presence_id,managed_site_id,permission,customer) VALUES($1,$2,$3,$4,$5,$6)`,
      [g.id, p.id, site.webPresenceId, site.managedSiteId, g.permission, g.permission === "approve-site-proposal" ? mandate : null]);
    }
    created = 2;
    credentials = (await db.query(`SELECT id,token_sha256,revoked_at,expires_at>clock_timestamp() AS valid
      FROM miopages_wp.wordpress_operator_credentials WHERE id=ANY($1::uuid[]) ORDER BY id`, [ids])).rows;
    existing = (await grants()).rows;
  }
  assert.deepEqual(credentials, manifest.principals.map(p => ({ id: p.id, token_sha256: p.tokenSha256, revoked_at: null, valid: true }))
    .sort((a, b) => a.id.localeCompare(b.id)), "Missing, expired or conflicting principals; stop without resetting credentials");
  assert.deepEqual(existing, manifest.principals.flatMap(p => p.grants.map(g => ({ id: g.id, operator_id: p.id,
    web_presence_id: site.webPresenceId, managed_site_id: site.managedSiteId, permission: g.permission,
    customer: g.permission === "approve-site-proposal" ? mandate : null, revoked_at: null }))).sort((a, b) => a.id.localeCompare(b.id)),
  "Conflicting grants; do not broaden or repair automatically");
  return { status: "PASS", created, readOnly, scope: site,
    principals: manifest.principals.map(({ reference, id, grants }) => ({ reference, id, grants })),
    independentHumanGovernance: false, publicPublicationAuthorized: false };
}

// Explicitly approved continuation only, never a login-failure fallback. The
// caller owns BEGIN/COMMIT and independently verifies using a fresh connection.
export async function replaceRehearsalTokenVerifiers(db: PoolClient, previousValue: unknown, nextValue: unknown, site: typeof rehearsalSite) {
  const previous = principalManifest(previousValue), next = principalManifest(nextValue);
  const identity = (m: ReturnType<typeof principalManifest>) => m.principals.map(({ reference, id, grants }) => ({ reference, id, grants }));
  assert.deepEqual(identity(next), identity(previous), "Operator identities and every grant must remain exact");
  const hashes = [...previous.principals, ...next.principals].map(p => p.tokenSha256);
  assert.equal(new Set(hashes).size, 4, "Fresh distinct token verifiers required");
  assert.equal((await db.query("SHOW transaction_read_only")).rows[0].transaction_read_only, "off");
  await db.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'");
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended('wordpress-rehearsal-principals/1',0))");
  const ids = previous.principals.map(p => p.id);
  assert.equal((await db.query("SELECT id FROM miopages_wp.wordpress_operator_credentials WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE", [ids])).rowCount, 2, "Both original principals must exist");
  await db.query("LOCK TABLE miopages_wp.wordpress_operator_grants IN SHARE MODE");
  // Inspection cannot create rows, even inside this locked write transaction.
  await principalState(db, previous, site, false, false);
  const before = (await db.query("SELECT id,expires_at,revoked_at FROM miopages_wp.wordpress_operator_credentials WHERE id=ANY($1::uuid[]) ORDER BY id", [ids])).rows;
  for (let i = 0; i < 2; i++) {
    const changed = await db.query(`UPDATE miopages_wp.wordpress_operator_credentials SET token_sha256=$1
      WHERE id=$2 AND token_sha256=$3 AND revoked_at IS NULL AND expires_at>clock_timestamp()`,
    [next.principals[i].tokenSha256, previous.principals[i].id, previous.principals[i].tokenSha256]);
    assert.equal(changed.rowCount, 1, "Stale or expired verifier; rollback without retry");
  }
  const after = (await db.query("SELECT id,expires_at,revoked_at FROM miopages_wp.wordpress_operator_credentials WHERE id=ANY($1::uuid[]) ORDER BY id", [ids])).rows;
  assert.deepEqual(after, before, "Credential lifetime and revocation must not change");
  return { verifierReplacements: 2, identitiesUnchanged: true, grantsUnchanged: true, expiryUnchanged: true };
}
