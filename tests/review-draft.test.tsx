import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { draftBrand } from "../lib/platform/wordpress-delivery/draft-brand";
import { readNativeDraftEnvelope, reviewDraftEnvelope } from "../lib/platform/wordpress-delivery/native-draft-envelope";
import { bindReviewDraft } from "../lib/platform/wordpress-delivery/review-draft";
import { draftEndpoint, sendSignedDraft } from "../lib/platform/wordpress-delivery/review-delivery";
import { readbackRequest, summarizeReadback, verifyReadback } from "../lib/platform/wordpress-delivery/readback";
import type { NativeNode } from "../lib/platform/intake/presence-native-component";

type ReviewInput = Parameters<typeof bindReviewDraft>[0]["review"];

function node(kind: NativeNode["kind"], changes: Partial<NativeNode> = {}): NativeNode {
  return { kind, text: null, level: null, items: [], ordered: false, reference: null,
    layout: { arrangement: "flow", columns: [], gap: "medium", inset: "none", surface: "none",
      align: "start", measure: "full", typeScale: "body", span: 1, mobileOrder: 0, border: false, rounded: false }, children: [], ...changes };
}

// Fictional fixture site in the shape Core's workflow produces (workflowNativeReviewCandidate).
const site = { organizationId: randomUUID(), webPresenceId: randomUUID(), managedSiteId: randomUUID() };
const home = randomUUID(), start = randomUUID(), hero = randomUUID(), proof = randomUUID(), startHero = randomUUID();
const heroBlock = { version: 2, name: "fixture-hero", purpose: "Open the fixture site", mode: "section",
  root: node("group", { layout: { ...node("group").layout, arrangement: "columns", columns: [7, 5] }, children: [
    node("group", { children: [
      node("heading", { level: 1, text: "A clear fixture opening" }),
      node("paragraph", { text: "What the fixture business does, said plainly." }),
      node("action", { text: "Start now", reference: "action-0" }),
    ] }),
    node("image", { reference: "section-0" }),
  ] }) };
const proofBlock = { version: 2, name: "fixture-proof", purpose: "Show proof that does not exist yet", mode: "section",
  root: node("group", { children: [
    node("heading", { level: 2, text: "What customers say" }),
    node("placeholder", { reference: "need-testimonial", text: "A short quote from a real customer belongs here." }),
  ] }) };
const startBlock = { version: 2, name: "fixture-start", purpose: "Begin", mode: "section",
  root: node("group", { children: [node("heading", { level: 1, text: "Start here" }), node("action", { text: "Begin the fixture start", reference: "action-0" })] }) };
const review = {
  candidate: {
    pages: [
      { id: home, path: "/", title: "Fixture home", composition: "managed-v1" as const, navigationLabel: "Home", sections: [
        { id: hero, type: "hero", content: { heading: "A clear fixture opening", text: "" }, block: heroBlock,
          visual: { purpose: "Show the work", brief: "Photograph of the fixture team at work.", altIntent: "Fixture team at work", status: "asset-needed" as const } },
        { id: proof, type: "intro", content: { heading: "What customers say", text: "" }, block: proofBlock },
      ] },
      { id: start, path: "/start", title: "Start", composition: "managed-v1" as const, navigationLabel: "Start", sections: [
        { id: startHero, type: "hero", content: { heading: "Start here", text: "" }, block: startBlock },
      ] },
    ],
    navigation: ["/", "/start"],
    actions: [{ id: randomUUID(), type: "page" as const, from: "/", destination: "/start", label: "Start now", componentReference: "action-0", sectionId: hero }],
  },
  unresolvedActions: [{ from: "/start", reference: "action-0", label: "Begin the fixture start" }],
};
const design = { grammar: "core-designed", version: 4, motion: "minimal",
  palette: { light: { background: "#fbf8f2", text: "#1f1b16" }, strong: { background: "#16324f", text: "#ffffff" },
    tonal: { background: "#efe7d8", text: "#2a241c" }, brand: { background: "#7a3b12", text: "#ffffff" },
    supporting: { background: "#e3ecf4", text: "#14273a" }, contrast: { background: "#111111", text: "#f5f5f5" },
    border: "#d9cfbf", muted: "#5f574c" },
  typography: { headingFamily: "fraunces", bodyFamily: "inter", baseSize: 17, headingScale: 2.6, lineHeight: 1.6, headingWeight: 600 },
  shape: "soft", density: "balanced" };
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const brand = { ...draftBrand({ scope: site, coreDesign: design, logo: { assetId: randomUUID(), usageId: randomUUID(),
  sha256: createHash("sha256").update(png).digest("hex"), alt: "Fixture wordmark" } }), pngBase64: png.toString("base64") };

const installationId = randomUUID(), streamId = randomUUID(), intakeId = randomUUID();
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const publicKeyBase64 = Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url").toString("base64");
const identity = { ...site, installationId, keyId: "fixture-key", publicKeyBase64 };
const draft = (revision: number, previousDigest: string | null, changes: Partial<typeof review> = {}) =>
  bindReviewDraft({ site, installationId, streamId, revision, previousDigest, source: { intakeId, workflowVersion: 30 }, review: { ...review, ...changes } as unknown as ReviewInput, brand });
const writer = (wires: unknown[]) => spawnSync(process.platform === "win32" ? "C:/php/php.exe" : "php",
  ["-d", "serialize_precision=17", "wordpress/miopages-delivery/tests/review-draft-writer.php"], { input: JSON.stringify({ identity, wires }), encoding: "utf8" });

test("a Core-signed review draft reaches WordPress with Core's design, FPO, placeholders and pending Actions intact", () => {
  const first = draft(1, null);
  const wire = reviewDraftEnvelope(first, "fixture-key", publicKeyBase64, privateKey);
  assert.equal(wire.version, 6);
  assert.equal(readNativeDraftEnvelope(wire, "fixture-key", publicKeyBase64).digest, first.digest);
  const result = writer([JSON.stringify(wire)]);
  assert.equal(result.status, 0, result.stderr);
  const [applied] = JSON.parse(result.stdout).applied;
  assert.equal(applied.revision, 1);
  assert.equal(applied.brand, true, "Core's chosen design travels with the drafts");
  const homeHtml: string = applied.posts["/"], startHtml: string = applied.posts["/start"];
  assert.match(homeHtml, /miopages-component-fixture-hero/, "Core's own section design is rendered, not flattened");
  assert.match(homeHtml, /miopages-cols-7-5/);
  assert.match(homeHtml, /miopages-fpo/, "The requested image appears as a marked FPO frame");
  assert.match(homeHtml, /Customer testimonial needed/, "Missing material appears as a visible placeholder");
  assert.match(homeHtml, /<a class="wp-block-button__link wp-element-button" href="[^"]*page_id=\d+&amp;preview=true">Start now<\/a>/);
  assert.match(startHtml, /Begin the fixture start — preview only; submissions disabled/);
});

test("the next review draft follows its predecessor; a stale, foreign or reshaped package is refused", () => {
  const first = draft(1, null);
  const changed = { ...review.candidate, pages: review.candidate.pages.map(page => page.path === "/start"
    ? { ...page, title: "Start (revised)" } : page) };
  const second = draft(2, first.digest, { candidate: changed });
  const sign = (value: ReturnType<typeof draft>) => JSON.stringify(reviewDraftEnvelope(value, "fixture-key", publicKeyBase64, privateKey));
  const ok = writer([sign(first), sign(second)]);
  assert.equal(ok.status, 0, ok.stderr);
  assert.deepEqual(JSON.parse(ok.stdout).applied.map((item: { revision: number }) => item.revision), [1, 2]);
  assert.notEqual(writer([sign(first), sign(draft(2, "0".repeat(64)))]).status, 0, "Wrong predecessor");
  const foreign = bindReviewDraft({ site: { ...site, managedSiteId: randomUUID() }, installationId, streamId, revision: 1, previousDigest: null,
    source: { intakeId, workflowVersion: 30 }, review: review as unknown as ReviewInput });
  assert.notEqual(writer([sign(foreign)]).status, 0, "Another site's drafts");
  // Re-labelling a review draft as an ordinary delivery breaks Core's signature.
  const wire = reviewDraftEnvelope(first, "fixture-key", publicKeyBase64, privateKey);
  assert.notEqual(writer([JSON.stringify({ ...wire, version: 5 })]).status, 0);
  assert.throws(() => draft(1, null, { unresolvedActions: [{ from: "/elsewhere", reference: "action-0", label: "x" }] }));
});

test("Core delivers over the plugin's web endpoint and accepts only WordPress's matching signed receipt", async () => {
  const secret = Buffer.alloc(32, 7);
  const pull = { secretHex: secret.toString("hex"), identity: { installationId } };
  const first = draft(1, null);
  const wire = reviewDraftEnvelope(first, "fixture-key", publicKeyBase64, privateKey);
  const seen: { url: string; auth: string | null }[] = [];
  // Stands in for HTTPS: the request body goes to the plugin's endpoint code unchanged.
  const fetcher = (async (url: URL, init: RequestInit) => {
    seen.push({ url: String(url), auth: new Headers(init.headers).get("authorization") });
    const php = spawnSync(process.platform === "win32" ? "C:/php/php.exe" : "php", ["-d", "serialize_precision=17", "wordpress/miopages-delivery/tests/review-draft-writer.php"],
      { input: JSON.stringify({ mode: "endpoint", identity: { ...identity, deliveryUser: "core-delivery" }, pull, wires: [init.body] }), encoding: "utf8" });
    assert.equal(php.status, 0, php.stderr);
    const [response] = JSON.parse(php.stdout).responses;
    return new Response(JSON.stringify(response.body), { status: response.status });
  }) as unknown as typeof fetch;
  const target = { origin: "https://drafts.example.test", gate: { user: "gate", password: "fixture-only" } };
  const expected = { installationId, siteProposalId: streamId, operation: "apply" as const, requestedDigest: first.digest,
    appliedDigest: first.digest, revision: 1, paths: ["/", "/start"], brandDigest: brand.digest };
  const receipt = await sendSignedDraft(target, wire, secret, expected, fetcher);
  assert.equal(receipt.revision, 1);
  assert.deepEqual(receipt.posts.map(post => post.path), ["/", "/start"]);
  assert.equal(seen[0].url, "https://drafts.example.test/?rest_route=/miopages/v1/draft");
  assert.match(seen[0].auth ?? "", /^Basic /);
  await assert.rejects(sendSignedDraft(target, wire, Buffer.alloc(32, 8), expected, fetcher), /authentication refused/,
    "A receipt signed with another key is refused");
  await assert.rejects(sendSignedDraft(target, wire, secret, { ...expected, revision: 2 }, fetcher), /mismatch/,
    "A receipt for a different revision is refused");
  await assert.rejects(sendSignedDraft(target, { ...wire, signatureBase64: wire.signatureBase64.replace(/^./, c => c === "A" ? "B" : "A") },
    secret, expected, fetcher), /HTTP 422/, "WordPress refuses a package Core did not sign");
  assert.throws(() => draftEndpoint({ origin: "http://drafts.example.test" }), /refused/, "Plain HTTP only for a loopback test site");
  assert.equal(String(draftEndpoint({ origin: "http://127.0.0.1:4474" })), "http://127.0.0.1:4474/?rest_route=/miopages/v1/draft");
});

test("Core reads back the Operator's edits and Notes, each Note tied to its block, and trusts only a signed answer", () => {
  const secret = Buffer.alloc(32, 9);
  const pull = { secretHex: secret.toString("hex"), identity: { installationId } };
  const first = draft(1, null);
  const wire = JSON.stringify(reviewDraftEnvelope(first, "fixture-key", publicKeyBase64, privateKey));
  // The Operator rewrites one sentence and adds a Note to the pending Action notice (WordPress
  // stores the Note's id in that block's metadata, beside Core's own identifier), plus a reply
  // and a resolved Note.
  const startNotice = `"metadata":{"mio":"${startHero}:r.1"}`;
  const edits = { "/": ["What the fixture business does, said plainly.", "What we do, in one plain sentence."],
    "/start": [startNotice, `"metadata":{"mio":"${startHero}:r.1","noteId":[41]}`] };
  const notes = [
    { id: 41, path: "/start", text: "Connect this to the real Direct Start form." },
    { id: 42, path: "/start", parent: 41, text: "Form is not built yet; keep the notice for now." },
    { id: 43, path: "/", text: "Old note, already handled.", status: "resolved" },
  ];
  const run = (request: unknown, key = secret) => {
    const php = spawnSync(process.platform === "win32" ? "C:/php/php.exe" : "php", ["-d", "serialize_precision=17", "wordpress/miopages-delivery/tests/review-draft-writer.php"],
      { input: JSON.stringify({ mode: "readback", identity, pull: { ...pull, secretHex: key.toString("hex") }, wires: [wire], edits, notes,
        request: JSON.stringify(request) }), encoding: "utf8" });
    assert.equal(php.status, 0, php.stderr);
    assert.ok(php.stdout.startsWith("{"), php.stdout.slice(0, 600));
    return JSON.parse(php.stdout).responses[0];
  };
  const { nonce, wire: request } = readbackRequest(installationId, "fixture-key", privateKey);
  const answer = run(request);
  assert.equal(answer.status, 200);
  const readback = verifyReadback(answer.body, secret, { installationId, nonce });
  assert.equal(readback.revision, 1);
  const summary = summarizeReadback(readback);
  assert.deepEqual(summary.editedPages.sort(), ["/", "/start"]);
  assert.equal(readback.pages.find(page => page.path === "/")!.content!.includes("What we do, in one plain sentence."), true);
  assert.equal(summary.openNotes.length, 1);
  const [note] = summary.openNotes;
  assert.equal(note.path, "/start");
  assert.equal(note.text, "Connect this to the real Direct Start form.");
  assert.deepEqual(note.block, { name: "paragraph", text: "Begin the fixture start — preview only; submissions disabled" });
  assert.equal(note.replies[0].text, "Form is not built yet; keep the notice for now.");
  assert.equal(summary.resolvedNotes.length, 1);
  // A forged or replayed answer is refused; so is a request Core did not sign.
  assert.throws(() => verifyReadback(answer.body, Buffer.alloc(32, 1), { installationId, nonce }), /authentication/);
  assert.throws(() => verifyReadback(answer.body, secret, { installationId, nonce: "0".repeat(32) }), /mismatch/);
  const other = generateKeyPairSync("ed25519").privateKey;
  assert.equal(run(readbackRequest(installationId, "fixture-key", other).wire).status, 422);
});

test("an editor left open on an older copy is told Core took over and cannot save over the new delivery", () => {
  const php = spawnSync(process.platform === "win32" ? "C:/php/php.exe" : "php", ["wordpress/miopages-delivery/tests/editor-guard.php"], { encoding: "utf8" });
  assert.equal(php.status, 0, php.stderr);
  assert.equal(php.stdout.trim(), "PASS");
});
