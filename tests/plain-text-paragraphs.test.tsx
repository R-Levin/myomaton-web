import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PlainTextParagraphs } from "../components/managed-sites/plain-text-paragraphs";
import { SectionRenderer } from "../components/managed-sites/section-renderer";

const render = (text: unknown) => renderToStaticMarkup(<PlainTextParagraphs text={text} />);

test("plain text paragraphs normalize blank lines and line endings without generating empty markup", () => {
  assert.equal(render("Ordinary text."), "<p>Ordinary text.</p>");
  assert.equal(render("One\nsoft line"), "<p>One\nsoft line</p>");
  for (const newline of ["\n", "\r\n", "\r"]) {
    assert.equal(render(` \t${newline}${newline} First ${newline} \t ${newline}${newline}Second${newline}${newline} `), "<p>First</p><p>Second</p>");
  }
  for (const empty of [undefined, null, false, 0, {}, [], "", " \t\r\n\r\n "]) assert.equal(render(empty), "");
});

test("paragraph content is escaped plain text, never HTML, entities, links or rich text", () => {
  assert.equal(render('<script>alert("x")</script>\n\n<img src=x onerror=alert(1)> &amp;'),
    '<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p><p>&lt;img src=x onerror=alert(1)&gt; &amp;amp;</p>');
  assert.equal(render("[link](javascript:bad)\n\n**bold**"), "<p>[link](javascript:bad)</p><p>**bold**</p>");
});

test("Hero, Intro, CTA and collection introductory text share semantic paragraphs without changing stored copy", () => {
  for (const type of ["hero", "intro", "cta", "collection"]) {
    const section = { id: "fixture", name: "Fixture", type, variant: "default", configuration: {},
      content: { heading: "Heading", text: "First\n\n<Second>\n\n \nThird", ...(type === "collection" ? { itemSource: "inline", items: [] } : {}) } };
    const before = structuredClone(section);
    const html = renderToStaticMarkup(<SectionRenderer section={section} />);
    assert.match(html, /<p>First<\/p><p>&lt;Second&gt;<\/p><p>Third<\/p>/);
    assert.equal((html.match(/<p>/g) ?? []).length, 3);
    assert.deepEqual(section, before);
  }
});

test("inline and resolved Subject collection cards use the same paragraph behavior", () => {
  for (const itemSource of ["inline", "subjects"]) {
    const section = { id: "fixture", name: "Fixture", type: "collection", variant: "grid", configuration: {},
      content: { heading: "Cards", itemSource, items: itemSource === "inline" ? [
        { id: "card", heading: "Card", text: "First\r\n\r\n<b>Second</b>" },
      ] : [] },
      ...(itemSource === "subjects" ? { collectionItems: [{ id: "card", heading: "Card", text: "First\r\n\r\n<b>Second</b>" }] } : {}),
    };
    const html = renderToStaticMarkup(<SectionRenderer section={section} />);
    assert.match(html, /<h3>Card<\/h3><p>First<\/p><p>&lt;b&gt;Second&lt;\/b&gt;<\/p><\/li>/);
    assert.ok(!html.includes("<p><p>"));
  }
});
