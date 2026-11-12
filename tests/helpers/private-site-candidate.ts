import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeDestination } from "../../lib/platform/actions/model";
import { fingerprint } from "../../lib/platform/canonical/model";
import type { Site } from "../../lib/platform/wordpress-delivery/authority";

type StagedPage = {
  site: Site; path: "/" | "/service"; pageId: string; proposalId: string; revision: number;
  sourceDigest: string; projectionDigest: string; previewDigest: string;
  release: string; receipt: string; objectSha256: string; html: string;
};

// Local composition of exact, separately governed stages. The digest is an
// evidence identifier, with no delivery, approval or publication authority.
export function privateSiteCandidate(site: Site, home: StagedPage, service: StagedPage, previous?: PrivateSiteCandidate): PrivateSiteCandidate {
  assert.equal(home.path, "/");
  assert.equal(service.path, "/service");
  assert.notEqual(home.pageId, service.pageId);
  assert.notEqual(home.release, service.release);
  assert.equal(home.sourceDigest, service.sourceDigest);
  for (const member of [home, service]) {
    assert.deepEqual(member.site, site);
    assert.match(member.objectSha256, /^[a-f0-9]{64}$/);
    assert.equal(member.receipt, "staged:1:" + member.objectSha256);
  }
  if (previous) {
    assert.deepEqual(previous.manifest.site, site);
    assert.deepEqual(previous.pages.home, home);
    assert.equal(previous.pages.service.pageId, service.pageId);
    assert.equal(previous.pages.service.proposalId, service.proposalId);
    assert.equal(previous.pages.service.revision + 1, service.revision);
    assert.notEqual(previous.pages.service.objectSha256, service.objectSha256);
  }
  const metadata = ({ html, ...binding }: StagedPage) => ({ ...binding, renderedDigest: fingerprint(html) });
  const manifest = { site, version: previous ? previous.manifest.version + 1 : 1, previous: previous?.digest ?? null,
    navigation: ["/", "/service"], action: { type: "contact", destination: normalizeDestination("contact", "#inquiry") },
    pages: [metadata(home), metadata(service)] };
  return { manifest, digest: fingerprint(manifest), pages: { home, service } };
}

type PrivateSiteCandidate = {
  manifest: { site: Site; version: number; previous: string | null; navigation: string[];
    action: { type: string; destination: string | null }; pages: (Omit<StagedPage, "html"> & { renderedDigest: string })[] };
  digest: string;
  pages: { home: StagedPage; service: StagedPage };
};

export async function writePrivateSiteCandidate(directory: string, candidate: PrivateSiteCandidate, shell: string) {
  const version = candidate.manifest.version;
  const target = path.join(directory, "site-v" + version);
  await mkdir(target, { mode: 0o700 });
  const action = candidate.manifest.action.destination;
  assert.equal(action, "#inquiry");
  for (const [name, filename, member] of [
    ["Home", "index.html", candidate.pages.home], ["Service", "service.html", candidate.pages.service],
  ] as const) {
    const navigation = [["Home", "index.html"], ["Service", "service.html"]].map(([label, href]) =>
      `<a href="${href}"${label === name ? ' aria-current="page"' : ""}>${label}</a>`).join("");
    await writeFile(path.join(target, filename), `${shell}<body><main>
<header><strong>MioPages</strong><p>Private site candidate · Version ${version}</p>
<nav aria-label="Site navigation">${navigation}<a href="${action}">Ask about your website</a></nav></header>
<h1>${name}</h1>${member.html}
<section id="inquiry"><h2>Ask about your website</h2>
<p>Have a question about moving from your current site? This local preview uses a synthetic inquiry.</p>
<p><a href="../index.html#measurement">Inspect the sample inquiry and its outcome</a></p></section>
<footer><a href="../index.html#customer">Back to the review</a></footer>
</main></body></html>`, { flag: "wx", mode: 0o600 });
  }
  await writeFile(path.join(target, "candidate.json"), JSON.stringify({ digest: candidate.digest, ...candidate.manifest }, null, 2) + "\n",
    { flag: "wx", mode: 0o600 });
}
