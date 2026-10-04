import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { normalizeDefinition, normalizeFields, submissionInput } from "../lib/platform/contact/model";
import { developmentGuard } from "../lib/platform/contact/boundaries";
import { contactRetentionDays } from "../lib/platform/policy/site-policy";
import { contactHttp } from "../lib/platform/contact/http";
import { ContactContent } from "../components/managed-sites/contact-content";
import { resolveBusinessIdentity } from "../lib/platform/site-globals/model";
import { normalizeSection } from "../lib/platform/managed-sites/sections";
import { normalizeDestination } from "../lib/platform/actions/model";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { ContactForm } from "../components/managed-sites/contact-form";

const id = "11111111-1111-4111-8111-111111111111";
const configuration = { fields: [{ key: "message", label: "Message", required: true }, { key: "email", label: "Email", required: true }, { key: "name", label: "Name", required: false }], privacyText: "Only for your inquiry." };
const definition = normalizeDefinition({ id, version: 1, status: "active", configuration });
const input = { sectionId: id, definitionId: id, version: 1, fields: { email: "a@example.com", message: "Hello" }, idempotencyKey: "a".repeat(20), website: "" };

test("definitions have finite ordered fields and bounded plain text, no presentation-owned facts", () => {
  assert.deepEqual(definition.fields.map(f => f.key), ["message", "email", "name"]);
  for (const c of [{ ...configuration, phone: "1234567890" }, { fields: [] }, { fields: [{ key: "upload", label: "File", required: false }] }, { fields: [configuration.fields[0], configuration.fields[0]] }, { ...configuration, text: "x".repeat(2001) }, { fields: [{ key: "name", label: "x".repeat(101), required: true }] }, { fields: [{ key: "name", label: "Name", required: "yes" }] }]) {
    assert.throws(() => normalizeDefinition({ id, version: 1, status: "active", configuration: c }));
  }
  assert.throws(() => normalizeDefinition({ id, version: 0, status: "active", configuration }));
  assert.throws(() => normalizeDefinition({ id, version: 1, status: "inactive", configuration }));
  assert.deepEqual(normalizeFields({ email: " a@example.com ", message: "Hello\r\nWorld", name: " " }, definition), { message: "Hello\nWorld", email: "a@example.com" });
  for (const fields of [{ ...input.fields, email: "bad" }, { ...input.fields, email: "a@example.com\r\nBcc:x@example.com" }, { ...input.fields, name: "x\nY" }, { ...input.fields, message: "x".repeat(5001) }, { ...input.fields, secret: "no" }, { email: "a@example.com" }]) assert.throws(() => normalizeFields(fields, definition));
  const phone = normalizeDefinition({ id, version: 1, status: "active", configuration: { fields: [{ key: "phone", label: "Phone", required: false }, { key: "organization", label: "Company", required: true }] } });
  assert.deepEqual(normalizeFields({ phone: "+1 (212) 555-0100", organization: "Example" }, phone), { phone: "+1 (212) 555-0100", organization: "Example" });
  assert.throws(() => normalizeFields({ phone: "javascript:x", organization: "Example" }, phone));
  assert.throws(() => submissionInput({ ...input, recipient: "evil@example.com" }));
  assert.throws(() => submissionInput({ ...input, website: "bot" }));
});

test("Contact Section reuses selected definition and canonical facts; labels/required/privacy relationships and escaped copy", () => {
  const section = normalizeSection({ type: "contact", content: { contact_definition_id: id, heading: "Contact" } });
  assert.equal(section?.type, "contact"); assert.equal(normalizeSection({ type: "contact", content: {} }), null);
  const render = (configuration: unknown) => new JSDOM(renderToStaticMarkup(<ContactContent contact={{ definition: { ...definition, text: "<script>bad</script>" }, sectionId: id, identity: resolveBusinessIdentity(configuration, "Name", "Site") }} />)).window.document;
  const doc = render({ business: { phone: "+12125550100", email: "hello@example.com" } });
  assert.equal(doc.querySelector('a[href="tel:+12125550100"]')?.textContent, "+12125550100");
  assert.ok(doc.querySelector('a[href="mailto:hello@example.com"]'));
  assert.equal(doc.querySelectorAll("script").length, 0);
  for (const f of definition.fields) {
    const control = doc.querySelector(`[name="${f.key}"]`)!;
    assert.equal(doc.querySelector(`label[for="${control.id}"]`)?.textContent, f.label + (f.required ? " (required)" : ""));
    assert.equal(control.hasAttribute("required"), f.required);
  }
  assert.ok(doc.getElementById(doc.querySelector("form")!.getAttribute("aria-describedby")!));
  assert.ok(doc.querySelector('[role="status"][aria-live="polite"]'));
  assert.equal(render({}).querySelectorAll('a[href^="tel:"],a[href^="mailto:"]').length, 0);
  assert.equal(normalizeDestination("contact", "/contact#inquiry"), "/contact#inquiry");
  assert.equal(normalizeDestination("contact", "#inquiry"), "#inquiry");
});

test("retention precedence is bounded with explicit override permission; development guard bounds repeated attempts", async () => {
  assert.equal(contactRetentionDays({}, {}, {}), 30);
  const service = { contactRetentionDays: { value: 60, allowPresenceOverride: true, allowSiteOverride: false } };
  assert.equal(contactRetentionDays(service, { contactRetentionDays: 14 }, { contactRetentionDays: 7 }), 14);
  assert.equal(contactRetentionDays({ contactRetentionDays: { ...service.contactRetentionDays, allowSiteOverride: true } }, {}, { contactRetentionDays: 7 }), 7);
  for (const value of [0, -1, 366, "7", 1.5]) assert.equal(contactRetentionDays({ contactRetentionDays: { value } }, {}, {}), 30);
  let time = 0; const guard = developmentGuard(2, 100, () => time);
  assert.equal(await guard.allow("site"), true); assert.equal(await guard.allow("site"), true); assert.equal(await guard.allow("site"), false);
  time = 100; assert.equal(await guard.allow("site"), true);
});

test("HTTP limits bytes and exact origin/content type and never exposes internal errors", async () => {
  let calls = 0;
  const accept = async () => { calls++; return { accepted: true }; };
  const request = (body: string, headers: Record<string, string> = {}) => new Request("https://example.test/api/contact", { method: "POST", headers: { origin: "https://example.test", "content-type": "application/json", ...headers }, body });
  assert.equal((await contactHttp(request(JSON.stringify(input)), accept)).status, 200);
  assert.equal((await contactHttp(request("x".repeat(16385)), accept)).status, 413);
  assert.equal((await contactHttp(request("{}", { origin: "https://evil.test" }), accept)).status, 403);
  assert.equal((await contactHttp(request("{}", { "content-type": "text/plain" }), accept)).status, 415);
  assert.equal((await contactHttp(request("{"), accept)).status, 400);
  assert.equal(calls, 1);
  const failed = await contactHttp(request("{}"), async () => { throw new Error("secret provider response"); });
  assert.equal(failed.status, 503); assert.ok(!(await failed.text()).includes("secret"));
});

test("hydrated form associates errors, retains retry identity, and announces accepted success", async () => {
  const tree = <ContactForm definition={definition} sectionId={id} />;
  const dom = new JSDOM(`<div id="root">${renderToStaticMarkup(tree)}</div>`, { url: "https://example.test" });
  const bodies: Record<string, unknown>[] = [];
  const replacements = { window: dom.window, document: dom.window.document, FormData: dom.window.FormData, IS_REACT_ACT_ENVIRONMENT: true,
    requestAnimationFrame: (callback: () => void) => { callback(); return 1; },
    fetch: async (_url: unknown, init: { body: string }) => {
      bodies.push(JSON.parse(init.body));
      return bodies.length === 1 ? Response.json({ error: "invalid_fields", fieldErrors: { email: "Invalid" } }, { status: 422 }) : Response.json({ accepted: true });
    } };
  const descriptors = Object.fromEntries(Object.keys(replacements).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [k,v] of Object.entries(replacements)) Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    await act(async () => { root = hydrateRoot(dom.window.document.getElementById("root")!, tree); });
    const form = dom.window.document.querySelector("form")!;
    const email = form.querySelector('[name="email"]') as HTMLInputElement;
    email.value = "visitor@example.test"; (form.querySelector("textarea") as HTMLTextAreaElement).value = "Hello";
    const submit = () => form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    await act(async () => { submit(); });
    assert.equal(email.getAttribute("aria-invalid"), "true");
    assert.ok(dom.window.document.getElementById(email.getAttribute("aria-describedby")!)?.textContent?.includes("Error:"));
    await act(async () => { submit(); });
    assert.equal(form.querySelector('[role="status"]')?.textContent, definition.successText);
    assert.equal(form.querySelector("button")?.disabled, true);
    assert.equal(bodies[0].idempotencyKey, bodies[1].idempotencyKey);
    assert.ok(!JSON.stringify(bodies).includes("recipient"));
  } finally {
    if (root) await act(async () => root!.unmount()); dom.window.close();
    for (const k of Object.keys(replacements)) { const d = descriptors[k]; if (d) Object.defineProperty(globalThis,k,d); else Reflect.deleteProperty(globalThis,k); }
  }
});
