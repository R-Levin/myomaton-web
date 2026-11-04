import { createHash, createHmac, createPublicKey, sign, timingSafeEqual, verify, type KeyObject } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { fingerprint, uuid } from "../canonical/model";
import { eligibleProjection, unavailableAuthority, type ProjectionAuthority, type Site } from "./authority";

import { reviewedPrivateSource } from "./private-source";

export type Enrollment = Site & {
  installationId: string; origin: string; keyId: string; publicKeyBase64: string; credentialId: string;
};
type Installation = Enrollment & { generation: number; status: string };
type Operator = (context: unknown, action: "enroll" | "rotate" | "revoke" | "issue", site: Site, db: PoolClient) => Promise<string | null>;
type Credential = (credentialId: string) => Promise<Buffer | null>;
type Delivery = { release_id: string; generation: number; source_digest: string; projection_digest: string;
  envelope: string; envelope_sha256: string; expires_at: Date; staged_at: Date | null };

const sha = (bytes: string) => createHash("sha256").update(bytes).digest("hex");
const windowMs = 120_000;
const noCache = { "Cache-Control": "no-store" };
const response = (status: number) => new Response(null, { status, headers: noCache });
const hex = (value: string, size: number) => value.length === size && /^[0-9a-f]+$/.test(value);
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

export function httpsOrigin(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.origin !== value || value.length > 253) throw Error("HTTPS origin required");
  return value;
}

export function requestMac(secret: Buffer, fields: string[]) {
  return createHmac("sha256", secret).update(["MioPages-WP-Delivery-v1", ...fields].join("\n")).digest("hex");
}

async function audit(db: PoolClient, id: string, action: string, actor: string, releaseId?: string) {
  await db.query("INSERT INTO wordpress_delivery_events(installation_id,action,actor,release_id) VALUES($1,$2,$3,$4)",
    [id, action, actor, releaseId ?? null]);
}

async function installation(db: PoolClient, id: string): Promise<Installation | undefined> {
  return (await db.query<Installation>(`SELECT i.id AS "installationId", i.origin, i.status, i.generation,
    i.organization_id AS "organizationId", i.web_presence_id AS "webPresenceId", i.managed_site_id AS "managedSiteId",
    k.key_id AS "keyId", k.public_key AS "publicKeyBase64", k.credential_id AS "credentialId"
    FROM wordpress_installations i JOIN wordpress_installation_keys k
    ON (k.installation_id,k.generation)=(i.id,i.generation)
    JOIN web_presences w ON w.id=i.web_presence_id AND w.organization_id=i.organization_id
    JOIN managed_sites s ON s.id=i.managed_site_id AND s.web_presence_id=w.id
    WHERE i.id=$1 FOR UPDATE OF i`, [id])).rows[0];
}

async function delivery(db: PoolClient, id: string) {
  return (await db.query<Delivery>("SELECT * FROM wordpress_deliveries WHERE installation_id=$1", [id])).rows[0];
}

export class WordPressDelivery {
  constructor(private pool: Pool, private operator: Operator, private credential: Credential,
    private coreOrigin: string, private authority: ProjectionAuthority = unavailableAuthority,
    private privateStageBoundary?: (db: PoolClient) => Promise<void>) {
    httpsOrigin(coreOrigin);
  }

  private async transaction<T>(run: (db: PoolClient) => Promise<T>, snapshot = false) {
    const db = await this.pool.connect();
    try {
      await db.query(snapshot ? "BEGIN ISOLATION LEVEL REPEATABLE READ" : "BEGIN");
      await this.privateStageBoundary?.(db);
      await db.query("SET LOCAL TIME ZONE 'UTC'");
      const result = await run(db);
      await db.query("COMMIT");
      return result;
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release();
    }
  }

  private async eligible(db: PoolClient, site: Site) {
    if (!this.privateStageBoundary) return eligibleProjection(db, site, this.authority);
    const projection = await reviewedPrivateSource(db, site);
    if (!projection) throw Error("Reviewed private-stage source required");
    return projection;
  }

  private async actor(context: unknown, action: Parameters<Operator>[1], site: Site, db: PoolClient) {
    const actor = await this.operator(context, action, { organizationId: site.organizationId,
      webPresenceId: site.webPresenceId, managedSiteId: site.managedSiteId }, db);
    if (!actor || actor.length > 200) throw Error("Operator authority required");
    return actor;
  }

  async enroll(context: unknown, input: Enrollment) {
    const e = { ...input, installationId: uuid(input.installationId), organizationId: uuid(input.organizationId),
      webPresenceId: uuid(input.webPresenceId), managedSiteId: uuid(input.managedSiteId), origin: httpsOrigin(input.origin) };
    await this.transaction(async db => {
      const actor = await this.actor(context, "enroll", e, db);
      const result = await db.query(`INSERT INTO wordpress_installations
        (id,organization_id,web_presence_id,managed_site_id,origin,generation,status)
        SELECT $1,w.organization_id,w.id,s.id,$5,1,'active'
        FROM web_presences w JOIN managed_sites s ON s.web_presence_id=w.id
        WHERE w.organization_id=$2 AND w.id=$3 AND s.id=$4`,
      [e.installationId, e.organizationId, e.webPresenceId, e.managedSiteId, e.origin]);
      if (!result.rowCount) throw Error("Enrollment scope mismatch");
      await this.insertKey(db, e.installationId, 1, e);
      await audit(db, e.installationId, "enrolled", actor);
    });
  }

  private async insertKey(db: PoolClient, id: string, generation: number,
    key: Pick<Enrollment, "keyId" | "publicKeyBase64" | "credentialId">) {
    const raw = Buffer.from(key.publicKeyBase64, "base64");
    if (raw.length !== 32 || raw.toString("base64") !== key.publicKeyBase64
      || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(key.keyId) || key.keyId.trim() !== key.keyId) {
      throw Error("Invalid verification key");
    }
    await db.query("INSERT INTO wordpress_installation_keys VALUES($1,$2,$3,$4,$5)",
      [id, generation, key.keyId, key.publicKeyBase64, uuid(key.credentialId)]);
  }

  async rotate(context: unknown, id: string, expectedGeneration: number,
    key: Pick<Enrollment, "keyId" | "publicKeyBase64" | "credentialId">) {
    const next = { ...key };
    await this.transaction(async db => {
      const e = await installation(db, uuid(id));
      if (!e || e.status !== "active" || e.generation !== expectedGeneration) throw Error("Rotation refused");
      const actor = await this.actor(context, "rotate", e, db);
      const previous = await delivery(db, id);
      if ((previous && !previous.staged_at) || next.publicKeyBase64 === e.publicKeyBase64) throw Error("Rotation refused");
      await this.insertKey(db, id, e.generation + 1, next);
      await db.query("UPDATE wordpress_installations SET generation=generation+1 WHERE id=$1", [id]);
      await audit(db, id, "rotated", actor);
    });
  }

  async revoke(context: unknown, id: string) {
    await this.transaction(async db => {
      const e = await installation(db, uuid(id));
      if (!e) throw Error("Unknown installation");
      const actor = await this.actor(context, "revoke", e, db);
      if (e.status === "revoked") return;
      await db.query("UPDATE wordpress_installations SET status='revoked' WHERE id=$1", [id]);
      await audit(db, id, "revoked", actor);
    });
  }

  // There is no public issuance entry point. Batch 1 stages only sequence 1
  // while the WordPress active pointer remains at sequence 0.
  async issue(context: unknown, id: string, releaseId: string, key: KeyObject) {
    return this.transaction(async db => {
      const e = await installation(db, uuid(id));
      if (!e || e.status !== "active") throw Error("Issuance refused");
      const actor = await this.actor(context, "issue", e, db);
      let projection;
      try {
        projection = await this.eligible(db, e);
        if (projection.releaseId !== uuid(releaseId)) throw Error("Requested release is stale");
      } catch {
        await audit(db, id, "eligibility-refused", actor);
        return null;
      }
      if (key.type !== "private" || key.asymmetricKeyType !== "ed25519") throw Error("Invalid issuer key");
      const publicKey = createPublicKey(key);
      if (publicKey.export({ format: "jwk" }).x !== Buffer.from(e.publicKeyBase64, "base64").toString("base64url")) {
        throw Error("Unpinned issuer");
      }
      const previous = await delivery(db, id);
      if (previous) {
        if (previous.release_id !== releaseId || previous.source_digest !== projection.sourceDigest
          || previous.projection_digest !== projection.projectionDigest || previous.generation !== e.generation
          || previous.expires_at.getTime() <= Date.now()) throw Error("Delivery conflict");
        return { releaseId, envelopeSha256: previous.envelope_sha256 };
      }
      const now = Date.now(), expiresAt = iso(now + 3_600_000);
      const payload = JSON.stringify({
        schema: "miopages.wordpress.managed-release", version: 1,
        releaseId, organizationId: e.organizationId, webPresenceId: e.webPresenceId, managedSiteId: e.managedSiteId,
        installationId: id, sequence: 1, previousReleaseId: null, issuedAt: iso(now), expiresAt,
        approval: { state: "approved", approvalId: projection.approvalId }, pages: projection.pages, assets: [],
      });
      const signature = sign(null, Buffer.from("MioPages-WP-Release-v1\n" + payload), key);
      const envelope = JSON.stringify({ schema: "miopages.wordpress.release-envelope", version: 1,
        keyId: e.keyId, payloadBase64: Buffer.from(payload).toString("base64"), payloadSha256: sha(payload),
        signatureBase64: signature.toString("base64") });
      if (Buffer.byteLength(envelope) > 1048576) throw Error("Oversized release");
      const envelopeSha256 = sha(envelope);
      await db.query(`INSERT INTO wordpress_deliveries
        (installation_id,release_id,generation,source_digest,projection_digest,envelope,envelope_sha256,expires_at${this.privateStageBoundary ? ",private_release_id" : ""})
        VALUES($1,$2,$3,$4,$5,$6,$7,$8${this.privateStageBoundary ? ",$2" : ""})`, [id, releaseId, e.generation, projection.sourceDigest,
        projection.projectionDigest, envelope, envelopeSha256, expiresAt]);
      await audit(db, id, "issued", actor, releaseId);
      return { releaseId, envelopeSha256 };
    }, true);
  }

  // Mount only at the configured HTTPS origin once production authority and
  // credentials have been provisioned. Uses no forwarded headers.
  async handle(request: Request) {
    const url = new URL(request.url);
    const action = url.pathname === "/api/wordpress-delivery/pull" ? "pull" :
      url.pathname === "/api/wordpress-delivery/receipt" ? "receipt" : null;
    if (!action || url.origin !== this.coreOrigin || url.search || request.method !== "POST" || request.body) {
      return response(400);
    }
    const header = (name: string) => request.headers.get("x-miopages-" + name) ?? "";
    const id = header("installation"), origin = header("origin"), credentialId = header("credential"),
      releaseId = header("release"), nonce = header("nonce"), at = header("time"),
      receipt = header("receipt"), auth = header("mac");
    const when = Number(at);
    try {
      if (uuid(id) !== id || uuid(releaseId) !== releaseId || uuid(credentialId) !== credentialId
        || httpsOrigin(origin) !== origin || !hex(nonce, 32) || !hex(auth, 64) || at !== String(when)
        || !Number.isSafeInteger(when) || Math.abs(Date.now() - when) > windowMs
        || (action === "pull" ? receipt !== "" : !/^staged:1:[0-9a-f]{64}$/.test(receipt))) return response(400);
    } catch { return response(400); }

    return this.transaction(async db => {
      const e = await installation(db, id);
      if (!e || e.status !== "active" || e.origin !== origin || e.credentialId !== credentialId) return response(403);
      const secret = await this.credential(credentialId);
      if (!secret || secret.length !== 32) return response(403);
      const expected = requestMac(secret, [this.coreOrigin, action, id, origin, credentialId, releaseId, nonce, at, receipt]);
      if (!timingSafeEqual(Buffer.from(auth, "hex"), Buffer.from(expected, "hex"))) return response(403);

      const now = Date.now();
      if (Math.abs(now - when) > windowMs) return response(400);

      // Advance the locked row so competing snapshot transactions retry with fresh state.
      await db.query(this.privateStageBoundary
        ? "UPDATE wordpress_installations SET request_epoch=request_epoch+1 WHERE id=$1"
        : "UPDATE wordpress_installations SET status=status WHERE id=$1", [id]);
      const refuse = async (status: number, event: string) => {
        await audit(db, id, event, credentialId, releaseId);
        return response(status);
      };
      await db.query("DELETE FROM wordpress_request_nonces WHERE installation_id=$1 AND expires_at<$2", [id, new Date(now)]);
      const count = await db.query("SELECT count(*)::int AS n FROM wordpress_request_nonces WHERE installation_id=$1", [id]);
      if (count.rows[0].n >= 60) return response(429);
      const inserted = await db.query(`INSERT INTO wordpress_request_nonces VALUES($1,$2,$3)
        ON CONFLICT DO NOTHING`, [id, nonce, new Date(when + windowMs)]);
      if (!inserted.rowCount) return response(409);
      const d = await delivery(db, id);
      if (!d || d.generation !== e.generation || d.release_id !== releaseId) return refuse(404, "delivery-refused");

      if (sha(d.envelope) !== d.envelope_sha256) return refuse(409, "delivery-corrupt");
      if (action === "receipt") {
        if (this.privateStageBoundary && !d.staged_at) {
          try { if ((await this.eligible(db, e)).releaseId !== releaseId) return refuse(409, "delivery-stale"); }
          catch { return refuse(409, "eligibility-refused"); }
        }
        if (receipt !== "staged:1:" + d.envelope_sha256) return refuse(409, "receipt-conflict");
        if (!d.staged_at) {
          if (d.expires_at.getTime() <= now) return refuse(409, "receipt-expired");
          const pulled = await db.query("SELECT 1 FROM wordpress_delivery_events WHERE installation_id=$1 AND release_id=$2 AND action='pulled' LIMIT 1", [id, releaseId]);
          if (!pulled.rowCount) return refuse(409, "receipt-before-pull");
          await db.query("UPDATE wordpress_deliveries SET staged_at=now() WHERE installation_id=$1", [id]);
        }
        await audit(db, id, d.staged_at ? "receipt-retry" : "staged", credentialId, releaseId);
        return response(204);
      }

      if (d.expires_at.getTime() <= now) return refuse(409, "delivery-expired");
      try {
        const p = await this.eligible(db, e);
        if (p.releaseId !== releaseId || p.sourceDigest !== d.source_digest || p.projectionDigest !== d.projection_digest) {
          return refuse(409, "delivery-stale");
        }
      } catch { return refuse(409, "eligibility-refused"); }

      // Recheck the exact bytes and enrolled issuer before disclosing the envelope.
      const envelope = JSON.parse(d.envelope);
      const bytes = Buffer.from(envelope.payloadBase64, "base64");
      const pub = createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"),
        Buffer.from(e.publicKeyBase64, "base64")]), format: "der", type: "spki" });
      if (envelope.keyId !== e.keyId || !verify(null, Buffer.concat([Buffer.from("MioPages-WP-Release-v1\n"), bytes]),
        pub, Buffer.from(envelope.signatureBase64, "base64"))) return refuse(409, "issuer-refused");

      const payload = JSON.parse(bytes.toString("utf8"));
      if (envelope.schema !== "miopages.wordpress.release-envelope" || envelope.version !== 1
        || envelope.payloadSha256 !== sha(bytes.toString("utf8"))
        || payload.schema !== "miopages.wordpress.managed-release" || payload.version !== 1
        || payload.releaseId !== releaseId || payload.installationId !== id
        || payload.organizationId !== e.organizationId || payload.webPresenceId !== e.webPresenceId
        || payload.managedSiteId !== e.managedSiteId || payload.sequence !== 1 || payload.previousReleaseId !== null
        || Date.parse(payload.expiresAt) !== d.expires_at.getTime() || d.expires_at.getTime() <= Date.now()
        || fingerprint(payload.pages) !== d.projection_digest) return refuse(409, "envelope-mismatch");

      await audit(db, id, "pulled", credentialId, releaseId);
      return new Response(d.envelope, { headers: { ...noCache, "Content-Type": "application/json",
        "X-MioPages-Envelope-SHA256": d.envelope_sha256 } });
    }, true).catch(() => response(503));
  }
}
