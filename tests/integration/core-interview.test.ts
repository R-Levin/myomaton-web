import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { setTimeout as wait } from "node:timers/promises";
import { JSDOM } from "jsdom";
import { createCoreInterviewRehearsal } from "../../scripts/intake/c0-onboarding";

test("local Core interview authenticates both paths, persists scoped answers and serves the same draft to a read-only Operator", async () => {
  Object.assign(process.env, { NODE_ENV: "development", MIOPAGES_REVIEW_SYNTHESIS: "local-operator" });
  const rehearsal = await createCoreInterviewRehearsal(process.env.PG_BIN_DIR ?? "C:/Program Files/PostgreSQL/18/bin");
  const server = rehearsal.listener();
  try {
    server.listen(0, "127.0.0.1"); await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const origin = "http://127.0.0.1:" + address.port;
    const page = await fetch(origin + "/onboarding?interview=c0%2Freview");
    assert.match(await page.text(), /onboarding.js/);
    assert.equal((await fetch(origin + "/onboarding.js")).status, 200);
    const request = (path = "", body?: object, cookie?: string, from = origin) => fetch(origin + "/api/core-interview" + path, {
      method: body ? "POST" : "GET",
      headers: { "X-Intake-Request": "1", ...(cookie && { Cookie: cookie }),
        ...(body && { Origin: from, "Content-Type": "application/json" }) },
      body: body && JSON.stringify(body),
    });
    async function login(principal: keyof typeof rehearsal.credentials) {
      const result = await request("", { operation: "login", code: rehearsal.credentials[principal] });
      assert.equal(result.status, 200);
      const cookie = result.headers.get("set-cookie")!;
      assert.match(cookie, /HttpOnly; SameSite=Strict/);
      return cookie.split(";")[0];
    }
    const path = "/c0/review";
    assert.equal((await request(path)).status, 401);
    assert.equal((await request("", { operation: "login", code: "invalid" })).status, 401);
    assert.equal((await request("", { operation: "login", code: rehearsal.credentials.c0 }, undefined, "http://invalid.test")).status, 403);
    const c0 = await login("c0");
    const read = (selection: string, cookie = c0) => request(selection, undefined, cookie).then(reply => reply.json());
    const send = async (operation: object, selection = path, cookie = c0) => {
      const response = await request(selection, operation, cookie);
      assert.equal(response.status, 200);
      return response.json();
    };
    const first = await send({ operation: "begin" });
    assert.equal(first.entryPath, "FREE_REVIEW");
    assert.ok(first.evidence.some((source: { kind: string }) => source.kind === "historical-review-answer"));
    assert.deepEqual(await read(path), first);
    const direct = await send({ operation: "begin" }, "/c0/direct");
    assert.equal(direct.entryPath, "DIRECT_START");
    assert.equal(direct.state.turns[0].question, first.state.turns[0].question);
    assert.ok(!direct.evidence.some((source: { kind: string }) => source.kind.startsWith("historical-review")));
    assert.equal((await request("/c2/review", { operation: "begin" }, c0)).status, 404);
    const answer = { operation: "answer", version: first.version, questionId: first.state.turns[0].id,
      answer: "During Ongoing, existing clients can request a service change." };
    const saved = await send(answer);
    assert.equal((await request(path, answer, c0)).status, 409);
    assert.deepEqual(await read(path), saved);
    const follow = await send({ operation: "continue", version: saved.version });
    assert.equal(follow.state.turns[1].answerReview.relevance, "off-topic");
    assert.match(follow.state.turns[1].question, /Launch/);
    assert.equal(follow.readiness[0].status, "open");
    const next = await send({ operation: "answer", version: follow.version, questionId: follow.state.turns[1].id,
      answer: "Launch includes up to five core pages." });
    const assessed = await send({ operation: "continue", version: next.version });
    assert.equal(assessed.readiness[0].status, "planning-review");
    assert.match(assessed.state.turns[2].answerReview.excerpt, /five core pages/);
    assert.deepEqual(await read(path), assessed);
    assert.deepEqual(await read("/c0/direct"), direct);
    const operator = await login("operator");
    assert.deepEqual(await read(path, operator), assessed);
    assert.equal((await request(path, { operation: "continue", version: assessed.version }, operator)).status, 403);
    assert.equal((await request("/startup/direct", { operation: "begin" }, operator)).status, 403);
    for (const scenario of ["c2", "startup"] as const) {
      const customer = await login(scenario);
      const selection = "/" + scenario + "/direct";
      const draft = await send({ operation: "begin" }, selection, customer);
      assert.match(draft.state.turns[0].question, scenario === "c2" ? /urgent phone/ : /one mechanic/);
      const recorded = await send({ operation: "answer", version: draft.version, questionId: draft.state.turns[0].id,
        answer: scenario === "c2" ? "We have no after-hours voicemail coverage." : "We can confirm visits manually." }, selection, customer);
      const result = await send({ operation: "continue", version: recorded.version }, selection, customer);
      assert.match(result.state.turns[1].question, scenario === "c2" ? /verified referral/ : /ZIP codes/);
      assert.equal(result.readiness[0].status, "open");
      assert.equal((await request(path, undefined, customer)).status, 404);
    }
    await send({ operation: "logout" }, "", c0);
    assert.equal((await request(path, undefined, c0)).status, 401);
    assert.deepEqual(await read(path, await login("c0")), assessed);

    // Exercise the real browser bundle and a fresh document on reload.
    const bundle = await fetch(origin + "/onboarding.js").then(result => result.text());
    let browserCookie = "";
    function browser(url: string) {
      const dom = new JSDOM('<div id="onboarding"></div>', { url, runScripts: "outside-only" });
      dom.window.fetch = async (resource, init) => {
        const headers = new Headers(init?.headers);
        if (browserCookie) headers.set("Cookie", browserCookie);
        if (init?.method === "POST") headers.set("Origin", origin);
        const result = await fetch(new URL(String(resource), url), { ...init, headers });
        const cookie = result.headers.get("set-cookie");
        if (cookie) browserCookie = cookie.split(";")[0];
        return result;
      };
      dom.window.eval(bundle);
      return dom;
    }
    async function until(predicate: () => boolean) {
      for (let tries = 0; tries < 120; tries++) {
        if (predicate()) return;
        await wait(50);
      }
      assert.ok(predicate(), "Expected browser state");
    }
    const url = origin + "/onboarding?interview=c0%2Fdirect";
    const customer = browser(url);
    try {
      const { document, Event } = customer.window;
      const submit = (form: HTMLFormElement) => form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      await until(() => document.querySelector("main")?.getAttribute("aria-busy") === "false");
      document.querySelector<HTMLInputElement>("#access-code")!.value = rehearsal.credentials.c0;
      submit(document.querySelector("form")!);
      await until(() => !!document.querySelector("#interview-answer"));
      document.querySelector<HTMLTextAreaElement>("#interview-answer")!.value = "Launch includes up to seven core pages.";
      submit(document.querySelector<HTMLTextAreaElement>("#interview-answer")!.form!);
      await until(() => document.body.textContent!.includes("Ready for planning review"));
    } finally { customer.window.close(); }
    const resumed = browser(url);
    try {
      await until(() => resumed.window.document.body.textContent!.includes("Ready for planning review"));
      assert.match(resumed.window.document.body.textContent!, /seven core pages/);
    } finally { resumed.window.close(); }
  } finally {
    if (server.listening) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
    await rehearsal.stop();
  }
});
