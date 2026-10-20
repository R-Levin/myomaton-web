import { randomUUID } from "node:crypto";
import { siteProposalFixture } from "../site-proposals/disposable";
import { fingerprint } from "../../lib/platform/canonical/model";
import { SiteReleaseService } from "../../lib/platform/content-editing/releases";
import type { ReleaseAuthority, ReleasePermission } from "../../lib/platform/content-editing/release";
import type { Scope } from "../../lib/platform/content-editing/authority";
import type { PageProposal } from "../../lib/platform/content-editing/proposal";

// Synthetic capability registry, never a production identity/mandate adapter.
export async function siteReleaseFixture(url: string) {
  const f = await siteProposalFixture(url, true);
  const grants = new WeakMap<object, { scope: Scope; permissions: ReleasePermission[] }>();
  const authority: ReleaseAuthority = { async authorize(context, permission, scope) {
    const grant = context && typeof context === "object" ? grants.get(context) : undefined;
    if (!grant || !grant.permissions.includes(permission) || fingerprint(grant.scope) !== fingerprint(scope)) throw Error("Missing scoped release authority");
    return { operatorId: "synthetic-release-operator", authorityReference: "synthetic-verified-release-mandate" };
  } };
  const grant = (permissions: ReleasePermission[], scope = f.scope) => { const token = Object.freeze({}); grants.set(token, { permissions, scope }); return token; };
  const releaseContext = grant(["release-managed-site-change"]), rollbackContext = grant(["rollback-managed-site-change"]), inspectContext = grant(["inspect-managed-site-releases"]);
  const releases = new SiteReleaseService(f.pool, authority);
  const prepare = async (page: PageProposal = f.page) => {
    const id = randomUUID(), event = await f.service.prepare(f.operator, id, f.scope, randomUUID(), page);
    return { id, binding: event.revision!.binding };
  };
  const approve = async (prepared: Awaited<ReturnType<typeof prepare>>) => {
    const preview = await f.service.preview(f.operator, prepared.binding, randomUUID());
    const approval = await f.service.approve(f.approver, { binding: prepared.binding, requestId: randomUUID(), previewDigest: preview.digest, previewEvent: preview.event, reference: "Synthetic exact candidate consent; no production publication" });
    return { binding: prepared.binding, approvalEvent: approval.hash, previewDigest: preview.digest, requestId: randomUUID(), reference: "Synthetic distinct content release authorization" };
  };
  return { ...f, releases, releaseAuthority: authority, releaseContext, rollbackContext, inspectContext, releaseGrant: grant, prepare, approve };
}
