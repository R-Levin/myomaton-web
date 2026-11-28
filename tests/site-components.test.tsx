import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import test from "node:test";
import { checkPage, type SitePage } from "../lib/platform/site/components";
import { renderPage, type RenderContext } from "../lib/platform/site/render";

const page = (): SitePage => ({ path: "/", title: "Home", menuLabel: "Home", searchTitle: "Bicycle repair", searchDescription: "Repairs in town",
  content: [
    { id: "h1", type: "heading", text: "Bicycles fixed while you wait" },
    { id: "t1", type: "text", text: "Same-day repairs in town.\n\nOpen six days a week." },
    { id: "p1", type: "picture", shows: "A mechanic truing a wheel", alt: "Mechanic at work" },
    { id: "a1", type: "action", label: "Book a repair", page: "/book" },
    { id: "h2", type: "heading", text: "What we fix" },
    { id: "i1", type: "item", title: "Brakes", text: "Adjusted and replaced." },
    { id: "i2", type: "item", title: "Gears", text: "Tuned for smooth shifting." },
    { id: "x1", type: "placeholder", need: "A customer's words", text: "A recent customer describing their repair." },
    { id: "h3", type: "heading", text: "Questions" },
    { id: "q1", type: "question", question: "Do I need to book?", answer: "No, walk in any time." },
  ],
  layout: [
    { id: "s1", component: "opening", variant: "split", band: "contrast", slots: { heading: ["h1"], text: ["t1"], picture: ["p1"], actions: ["a1"] } },
    { id: "s2", component: "points", variant: null, band: "light", slots: { heading: ["h2"], items: ["i1", "i2", "x1"] } },
    { id: "s3", component: "questions", variant: "folded", band: "tonal", slots: { heading: ["h3"], questions: ["q1"] } },
  ] });
const ctx: RenderContext = { link: path => `/?page_id=${path.length}`, picture: () => null, defaultVariant: () => "columns" };

test("a page's layout is checked against its content and the components, and problems are said plainly", () => {
  assert.deepEqual(checkPage(page(), ["/", "/book"]), { problems: [], unused: [] });
  const broken = page();
  broken.layout[1]!.slots.items = ["i1", "nope"];
  broken.layout[2]!.variant = "spiral";
  broken.layout[0]!.slots.heading = ["t1"];
  const { problems, unused } = checkPage(broken, ["/"]);
  assert.ok(problems.some(p => /isn't in the page's content/u.test(p)));
  assert.ok(problems.some(p => /no variant "spiral"/u.test(p)));
  assert.ok(problems.some(p => /heading can't hold a text/u.test(p)));
  assert.ok(problems.some(p => /isn't a page of the site/u.test(p)));
  assert.deepEqual(unused.sort(), ["h1", "i2", "x1"], "content no section uses is listed, not refused");
});

test("rendered as ordinary WordPress blocks, each content item named for read-back", () => {
  const html = renderPage(page(), ctx);
  assert.match(html, /mp-c-opening mp-v-split mp-band-contrast/u);
  assert.match(html, /mp-c-points mp-v-columns mp-band-light/u, "a section without a variant takes the design's default");
  assert.match(html, /<h1 class="wp-block-heading">Bicycles fixed while you wait<\/h1>/u, "the first section's heading is the page title");
  assert.equal((html.match(/<h1/gu) ?? []).length, 1);
  assert.match(html, /Image for position only/u, "a picture not yet chosen shows as an FPO frame");
  assert.match(html, /Content needed/u, "needed material shows as a marked placeholder");
  for (const id of ["h1", "t1", "p1", "a1", "i1", "x1", "q1"]) assert.ok(html.includes(`"name":"mp:${id}"`), `item ${id} is named`);
  assert.ok(!/<script|on[a-z]+=/iu.test(html));
  const withPicture = renderPage(page(), { ...ctx, picture: id => id === "p1" ? { url: "https://example.test/a.jpg", width: 800, height: 600 } : null });
  assert.match(withPicture, /<img src="https:\/\/example.test\/a.jpg" alt="Mechanic at work"/u);
});

const wordpress = process.env.WORDPRESS_SOURCE ?? "../p022-wp-validation/wordpress";
test("WordPress's own parser reads the page as the intended block tree", { skip: !existsSync(`${wordpress}/wp-includes/class-wp-block-parser.php`) && "no local WordPress copy" }, () => {
  type Block = { name: string | null; attrs: Record<string, unknown>; inner: Block[] };
  const tree = JSON.parse(execFileSync("php", ["scripts/site/parse-blocks.php", wordpress], { input: renderPage(page(), ctx), encoding: "utf8" })) as Block[];
  assert.deepEqual(tree.map(block => block.name), ["core/group", "core/group", "core/group"]);
  const names: string[] = [];
  const walk = (blocks: Block[]) => blocks.forEach(block => { names.push(block.name ?? "html"); walk(block.inner); });
  walk(tree);
  const allowed = new Set(["core/group", "core/heading", "core/paragraph", "core/image", "core/buttons", "core/button", "core/details"]);
  assert.deepEqual([...new Set(names)].filter(name => !allowed.has(name)), [], "only ordinary core blocks");
  const named = (blocks: Block[]): string[] => blocks.flatMap(block => [((block.attrs.metadata as { name?: string } | undefined)?.name ?? ""), ...named(block.inner)]).filter(Boolean);
  assert.ok(named(tree).includes("mp:q1"));
});
