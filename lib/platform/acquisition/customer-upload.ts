import type { PoolClient } from "pg";
import { choice, object, text, uuid } from "../canonical/model";
import type { SuppliedPlacement } from "./supplied-evidence";

export type UploadAgreement = {
  submitterId: string;
  submissionGrant: string;
  version: string;
  acceptanceReference: string;
  acceptedBy: string;
  acceptedAt: string;
  use: "disposable-intro-image";
};

export type VerifyUploadAgreement = (
  db: PoolClient, placement: SuppliedPlacement, evidence: UploadAgreement,
) => Promise<boolean>;

export interface CustomerUploadAuthority {
  // The composition root verifies credentials, tenant scope, operation and
  // representative acceptance. The upload never supplies these evidence fields.
  authenticate(credential: string, placement: SuppliedPlacement): Promise<UploadAgreement | null>;
  // A durable adapter must serialize current authority with the write via db.
  verifyCurrent: VerifyUploadAgreement;
}

export function uploadAgreement(value: unknown): UploadAgreement {
  if (!value) throw Error("Verified customer submission grant and agreement acceptance required");
  const raw = object(value, ["submitterId", "submissionGrant", "version", "acceptanceReference", "acceptedBy", "acceptedAt", "use"]);
  const acceptedAt = text(raw.acceptedAt, 32);
  if (!Number.isFinite(Date.parse(acceptedAt)) || new Date(acceptedAt).toISOString() !== acceptedAt || Date.parse(acceptedAt) > Date.now()) {
    throw Error("Current attributable agreement acceptance required");
  }
  return { submitterId: text(raw.submitterId), submissionGrant: text(raw.submissionGrant, 300), version: text(raw.version, 100),
    acceptanceReference: text(raw.acceptanceReference, 300), acceptedBy: text(raw.acceptedBy), acceptedAt,
    use: choice(raw.use, ["disposable-intro-image"]) };
}

export async function requireCurrentUploadAgreement(db: PoolClient, placement: SuppliedPlacement, evidence: UploadAgreement, verify?: VerifyUploadAgreement) {
  if (!verify || await verify(db, structuredClone(placement), uploadAgreement(evidence)) !== true) {
    throw Error("Customer upload authority or agreement acceptance is no longer current");
  }
}

const uploadLimit = 1024 * 1024;
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function uploadRequest(request: Request) {
  if (request.method !== "POST") throw Error("Customer upload requires POST");
  const credential = /^Bearer ([A-Za-z0-9._~-]{32,512})$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!credential) throw Error("Authenticated customer upload required");
  return { credential, submissionId: uuid(request.headers.get("idempotency-key")) };
}

export async function readUploadPng(request: Request) {
  const encoding = request.headers.get("content-encoding");
  if (request.headers.get("content-type") !== "image/png" || (encoding && encoding !== "identity") || !request.body) {
    throw Error("One uncompressed PNG upload required");
  }
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d{1,7}$/.test(length) || Number(length) < pngSignature.length || Number(length) > uploadLimit)) {
    throw Error("Customer upload exceeds PNG size limits");
  }
  const buffer = Buffer.allocUnsafe(uploadLimit);
  const reader = request.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  request.signal.addEventListener("abort", cancel, { once: true });
  let size = 0;
  try {
    for (;;) {
      request.signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      if (value.byteLength > uploadLimit - size) throw Error("Customer upload exceeds PNG size limits");
      buffer.set(value, size);
      size += value.byteLength;
    }
    request.signal.throwIfAborted();
  } catch (error) {
    // Don't wait on a tee's other branch or leak body failures.
    cancel();
    throw error;
  } finally {
    request.signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
  const bytes = buffer.subarray(0, size);
  if ((length !== null && Number(length) !== size) || !bytes.subarray(0, pngSignature.length).equals(pngSignature)) {
    throw Error("Customer upload does not contain the declared PNG");
  }
  return bytes;
}
