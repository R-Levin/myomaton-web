import assert from "node:assert/strict";
import test from "node:test";
import { wellFormedModel, wellFormedRates } from "../lib/platform/intake/intelligent-responses";

const card = { model: "gpt-5.4-mini-2026-03-17", verifiedOn: "2026-11-25", inputPerMillion: 750_000, cachedPerMillion: 75_000,
  cacheWritePerMillion: 0, outputPerMillion: 4_500_000, countMicros: 0 };

test("the AI model and prices are settings: a new model or price is accepted without a code change", () => {
  assert.ok(wellFormedRates(card));
  assert.ok(wellFormedRates({ ...card, model: "gpt-6-mini-2027-01-10", inputPerMillion: 500_000, outputPerMillion: 3_000_000 }));
  assert.ok(wellFormedModel("gpt-6-mini-2027-01-10"));
});

test("a rate card must still be well formed, so every call is priced", () => {
  for (const bad of [{ ...card, inputPerMillion: -1 }, { ...card, outputPerMillion: 1.5 }, { ...card, model: "" },
    { ...card, model: "GPT 5 <script>" }, { ...card, countMicros: undefined as unknown as number }]) assert.ok(!wellFormedRates(bad), JSON.stringify(bad));
  assert.ok(!wellFormedRates(undefined));
});
