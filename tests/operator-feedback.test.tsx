import assert from "node:assert/strict";
import test from "node:test";
import { droppedWording, keptWording, locate, operatorConcerns, textUnits } from "../lib/platform/intake/operator-feedback";
import type { NativeNode } from "../lib/platform/intake/presence-native-component";

const node = (kind: NativeNode["kind"], changes: Partial<NativeNode> = {}): NativeNode => ({ kind, text: null, level: null, items: [], ordered: false,
  reference: null, layout: { arrangement: "flow", columns: [], gap: "medium", inset: "none", surface: "none", align: "start", measure: "full",
    typeScale: "body", span: 1, mobileOrder: 0, border: false, rounded: false }, children: [], ...changes });

test("a revised page that drops the Operator's wording is caught; one that keeps it passes", () => {
  const keep = keptWording({ edits: [{ path: "/service", origin: "s:r.0", before: "Old", after: "Our  team   answers within a day." }] }, ["/service"]);
  const page = (text: string) => ({ path: "/service", heading: "Service", searchTitle: "", searchDescription: "", composition: "managed-v1" as const,
    actions: [], internalLinks: [], sections: [{ heading: "Service", body: "", sourceIds: [], role: "hero" as const,
      visual: { purpose: "p", brief: "b", altIntent: "a", status: "text-only" as const },
      block: { version: 2 as const, name: "x", purpose: "x", mode: "section" as const, root: node("group", { children: [
        node("heading", { level: 1, text: "Service" }), node("paragraph", { text })] }) } }] });
  assert.deepEqual(droppedWording(page("Our team answers within a day. More text.") as never, keep), []);
  assert.equal(droppedWording(page("A rewritten sentence.") as never, keep).length, 1);
  assert.deepEqual(droppedWording(page("A rewritten sentence.") as never, keep.map(item => ({ ...item, path: "/other" }))), [],
    "Only the page the wording belongs to is checked");
});

test("WordPress blocks are read back as plain text with Core's identifiers; nodes are located by path", () => {
  const content = '<!-- wp:heading {"level":1,"metadata":{"mio":"s:r.0"},"className":"x"} --><h1 class="x">Fast &amp; <strong>clear</strong></h1><!-- /wp:heading -->'
    + '<!-- wp:paragraph {"metadata":{"mio":"s:r.1","noteId":[7]}} --><p>Line one<br>Line two</p><!-- /wp:paragraph -->'
    + '<!-- wp:list --><ul class="wp-block-list"><!-- wp:list-item {"metadata":{"mio":"s:r.2/i0"}} --><li>It&#039;s first</li><!-- /wp:list-item --></ul><!-- /wp:list -->'
    + '<!-- wp:paragraph {"metadata":{"mio":"s:r.3"},"className":"miopages-pending-action"} --><p class="miopages-pending-action"><span aria-disabled="true">Begin — preview only; submissions disabled</span></p><!-- /wp:paragraph -->'
    + '<!-- wp:paragraph --><p>Added by the Operator</p><!-- /wp:paragraph -->';
  assert.deepEqual(textUnits(content).map(unit => [unit.origin, unit.text]), [
    ["s:r.0", "Fast & clear"], ["s:r.1", "Line one\nLine two"], ["s:r.2/i0", "It's first"], ["s:r.3", "Begin"], [null, "Added by the Operator"]]);
  const root = node("group", { children: [node("heading", { level: 1, text: "H" }), node("list", { items: ["a", "b"], text: "Label" })] });
  assert.equal(locate(root, "r.1/i1")?.item, 1);
  assert.equal(locate(root, "r.1/label")?.label, true);
  assert.equal(locate(root, "r.0/i0"), null, "A heading has no list items");
  assert.equal(locate(root, "r.5"), null);
});

test("Notes and structural changes become revision concerns; kept wording is restated only for revised pages", () => {
  const concerns = operatorConcerns({ readbackRevision: 1, acknowledged: [], titles: [],
    edits: [{ path: "/a", origin: "s:r.0", before: "x", after: "Kept words" }, { path: "/b", origin: "t:r.0", before: "y", after: "Other words" }],
    notes: [{ id: 1, path: "/a", origin: "s:r.1", blockType: "paragraph", blockText: "The old sentence", text: "Shorter please", replies: ["Agreed"] }],
    structural: [{ path: "/c", kind: "added", text: "A new line" }] });
  assert.deepEqual(concerns.map(item => item.path), ["/a", "/c", "/a"]);
  assert.match(concerns[0].concern, /On the paragraph .The old sentence.: Shorter please \(Further replies: Agreed\)/);
  assert.match(concerns[2].concern, /Keep this Operator wording exactly as written: .Kept words./);
  assert.ok(!concerns.some(item => item.path === "/b"), "An edit on a page without Notes is simply kept, not revised");
});
