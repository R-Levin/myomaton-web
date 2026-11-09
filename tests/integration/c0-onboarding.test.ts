import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import test from "node:test";
import { createC0Onboarding } from "../../scripts/intake/c0-onboarding";
import { IntakeService } from "../../lib/platform/intake/service";
import { onboardingVersion } from "../../lib/platform/intake/onboarding";
import { source } from "../../lib/platform/activation/model";

const close = async (server: Server) => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); };

test("C0 direct-start onboarding reuses the scoped intake draft and immutable submission", async () => {
  const fixture = await createC0Onboarding(process.env.PG_BIN_DIR ?? "C:/Program Files/PostgreSQL/18/bin");
  let server = fixture.listener();
  const start = async () => {
    server.listen(0, "127.0.0.1"); await once(server, "listening");
    const address = server.address(); assert.ok(address && typeof address !== "string");
    return `http://127.0.0.1:${address.port}`;
  };
  let origin = await start();
  const request = (body?: object, cookie?: string, requestOrigin = origin) => fetch(origin + "/api/onboarding", {
    method: body ? "POST" : "GET", headers: { "X-Intake-Request": "1", ...(cookie && { Cookie: cookie }), ...(body && { Origin: requestOrigin, "Content-Type": "application/json" }) },
    ...(body && { body: JSON.stringify(body) }),
  });
  try {
    assert.equal((await request({ operation: "begin" }, undefined, "https://external.example")).status, 403);
    assert.equal((await request({ operation: "save", version: 1, answers: {}, step: 1 })).status, 404);
    const begin = await request({ operation: "begin" });
    assert.equal(begin.status, 200);
    const header = begin.headers.get("set-cookie")!;
    assert.match(header, /^miopages_c0_onboarding=[a-f0-9]{64}; Path=\/api\/onboarding; HttpOnly; SameSite=Strict/);
    const cookie = header.split(";", 1)[0];
    const first = await begin.json();
    assert.equal(first.questionnaireVersion, onboardingVersion);
    assert.equal(first.intent, "DIRECT_START");
    assert.equal(first.answers.businessName, "MioPages");
    assert.equal(first.provenance.offer.confirmation, "prior-approved");
    assert.equal(first.answers.primaryResponse, undefined);
    assert.deepEqual(await (await request()).json(), { state: "not_started" });
    assert.equal((await request(undefined, `miopages_c0_onboarding=${"0".repeat(64)}`)).status, 404);
    await assert.rejects(new IntakeService(fixture.pool, fixture.selection).resume(cookie.split("=")[1]), /session_unavailable/);

    const answers = { ...first.answers, audience: "Established technical service firms across the US.", siteSituation: "Start without an existing website",
      primaryResponse: "Not sure yet", bookingContext: "Old system", keepFromSite: "Old content" };
    const response = await request({ operation: "save", version: first.version, answers, step: 10 }, cookie);
    assert.equal(response.status, 200);
    const saved = await response.json();
    assert.equal(saved.answers.bookingContext, undefined);
    assert.equal(saved.answers.keepFromSite, undefined);
    assert.equal(saved.provenance.audience.source, "rehearsal-response");
    assert.equal(saved.provenance.offer.source, "c0-discovery");
    assert.equal((await request({ operation: "save", version: first.version, answers: first.answers, step: 1 }, cookie)).status, 409);

    await close(server); server = fixture.listener(); origin = await start();
    assert.deepEqual(await (await request(undefined, cookie)).json(), saved);
    const submit = await request({ operation: "submit", version: saved.version }, cookie);
    assert.equal(submit.status, 200);
    const submitted = await submit.json();
    assert.equal(submitted.state, "needs_operator_review");
    assert.match(submitted.submission.digest, /^[a-f0-9]{64}$/);
    assert.deepEqual(await (await request(undefined, cookie)).json(), submitted);
    assert.equal((await request({ operation: "save", version: submitted.version, answers, step: 0 }, cookie)).status, 409);
    const evidence = await fixture.pool.query("SELECT * FROM prospect_intake_submissions");
    assert.equal(evidence.rowCount, 1);
    assert.equal(evidence.rows[0].digest, submitted.submission.digest);
    await assert.rejects(fixture.pool.query("UPDATE prospect_intake_submissions SET answers='{}'"), /immutable/);
    assert.throws(() => source(evidence.rows[0]), /not activation evidence/);
    const counts = await fixture.pool.query("SELECT (SELECT count(*)::int FROM activation_cases) AS cases, (SELECT count(*)::int FROM business_knowledge) AS knowledge, (SELECT count(*)::int FROM managed_sites) AS sites");
    assert.deepEqual(counts.rows, [{ cases: 0, knowledge: 0, sites: 1 }]);
  } finally { if (server.listening) await close(server); await fixture.stop(); }
});
