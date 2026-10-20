import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { pageProposal, proposalOnly, proposalExecution, revisionDigest, type PageProposal, type Revision } from "../lib/platform/content-editing/proposal";
import { proposalPreview } from "../lib/platform/content-editing/proposal-preview";
const editorial = (text: string) => ({ kind: "editorial" as const, text, rationale: "Editorial framing" });
const page = (): PageProposal => ({ operation: "create-page", pageId: randomUUID(), slug: "/", title: editorial("Candidate title"), purpose: "Synthetic proof", sections: [{ id: randomUUID(), type: "hero", heading: editorial("Clear direction"), text: editorial("Supporting copy") }] });
test("proposal accepts existing bounded Page/Section contracts and closed canonical/editorial origins", () => {
  const p = page(); assert.deepEqual(pageProposal(p), p);
  for (const bad of [{ ...p, publish: true }, { ...p, slug: "/api/intake" }, { ...p, sections: [] }, { ...p, title: { kind: "intake", text: "unconfirmed" } }, { ...p, sections: [{ ...p.sections[0], type: "custom-html" }] }, { ...p, sections: [{ ...p.sections[0], configuration: { css: "arbitrary" } }] }, { ...p, title: editorial("<script>bad</script>") }]) assert.throws(() => pageProposal(bad));
  assert.throws(() => pageProposal({ ...p, title: { kind: "canonical", source: { domain: "review", recordId: randomUUID(), revision: 1, fingerprint: "a".repeat(64), field: "recommendation" } } }));
});
test("preview uses shared Section rendering; copy origins are readable and CTA destinations are inert", () => {
  const p = page(), identity = { proposalId: randomUUID(), scope: { webPresenceId: randomUUID(), managedSiteId: randomUUID() }, revision: 1, baseFingerprint: "a".repeat(64) };
  const body = { page: p, at: new Date().toISOString(), author: { operatorId: "synthetic", authorityReference: "test" }, base: {}, resolved: [{ path: "title", value: "Candidate title", origin: p.title }], candidate: { title: "Candidate title", sections: [{ id: p.sections[0].id, name: "Clear direction", type: "hero", variant: "default", content: { heading: "Clear direction", text: "Supporting copy", actionId: randomUUID() }, configuration: {}, action: { id: randomUUID(), name: "External", type: "link" as const, label: "Ask a question", destination: "https://example.com/" } }] } };
  const r: Revision = { ...body, binding: { ...identity, digest: revisionDigest(body, identity) } }, html = proposalPreview(r);
  assert.match(html, /managed-site-section-hero/); assert.match(html, /Clear direction/); assert.match(html, /Editorial judgment/); assert.match(html, /CTA: Ask a question/); assert.doesNotMatch(html, /<a |<form|<script|<img/);
  assert.notEqual(revisionDigest({ ...body, page: { ...p, purpose: "Changed" } }, identity), r.binding.digest);
});
test("proposal runtime refuses production and missing local operator gate", () => {
  const old = { NODE_ENV: process.env.NODE_ENV, MIOPAGES_SITE_PROPOSALS: process.env.MIOPAGES_SITE_PROPOSALS };
  try { Object.assign(process.env, { NODE_ENV: "production", MIOPAGES_SITE_PROPOSALS: "local-operator" }); assert.throws(proposalOnly); Object.assign(process.env, { NODE_ENV: "development", MIOPAGES_SITE_PROPOSALS: "" }); assert.throws(proposalOnly); } finally { Object.assign(process.env, old); }
});
test("durable configuration permits explicit shared development without enabling local or production execution", () => {
  const old = { NODE_ENV: process.env.NODE_ENV, MIOPAGES_SITE_PROPOSALS: process.env.MIOPAGES_SITE_PROPOSALS };
  try {
    Object.assign(process.env, { NODE_ENV: "development", MIOPAGES_SITE_PROPOSALS: "shared-development" });
    assert.doesNotThrow(() => proposalExecution("postgres")); assert.throws(() => proposalExecution("local"));
    Object.assign(process.env, { NODE_ENV: "production" }); assert.throws(() => proposalExecution("postgres"));
  } finally { Object.assign(process.env, old); }
});
