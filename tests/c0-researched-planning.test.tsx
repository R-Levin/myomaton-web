import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { fingerprint } from "../lib/platform/canonical/model";
import { prepareSitePlanning, readSitePlanning, type SitePlanningEvidence } from "../lib/platform/intake/site-planning";
import { type InterviewEvidence } from "../lib/platform/intake/intelligent-model";

const corpus = JSON.parse(readFileSync(new URL("../docs/c0-researched-planning-corpus.json", import.meta.url), "utf8")) as SitePlanningEvidence[];
const candidate = readFileSync(new URL("../docs/c0-researched-website-candidate.md", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const now = Date.parse("2026-11-15T12:00:00Z");
const c0 = fingerprint("C0 local verification");
const c2 = fingerprint("fictional C2 local verification");
const grantFor = (ownerDigest: string, evidence: readonly SitePlanningEvidence[]) => ({
  ownerDigest, evidenceDigest: fingerprint(evidence), expiresAt: now + 1_000, approvedAnswerDigests: [],
});

test("reviewed corpus is gathered at the existing exact-grant planning boundary", () => {
  const grant = grantFor(c0, corpus);
  const prepared = prepareSitePlanning(c0, corpus, [], grant, now);
  assert.equal(prepared.sourceIds.length, corpus.length);
  assert.equal(prepared.inputDigest, fingerprint({ ownerDigest: c0, input: prepared.input }));
  assert.deepEqual(new Set(prepared.input.sources.map(source => "authority" in source && source.authority)),
    new Set(["owner-decision", "provisional-direction", "historical", "public-observation", "unresolved"]));
  assert.match(JSON.stringify(prepared.input), /startups/);
  assert.match(JSON.stringify(prepared.input), /no commercial results/i);
  assert.doesNotMatch(JSON.stringify(prepared.input), /https:\/\/|docs\//);
  assert.deepEqual(prepared.input.answers, []);
  assert.throws(() => prepareSitePlanning(c2, corpus, [], grant, now), /not authorized/);
  assert.throws(() => prepareSitePlanning(c0, corpus, [], grant, grant.expiresAt), /not authorized/);

  const updated = corpus.map(source => ({ ...source, reference: source.reference + "#different-scope" }));
  assert.throws(() => prepareSitePlanning(c0, updated, [], grant, now), /not authorized/);
  const longer = { ...corpus[0], statement: corpus[0].statement.repeat(10) };
  const expanded = prepareSitePlanning(c0, [longer], [], grantFor(c0, [longer]), now);
  assert.equal(expanded.input.sources[0].statement, longer.statement);
});

test("metered full planning projects reviewed evidence and refuses the compact contract", async () => {
  const { mkdtemp, rm, rmdir } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { initializeResponsesUsageLedger, protectedSitePlanningProvider } = await import("../lib/platform/intake/intelligent-responses");
  const directory = await mkdtemp(join(tmpdir(), "miopages-corpus-"));
  try {
    const at = Date.now();
    const expiresAt = at + 60_000;
    const prepared = prepareSitePlanning(c0, corpus, [], { ...grantFor(c0, corpus), expiresAt }, at);
    const rates = { model: "offline-model", verifiedOn: "2026-11-15", inputPerMillion: 750_000, cachedPerMillion: 75_000,
      outputPerMillion: 4_500_000, cacheWritePerMillion: 0, countMicros: 0 };
    const limits = { ownerDigest: c0, inputDigest: prepared.inputDigest, expiresAt, maxRequests: 2, capMicros: 100_000 };
    const paths: string[] = [];
    const transport = { async send(path: string, request: object) {
      paths.push(path);
      assert.match(JSON.stringify(request), /provisional-direction/);
      assert.match(JSON.stringify(request), /external|public research/i);
      assert.ok(!JSON.stringify(request).includes("docs/"));
      assert.ok(!JSON.stringify(request).includes("https://"));
      if (path.endsWith("input_tokens")) return { body: { input_tokens: 3000 } };
      assert.equal((request as { store: boolean }).store, false);
      const proposal = {
        plan: { positioning: "A managed site", offering: "Launch and Ongoing", audience: "Small organizations",
          pages: [{ path: "/", title: "Home", purpose: "Explain the service", seoDescription: "Managed website",
            action: "Discuss scope", sections: [{ heading: "Your first step", body: "Tell us what a visitor needs to do." }] }] },
        directionSourceIds: ["offer"], unresolved: ["Verify the inquiry route."],
        pages: [{ path: "/", sourceIds: ["offer"], sectionSourceIds: [["offer"]], actionKind: "request-contact", destination: null }],
      };
      return { body: { model: rates.model, service_tier: "default", status: "completed",
        usage: { input_tokens: 3000, input_tokens_details: { cached_tokens: 0 }, output_tokens: 100,
          output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 3100 },
        output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(proposal) }] }],
      } };
    } };
    await initializeResponsesUsageLedger(directory, rates);
    const compact = protectedSitePlanningProvider(directory, rates, transport, { ...limits, format: "compact/2", maxOutputTokens: 6000 });
    await assert.rejects(compact(() => prepared), { code: "evidence_changed" });
    assert.deepEqual(paths, []);
    const full = protectedSitePlanningProvider(directory, rates, transport, limits);
    assert.equal((await full(() => prepared)).status, "proposed");
    assert.deepEqual(paths, ["/v1/responses/input_tokens", "/v1/responses"]);
  } finally {
    await rm(join(directory, "onboarding-usage.json"), { force: true });
    await rmdir(directory);
  }
});

test("legacy projection keeps the same model payload and fingerprint", () => {
  const historical: InterviewEvidence = { id: "proof", kind: "owner-confirmed", reference: "Private pointer",
    at: new Date(now).toISOString(), statement: "Legacy exact evidence." };
  const projected = prepareSitePlanning(c0, [historical], [], grantFor(c0, [historical]), now);
  const input = { sources: [{ id: historical.id, kind: historical.kind, statement: historical.statement }], answers: [] };
  assert.deepEqual(projected.input, input);
  assert.equal(projected.inputDigest, fingerprint({ ownerDigest: c0, input }));
});

test("all proposed public Page and Section copy survives Core planning validation", () => {
  const map = [
    { label: "Home", path: "/", refs: ["offer", "market", "entry-path", "ongoing-evidence"], action: "See what the Free Review covers", destination: "/review" },
    { label: "Service", path: "/service", refs: ["offer", "launch", "owner-responsibility"], action: "Discuss Launch scope", destination: "/contact" },
    { label: "Already have a site?", path: "/existing-website", refs: ["market", "legacy-site", "refresh-alternatives", "launch"],
      action: "Request a review of your current presence", destination: "/review" },
    { label: "Starting fresh?", path: "/new-website", refs: ["market", "proof", "launch"], action: "Talk about your first website", destination: "/contact" },
    { label: "Ongoing management", path: "/ongoing", refs: ["offer", "ongoing-evidence", "care-alternatives"], action: "See Launch and scope", destination: "/service" },
    { label: "Free Web Presence Review", path: "/review", refs: ["entry-path", "review-preview", "proof"], action: "Prepare a Free Review request", destination: "/contact" },
    { label: "Talk about your project", path: "/contact", refs: ["accessible-forms", "retirement", "commercial-review"],
      action: "Send inquiry", destination: null },
  ];
  const blocks = new Map([...candidate.matchAll(/^## ([^\n]+)\n([\s\S]*?)(?=^## |(?![\s\S]))/gm)].map(match => [match[1], match[2]]));
  const planPages = map.map(page => {
    const content = blocks.get(page.label);
    assert.ok(content, page.label);
    const text = (marker: string) => {
      const line = content.split("\n").find(line => line.startsWith(marker));
      assert.ok(line, page.label + " " + marker);
      return line.slice(marker.length);
    };
    const sections = [...content.matchAll(/^### ([^\n]+)\n([\s\S]*?)(?=^### |(?![\s\S]))/gm)].map(match => ({
      heading: match[1], body: match[2].replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim(),
    }));
    assert.ok(sections.length > 1);
    return { path: page.path, title: text("**H1** "), purpose: page.label, seoDescription: text("**Search description** "), action: page.action, sections };
  });
  const prepared = prepareSitePlanning(c0, corpus, [], grantFor(c0, corpus), now);
  const input = {
    plan: { positioning: "One managed presence for a first site or a better handoff", offering: "Launch and Ongoing",
      audience: "Small business owners", pages: planPages },
    directionSourceIds: ["offer", "market", "entry-path"],
    pages: map.map((page, i) => ({
      path: page.path, sourceIds: page.refs, sectionSourceIds: planPages[i].sections.map(() => page.refs),
      actionKind: page.destination ? "learn" : "request-contact", destination: page.destination,
    })),
    unresolved: ["Exact contact destination and review delivery need verification.", "No customer outcomes or public prices are authorized."],
  };
  const accepted = readSitePlanning(input, prepared);
  assert.deepEqual(accepted.plan.pages, planPages);
  assert.equal(accepted.status, "proposed");
  for (const { path } of planPages) assert.ok(candidate.includes("`" + path + "`"), path);
  const slugs = [...blocks.keys()].map(name => name.toLowerCase().replace(/[^a-z0-9 -]/g, "").replaceAll(" ", "-"));
  for (const [, slug] of candidate.matchAll(/\]\(#([a-z0-9-]+)\)/g)) assert.ok(slugs.includes(slug), slug);
  const unrelated: InterviewEvidence[] = [{
    id: "c2-tree-care", kind: "synthetic-review", at: new Date(now).toISOString(),
    reference: "Fictional C2 fixture", statement: "Routine tree care and storm assessment have separate contact needs.",
  }];
  const c2Projection = prepareSitePlanning(c2, unrelated, [], grantFor(c2, unrelated), now);
  assert.throws(() => readSitePlanning(input, c2Projection), { code: "proposal_citations" });
});
