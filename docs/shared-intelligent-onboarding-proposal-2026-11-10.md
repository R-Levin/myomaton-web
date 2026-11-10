# Shared intelligent onboarding · bounded implementation proposal

**November 10, 2026 · Offline implementation delivered for review · Live API proof pending separate approval**

Build the first vertical slice of one onboarding engine. Both entry paths should reach the same source reconciliation, interview and readiness flow. Prove that two different answers produce different follow-up questions and a different business recommendation. The slice covers one substantive C0 knowledge gap and one fictional C2 control. Full coverage, Review-preview generation, real Review delivery and site generation remain separate work. [Recovery index](development-control.md#github-review-handoffs) · [C0 strategy recovery](https://github.com/R-Levin/myomaton-web/blob/2c6a41f22a811090b3a24d3f84607c41f2b33cc4/docs/c0-strategy-recovery-and-intelligent-onboarding-2026-11-10.md)

## Two entrances, one interview

| Entry | Carry into the shared onboarding draft | Required gate |
| --- | --- | --- |
| Review-led | Owned existing-site observations, actual Review interview and immutable submission, and the exact assessment with its delivery evidence when present. Preserve distinct authority and source dates. | Verify the Review/source binding where applicable. Record fit and scope, then require the existing commercial/onboarding authorization before paid discovery. |
| Direct start | The same existing-site evidence and any authorized prior knowledge. Ask only for missing foundational information needed for fit and scope. | Use the same commercial/onboarding gate. A Free Review is optional and the flow can proceed without any Review record. |

The entry path remains provenance. After the gate, both paths use the same evidence projection, question generator, answer handling and readiness calculation. In the isolated demonstration, use a clearly identified simulated Review-led entry and a separate direct-start entry. Exercise the real gate/refusal logic in tests with disposable authorization evidence. C0's October 5–6 approved discovery, November 9 public-site inventory and owner corrections can be reused with their own source references. The October 14 interview and approved, undelivered assessment are separate historical C0 evidence. Any synthetic delivery record is scoped to the test fixture and cannot change the historical Review's status. The direct-start fixture demonstrates convergence without Review data. Fictional C2 has only its supplied old-site observations and no invented Review. [Knowledge transfer](paid-onboarding-knowledge-transfer-contract.md#continuity-sequence-and-information-reuse) · [Fit and commercial gate](progressive-onboarding-and-launch-readiness.md#review-and-direct-start-converge) · [Preserved C0 evidence](https://github.com/R-Levin/myomaton-web/blob/a7e6bc3416904a086be0d50b1b1fbf346c64c5e6/docs/c0-onboarding-assessment-evidence-2026-11-09.md)

## First business question

**What can MioPages responsibly do in the first Ongoing cycle after Launch, and what evidence or owner decision would it need?** The service and audience are already known. The unresolved boundary affects how Service explains managed responsibility and what an Operator can plan or claim. Ground the prompt in the approved Launch-to-Ongoing direction, the owner correction that startups remain in scope, and the contrast with the old site's standalone services. Reuse safe, approved excerpts or summaries of the historical evidence. [C0 offering](miopages-c0-product-model.md#launch-and-ongoing-customer-deliverable-summary) · [Public-site inventory](c0-adaptive-onboarding-walkthrough.md#the-existing-site-review)

For review, consider two counterfactual replies. These examples describe the acceptance criteria and will stay out of the generator's examples so the proof can detect a fixed script.

| Example reply | What the second question should uncover | Assessment change |
| --- | --- | --- |
| The owner has representative inquiry notes showing a repeated fit misunderstanding and will confirm a proposed change in wording. | Ask what distinguishes a clearer explanation from a change to whom the business serves, and what the owner must confirm. | Add a source-linked, reviewable first-cycle example to the Service direction. Flag wording and new exclusions for owner confirmation. Hold result claims. |
| A new launch has no usable inquiry record and nobody has agreed to verify how prospects respond. | Ask what baseline signal can be collected, who will check it and what work can proceed until then. | Recommend a baseline and a responsible reviewer as the first work. Leave the improvement example and measured-benefit claims unresolved. |

The fictional C2 control uses the same engine with a separately scoped gap about the hours and area in which urgent tree calls are actually handled, distinct from routine estimates. A follow-up should respond to the stated coverage or withdrawal of urgent service. C2 receives no C0 service, contacts, history or Review. C0 receives no C2 observations or emergency options. [C2 benchmark](fictional-customer-2-tree-service-onboarding-scenario.md)

## Implementation boundary

- Reuse the existing versioned `IntakeService` draft, ownership and resume checks, optimistic revision, source fingerprints and immutable submission boundary. Reuse `ActivationService` and its existing commercial and business-information authority gates. Confirm the bounded transcript fits the existing JSON and request limits before choosing its draft encoding. Preserve old digests and readers. If it cannot fit safely, stop and bring the storage decision back for review. [Intake service](../lib/platform/intake/service.ts) · [Activation service](../lib/platform/activation/service.ts) · [Existing persistence bounds](../lib/platform/db/migrations/0010_progressive_intake.sql)
- Build a server-side, provider-neutral step that receives an owned draft revision, a material gap, scoped source references, prior question/answer history and a small evidence projection. Mark approved facts, old-site observations, Review analysis and customer assertions separately. Treat evidence as untrusted data. Reject foreign or stale references before dispatch and recheck on result commit. C0 and C2 use separate scopes, drafts, context construction and receipts. They share only the engine, schema and aggregate spend ceiling.
- Ask the model for a newly composed question or a reason to stop, short rationale, referenced evidence and a proposed assessment change. Validate the strict response schema and check the semantics against current sources and allowed fields. On a valid reply, preserve exact displayed wording, version, source binding, answer or deferral, and any later supersession in the draft. A reload returns the persisted question. The Operator can suppress or defer it. A known fact should leave the question queue.
- Keep readiness rules and authority in Core. Project validated new evidence into planning recommendations and explicit unresolved items. A model output or customer answer can change draft planning readiness. Confirmed truth, commercial authority, publication readiness and approval still require their existing independent checks. A refusal, invalid output, ambiguous source or cap exhaustion leaves the gap open and allows an Operator to continue manually.

## OpenAI development guardrails

Use the Responses API server-side with strict Structured Outputs, an explicitly approved pinned text model, standard processing and a protected development-project key. Rebuild the minimum context from the local draft for each request, with `store: false`, no provider conversation state or tools. The first paid proof may use only an owner-approved sanitized C0 evidence projection and fictional controls. Raw preserved records, credentials, contacts and routing details remain local. Review the project's actual retention settings before sending anything. `store: false` limits application-state storage and does not establish Zero Data Retention. [Responses API](https://developers.openai.com/api/reference/responses/overview) · [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) · [Data controls](https://developers.openai.com/api/docs/guides/your-data)

| Proposed ceiling for one separately authorized development run | Enforcement |
| --- | --- |
| **8 generation attempts** across four two-turn traces | Two contrasting C0 Review-led traces, one C0 direct-start trace, one C2 control. Each generation attempt counts at dispatch. No retries, fallback model or background calls. |
| **16 total outbound requests** | Allow at most eight exact-input token-count requests, one per generation attempt. Count each provider request, including a failure. Reuse the exact same input, instructions, schema and model when counting and generating. |
| **4,000 input and 1,200 output tokens per generation**, including reasoning in the output ceiling | Count the full request before generation. Reject oversize input and set the output cap in the API request. Reserve against the highest applicable input rate and maximum output. |
| **US$0.50 aggregate application limit** | At approved rate ceilings of US$5 per million input tokens and US$25 per million output tokens, each generation reserves at most US$0.05 and eight reserve at most US$0.40. Before enabling traffic, verify model availability, price snapshot including applicable cache-write rates, and the billing treatment of counting. Any additional bounded counting cost must fit the same cap. Refuse unknown rates. |

Use the acquisition code's reserve-before-dispatch and uncertain-charge handling as a pattern. The current work ledger is scoped to existing capabilities, so the proof should use a small, locked, Git-ignored run receipt for the shared spend counter, durable across a runner restart. Atomically reserve request slots and spend before dispatch and prevent concurrent use of the same run authorization. Settle only against verified response usage. Track request/response IDs when available, model and tier, input/cached/output/reasoning tokens where reported, date and version of the rate card, estimated cost and reservation, and result status. Label computed cost as a usage-based estimate and reconcile against development-project billing separately. Missing usage, unknown outcomes after dispatch or model/tier/rate mismatch retain the reservation and halt the run. A reload or duplicate action makes no additional provider request. Provider spend limits are a secondary backstop. [Existing reservation pattern](../lib/platform/acquisition/service.ts) · [Token counting](https://developers.openai.com/api/docs/guides/token-counting) · [Pricing](https://developers.openai.com/api/docs/pricing) · [Provider spend limits](https://developers.openai.com/api/docs/guides/spend-limits)

## Evidence for acceptance

- **Simulated tests, zero provider traffic.** Use a fake transport and disposable data to prove the two paths converge after authorization, a Review stays optional, historical approval does not imply delivery, readiness responds to known and missing evidence, and exact prompt/answer provenance resumes. Test foreign and stale contexts, wrong-business options, malicious or invalid output, concurrent dispatch, reload/retry behavior, and exhausted or uncertain budget. These tests prove application behavior.
- **Actual reasoning proof, separate owner authorization.** Run the four capped traces with the real model. For the two C0 counterfactuals, fork the same persisted first question and evidence into isolated C0 test drafts and vary only the answer under test. Reusing the first response requires no extra call. Preserve a sanitized receipt for each trace showing evidence class, shareable generated wording, why the answer changed the second question and assessment, and usage. ChatGPT reviews semantic relevance against the approved evidence. Different wording alone is insufficient. No known offer should be re-asked and no fabricated Review, evidence, authority or promises should appear. Report failure if the model output is generic, crosses scopes or leaves the plan effectively unchanged.

## Offline implementation checkpoint

The owner authorized this bounded local slice with the product correction that
the first proof must explore a substantive buyer, offering, objection or proof
gap alongside an Ongoing-cycle question. [Product correction](https://github.com/R-Levin/myomaton-web/issues/10#issuecomment-6772007075) · [Owner authorization](https://github.com/R-Levin/myomaton-web/issues/10#issuecomment-6772038269)

The trusted in-process engine uses the existing activation authority and exact
immutable intake/Review source checks. Review-led and direct-start cases
converge on the same draft operations after commercial confirmation. A new
local-only draft version stores the source binding, exact displayed question,
generator version, answer or deferral, and proposed assessment in the existing
provenance envelope. The bounded test passed without a schema migration or
changes to earlier drafts. This version has no HTTP route or submission path.
The disposable Review-led case uses a synthetic approved Review prerequisite.
The curated October 14 historical interview and approved, undelivered
assessment retain separate provenance. Direct start requires no Review. C2 has
its own tenant, activation, draft, sources and usage attribution.

| Saved example from the offline fixture | Assessment effect |
| --- | --- |
| C0 buyer proof: “If a founder sees the old hosting offer, what evidence would show that Launch includes an ongoing managed relationship?” A fixture answer with a dated comparison produced “Who can verify the comparison and clear it for prospective customers?” | Draft a reviewable Service example from the comparison. Readiness is **planning review**. Deferring the evidence follow-up reopens the gap. |
| C0 same initial buyer-proof question with an unknown answer: “What baseline should be collected before making that claim?” | Keep the claim out of launch copy and collect a baseline. Readiness remains **open**. |
| C0 Ongoing: “After Launch, which supported change could you make if early inquiries misunderstand the offer?” The fixture has no usable notes. | The second question asks what baseline to collect. Keep the improvement claim open pending evidence and a reviewer. |
| Fictional C2: “Which parts of the advertised service area can you actually cover for an urgent tree call on a weekday?” A fixture answer limits coverage. | The saved follow-up asks about out-of-area callers and the routine estimate route. Recommend separate limited urgent and routine routes while hours, coverage and fallback remain unverified. |

The fake transport is test code. It supplies the example wording to exercise
context assembly, strict validation, exact resume, evidence links and
answer-dependent state. These examples establish neither actual model
reasoning nor semantic acceptance. Exact duplicate questions and foreign
references are refused. Meaningful novelty, semantic relevance and subtle
cross-business language still require review of real generated output.

The Responses adapter has a strict request/response contract and an injected
offline transport only. It records scoped request slots, token usage, rate-card
binding and cost estimates in a locked development ledger. The regression
exercised eight fake generations and sixteen fake requests, and refused a
ninth generation. Additional checks cover oversize input, a spend limit,
changed rates and a timeout or invalid usage that retains its reservation
across reopen. Tests use synthetic pricing and do not verify provider rates.
No key was loaded and no provider traffic occurred.

Verification passed: 388 application tests, eight focused onboarding and
accounting checks including the two earlier intake modes, 21 activation and
canonical information regression checks, TypeScript and focused ESLint.

Run the isolated proof from this checkout:

```powershell
node --import tsx --test tests/integration/intelligent-onboarding.test.ts
```

**Next owner decision:** review the saved examples and implementation. Any
live reasoning proof requires separate explicit approval of the exact pinned
model, evidence allowlist, development-project key and data controls, verified
rate card, and no more than US$0.50. The proposed provider run is distinct
from any later owner-visible conversation acceptance. No hosted writes,
canonical promotion, Operator submission, WordPress generation or publication
are authorized by this checkpoint.
