import { parseArgs } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "node:http";
import { mioPagesIntakeOwner } from "../lib/platform/intake/availability";
import { developmentOnly, manualModelAdapter, synthesize, type Evidence, type PresenceCoverage } from "../lib/platform/reviews/model";
import { LocalReviewStore, reviewRoot, type Binding } from "../lib/platform/reviews/store";
import { reviewHtml, reviewMarkdown, reviewSections } from "../lib/platform/reviews/presentation";
import { originalHumanPacket } from "./reviews/source";
import { loadSolutionContext } from "./reviews/context";
import { evidencePacket, reviewClaims } from "../lib/platform/reviews/model";
import { beginHumanEdit, inspectHumanEdit, saveHumanEdit } from "./reviews/editing";
import { comparisonMarkdown, type EditNotes } from "../lib/platform/reviews/revision-context";

const json = async (file: string | undefined) => { if (!file) throw Error("Explicit input file required"); const b = await readFile(file); if (b.length > 250000) throw Error("Input file too large"); return JSON.parse(b.toString("utf8")); };
async function main() {
  developmentOnly();
  const args = parseArgs({ allowPositionals: true, strict: true, options: { id: { type: "string" }, draft: { type: "string" }, evidence: { type: "string" }, binding: { type: "string" }, checks: { type: "string" }, actor: { type: "string" }, note: { type: "string" }, port: { type: "string" }, "full-service-context": { type: "boolean" }, workspace: { type: "string" }, input: { type: "string" }, "edit-notes": { type: "string" }, from: { type: "string" }, to: { type: "string" } } });
  if (args.positionals.length !== 1) throw Error("Select one command"); const command = args.positionals[0], a = args.values;
  if (command === "prepare-original") {
    const capture = await json(a.evidence) as { evidence: Evidence[]; coverage: string; presence?: PresenceCoverage };
    const original = await originalHumanPacket(capture.evidence, capture.coverage, capture.presence);
    const packet = a["full-service-context"] ? evidencePacket(original.owner, original.submission, original.evidence, original.coverage, original.presence, await loadSolutionContext()) : original;
    const content = await synthesize({ packet, operation: "free-review", authorizedAttempts: 1 }, manualModelAdapter(await json(a.draft)));
    if (a["full-service-context"] && !["consultative/1", "consultative/2"].includes(content.format ?? "")) throw Error("Full service synthesis requires the consultative format");
    const store = await LocalReviewStore.create(packet, content, a.actor ?? "development-manual-model");
    await store.append("request-review", await store.currentBinding(), null, a.actor ?? "development-manual-model", "Substantive original-human draft; awaiting human review");
    console.log(JSON.stringify({ id: store.id, state: "NEEDS_OPERATOR_REVIEW", source: "original-first-human", directory: path.join(reviewRoot(), store.id) })); return;
  }
  if (!a.id) throw Error("Explicit Review id required"); const store = new LocalReviewStore(a.id, mioPagesIntakeOwner);
  if (command === "dry-run-edit") { if (!a.workspace) throw Error("Explicit workspace required"); const result = await inspectHumanEdit(store, a.workspace, a.input); console.log(JSON.stringify({ id: store.id, baselineRevision: result.base.number, state: result.review.state, persisted: false, sections: reviewSections(result.draft).map(s => ({ title: s.title, paragraphs: s.paragraphs.length })), claims: reviewClaims(result.draft).map(row => ({ location: row.location, id: row.claim.id, characters: row.claim.text.length, referenceState: row.claim.referenceReview ? "candidate" : "retained" })) }, null, 2)); return; }
  if (command === "begin-edit") { console.log(JSON.stringify(await beginHumanEdit(store))); return; }
  if (command === "save-edit") { if (!a.workspace || !a.actor || !a.note) throw Error("Workspace, operator and note required"); const r = await saveHumanEdit(store, a.workspace, a.actor, a.note); console.log(JSON.stringify({ state: r.state, revision: r.revisions.at(-1)!.number, binding: await store.currentBinding(), evidenceReviewRequired: true })); return; }
  if (command === "binding") { console.log(JSON.stringify(await store.currentBinding(), null, 2)); return; }
  if (command === "compare") { const r = await store.read(); console.log(comparisonMarkdown(r, Number(a.from ?? r.revisions.at(-2)?.number ?? 1), Number(a.to ?? r.revisions.at(-1)!.number))); return; }
  if (command === "inspect") {
    const r = await store.read(), directory = path.join(reviewRoot(), store.id);
    await writeFile(path.join(directory, "editable-review.json"), JSON.stringify(r.revisions.at(-1)!.content, null, 2), { mode: 0o600 });
    await writeFile(path.join(directory, "binding.json"), JSON.stringify(await store.currentBinding(), null, 2), { mode: 0o600 });
    await writeFile(path.join(directory, "review.md"), reviewMarkdown(r.revisions.at(-1)!.content), { mode: 0o600 });
    console.log(JSON.stringify({ directory, state: r.state, revision: r.revisions.at(-1)!.number })); return;
  }
  if (["edit", "request-review", "approve"].includes(command)) {
    if (!a.actor || !a.note) throw Error("Operator identity and concise note required");
    const r = await store.append(command as "edit" | "request-review" | "approve", await json(a.binding) as Binding, command === "edit" ? await json(a.draft) : null, a.actor, a.note, command === "approve" ? await json(a.checks) : undefined, command === "edit" && a["edit-notes"] ? await json(a["edit-notes"]) as EditNotes : undefined);
    console.log(JSON.stringify({ state: r.state, revision: r.revisions.at(-1)!.number })); return;
  }
  if (command !== "preview") throw Error("Unknown Review command");
  await store.read(); const port = Number(a.port ?? "0"); if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error("Invalid loopback port");
  const server = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store"); res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"); res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("Referrer-Policy", "no-referrer");
    try {
      developmentOnly(); const address = server.address();
      if (!address || typeof address === "string" || req.headers.host !== `127.0.0.1:${address.port}` || !["127.0.0.1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? "")) { res.writeHead(404).end(); return; }
      if (req.method !== "GET") { res.writeHead(405).end(); return; }
      if (!["/", "/operator", "/diagnostics", "/comparison"].includes(req.url ?? "")) { res.writeHead(404).end(); return; }
      res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(reviewHtml(await store.read(), req.url !== "/", req.url === "/diagnostics" ? "diagnostics" : req.url === "/comparison" ? "comparison" : "normal"));
    } catch { res.writeHead(404).end(); }
  });
  server.listen(port, "127.0.0.1", () => { const a = server.address(); if (a && typeof a !== "string") console.log(JSON.stringify({ preview: `http://127.0.0.1:${a.port}/`, operator: `http://127.0.0.1:${a.port}/operator`, id: store.id, readOnly: true })); });
}
main().catch(error => { console.error(error instanceof Error && error.message.startsWith("MIOPAGES_REVIEW_PRESERVATION_BUNDLE ") ? error.message : "Review command refused; check development authorization, owner, source integrity, revision binding and validated input. No shared writes supported."); process.exitCode = 1; });
