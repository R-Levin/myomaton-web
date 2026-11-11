# Shared intelligent onboarding · controlled OpenAI proof

**November 10, 2026 · Preparation baseline, revised authorization and live result**

The proposed run exercises the existing [offline engine at `b48b3cf`](https://github.com/R-Levin/myomaton-web/blob/b48b3cf3e0d03504c5d5d37457d17ae1def43d17/docs/shared-intelligent-onboarding-proposal-2026-11-10.md#offline-implementation-checkpoint). It tests whether model-generated follow-ups and draft assessment changes respond to business evidence. It does not finish the onboarding interview or establish owner-visible product acceptance. [Issue #10 preparation authorization](https://github.com/R-Levin/myomaton-web/issues/10#issuecomment-6773902908)

## Exact model and proposed cost

Use **`gpt-5.4-mini-2026-03-17`**, foreground Standard processing on `api.openai.com`, with strict Responses Structured Outputs and the snapshot's documented default reasoning setting. The official model page lists this dated snapshot and confirms Responses and Structured Outputs support. This is the newest suitable dated snapshot verified here within the existing rate ceilings. The newer GPT-5.5 dated snapshot lists US$30 per million output tokens, above the existing US$25 ceiling. The reviewed GPT-5.6 Terra and GPT-6.1 Terra pages list undated IDs. Project access to the proposed snapshot has not been verified. [GPT-5.4 Mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini) · [GPT-5.5](https://developers.openai.com/api/docs/models/gpt-5.5) · [GPT-5.6 Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra) · [GPT-6.1 Terra](https://developers.openai.com/api/docs/models/gpt-6.1-terra)

| Rate card `openai-gpt54mini-standard-usd/2026-11-10.1` | Bound |
| --- | --- |
| Published Standard price checked November 10 | US$0.75 input, US$0.075 cached input and US$4.50 output per million tokens. No cache discount assumed in reservation. Earlier-model caching has no separate write surcharge under the published rules. Reject an unexpected separately billed write category. |
| Each generation | 4,000 exact-counted input tokens and 1,200 output tokens including reasoning, at most **US$0.0084**. |
| One run | Seven generations and seven count requests maximum, **14 outbound requests** total, zero retries. At most **US$0.0588** across seven pairs at the published rates. |
| Token-count billing | **US$0.00 per request** for `POST /v1/responses/input_tokens`. OpenAI confirms that counting is free and does not consume normal inference quota. The local attestation uses `countMicros: 0`. [OpenAI Help Center](https://help.openai.com/en/articles/4936856-understanding-and-counting-tokens) |
| Aggregate application ceiling | **US$0.50** hard limit across all four traces, including pending reservations. A separate project limit, if available, is a secondary backstop. |

[Published model rates](https://developers.openai.com/api/docs/models/gpt-5.4-mini) · [Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching) · [Count endpoint](https://developers.openai.com/api/reference/resources/responses/subresources/input_tokens/methods/count) · [Project spend limits](https://developers.openai.com/api/docs/guides/spend-limits)

## Exact data proposed for transmission

The [review allowlist](shared-intelligent-onboarding-live-proof-allowlist-2026-11-10.json) defines the complete approved-for-review vocabulary of source text, source IDs, gap descriptions and synthetic answers. Its SHA-256 is `11d47ae88f1df63d4d6e70fbf1f694197bffa782c81b35c6e8e98eb90208457d`. The allowlist is a proposal and contains no credentials or private saved answers. Transmit only the selected trace's entry path, scoped gap, matching source entries and, on its second turn, the previously validated first question and its provenance plus that trace's synthetic answer. Only the current answer goes into that request. The preflight must enforce an exact projection before **both** endpoints. The rubric, alternate answers, full manifest, tenant/database identifiers, real contact and routing details, raw C0 answers, private Review text, cookies and credentials stay local. Request IDs, token usage and cost estimates are recorded locally. Publish only sanitized evidence and safe generated excerpts after review.

C0 discovery, website observations and the owner audience correction are distinct sources. Its October 14 historical interview and approved-undelivered assessment remain separate from the synthetic approved Review used to exercise the Review-led entry. Direct start uses no Review material. C2 has a separate disposable tenant, source projection, activation, resume token, draft and usage attribution. No actual C2 website or delivery is asserted. A shared ledger enforces the total budget without passing attribution hashes to the provider.

## Preflight after approval, before traffic

1. From the pinned implementation, review a narrow **transport and test-driver extension** to the existing engine. The checkpoint exposes an injected offline transport only. No live transport or launcher is included in this approval package. The extension must use the existing ActivationService, IntakeService, question validators and locked ledger. Keep it private to a disposable local run with an explicit one-run authorization. Bind that authorization to the reviewed code, manifest SHA, rate card, time window and limits. Confirm the preserved owner draft is outside the runner. Re-run the existing fixture and negative controls with a fake transport before opening the network path.
2. Verify the development project's actual model access, effective endpoint permissions, billing and retention in the provider console or documented account records. Require a verified, least-privilege development project credential for the two Responses endpoints. An existing credential can qualify. Use a protected local prompt or secret store and a temporary process environment only after this gate. Keep administrative and production keys out of the run. Confirm policy on training opt-in, abuse monitoring and prompt caching for this project. The proposal assumes minimized public/synthetic text and does not claim Zero Data Retention. Responses `store: false` limits application-state storage. Default abuse-monitoring logs may retain content for up to 30 days, subject to provider exceptions. No tools, files, streaming, background jobs, extended cache requests or provider conversation state. [Key controls](https://developers.openai.com/api/docs/guides/api-keys) · [Data controls](https://developers.openai.com/api/docs/guides/your-data)
3. Use the published generation prices and the verified zero count fee. Lock the application ledger before dispatch. Permit only TLS POSTs to the two exact paths on `api.openai.com`, with redirects and retries disabled. Count the same model, instructions, input and strict schema used for generation, then set `max_output_tokens: 1200`, `service_tier: "default"` and `store: false` on generation. Reject over-limit counts before generation. Record reserved spend before the count request and settle only from validated usage and reviewed rates. Keep the request cap at 14, including failed attempts. [Responses Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) · [Input token counting](https://developers.openai.com/api/docs/guides/token-counting) · [Spending controller guidance](https://developers.openai.com/cookbook/articles/per_run_spending_controller_responses_api)
4. Stop before sending if model access, retention, endpoint permissions, count pricing, source binding, budget or safe evidence projection cannot be verified. Stop the whole run on refusal, wrong model or tier, a timeout, missing or inconsistent usage, stale or foreign references, wrong-business language, schema failure, questionable provenance or misleading output. Preserve pending reservations and evidence. Do not substitute a model or auto-retry.

## Trace and semantic acceptance

| Trace | What reviewers should see |
| --- | --- |
| C0 buyer/proof, two Review-led alternatives | Generate one first question. Revalidate and replay its exact wording and cited evidence through the existing proposal validator in a second disposable C0 draft. Rebinding local turn IDs needs no outbound call. Save each different synthetic answer, then make a distinct live follow-up request for each. Compare the same initial question and evidence under both answers. With a dated artifact, expect a question about attribution or clearance and a reviewable planning example. Without evidence, expect a question about attainable proof or a baseline and an open claim. Neither permits publication. |
| C0 Ongoing, direct start | Generate one first question and a second question grounded in the supplied no-baseline answer. Expect a concrete next measurement or owner-responsibility question, and a change from a generic improvement plan to an explicit open dependency. No Review record is required. |
| Fictional C2, direct start | Generate one first question and one second-order question grounded in the limited weekday coverage answer. The draft should separate limited urgent coverage from routine estimates and retain missing fallback or verification. No C0 details, Review history, fabricated coverage or 24/7 promise. |

The existing generator instructions and strict schema go to the provider. The test driver supplies no scripted question, expected answer pattern or target wording. The initial question must address the actual business gap, avoid repeating known facts and cite permitted evidence. Each second question must use the prior answer, link its source and shift a concrete recommendation or readiness item. Different wording by itself fails. Reload should reproduce the exact persisted prompt, answer and assessment with no extra request. Record before/after readiness, question provenance, request/token totals and estimated charges. Owner and ChatGPT assess semantic relevance before any further acceptance or implementation decision.

Preparation verified the manifest hash, source references, trace isolation,
request arithmetic and absence of private input. All six focused offline
engine and ledger checks passed again. These checks used the existing fake
transport and do not establish live API behavior or model quality.

**Original preparation decision:** the snapshot, manifest, data policy and one capped execution were proposed subject to successful preflight. The owner's later authorization and implementation are recorded below.

## Authorized execution checkpoint

[Issue #10 owner authorization](https://github.com/R-Levin/myomaton-web/issues/10#issuecomment-6775948557) now authorizes this exact proof conditional on preflight. The aggregate development-phase ceiling is $5. The single approved proof still has the $0.50 application cap, seven generation and seven exact count requests, with zero retries. Remaining funds require a later reviewed scope.

**Historical result before the revised authorization · BLOCKED at no-call preflight.** OpenAI's Help Center resolved the count fee in [the Issue #10 review](https://github.com/R-Levin/myomaton-web/issues/10#issuecomment-6777356649). The immutable approved manifest still matches its pinned SHA-256. Its original count price fields describe the earlier preparation state. Use the verified zero rate in the existing local attestation.

The [acquisition CLI](../scripts/acquisition-pilot.ts) used the [OpenAI Images adapter](../lib/platform/acquisition/openai.ts), which reads `OPENAI_API_KEY` and defaults to `gpt-image-1.5`. Ignored iteration 2 and 3 generation receipts record OpenAI candidates and request IDs for that model. Neither receipt records an organization, project or key identifier. The current process value matches the Windows user environment and has project-key syntax. The ignored `.env.local` has no OpenAI settings and the proof worktree has no private preflight receipt. These checks establish the local loading convention and historical Images success. They do not identify the current key's OpenAI project, establish that it is the same key used historically, or verify its Responses access, billing or data controls.

The browser launcher failed before authenticated dashboard inspection. This earlier checkpoint sent no model request, count request or credential probe. See the live result below for the superseding execution evidence.

### Reuse the existing key if the project check passes

`MIOPAGES_OPENAI_DEV_API_KEY` is the runner's explicit, process-only input. It can carry the same verified value as the image pilot. The diagnostic's word “dedicated” describes that input and custody boundary. It does not require minting a separate key. The runner accepts the verified project's key only when its local SHA-256 matches the private attestation, then removes the key variables from its own environment. Keep that explicit input and the private attestation. A generic environment variable or a successful Images request cannot establish effective Responses permissions. OpenAI evaluates key permissions in conjunction with the project's role permissions, and its public model listing does not establish project or key access. [OpenAI permissions](https://developers.openai.com/api/docs/guides/rbac) · [OpenAI model access](https://developers.openai.com/api/docs/guides/rate-limits)

The [local runner](../scripts/intake/intelligent-live-proof.ts) shares the Activation and Intake fixture with the [original offline engine test](../tests/integration/intelligent-onboarding.test.ts). It verifies the unchanged manifest, projects each request from a scoped fixture, replays the exact first buyer question in a second draft and uses the existing metered Responses adapter with the tighter 14/7 limits. The local transport uses certificate-verified direct HTTPS, two fixed POST paths, bounded response bytes and no redirects or retries. The output screen, engine citation/answer validation and one-attempt marker fail closed. The [driver test](../tests/integration/intelligent-live-proof.test.ts) exercises all four traces through fake responses. Those responses and charges are simulated.

Nine focused checks passed, including all seven simulated pairs, exact shared count/generation payload, replay without a request, C2 isolation, rejection of foreign or added evidence, and refusal of an eighth generation or fifteenth request. The existing reservation and uncertain-charge tests also passed. The 388 application regressions, Next route type generation, TypeScript and targeted lint passed.

### Evidence needed before the one authorized run

1. The owner or project administrator opens the [API project settings](https://platform.openai.com/settings/organization/projects) and matches the existing local key to its development project and API Keys entry using the owner's protected credential record or the console's masked identifier. Verify the exact snapshot, effective permission for the two approved POST paths, available billing allowance, training/data sharing off, effective retention and default cache behavior. Confirm the key has remained protected and carries no production, admin or unrelated authority. Keep credential values and identifiers out of the Git handoff. If the key cannot be matched, stop before creating a receipt or sending an API request. The [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data) distinguish application state from abuse monitoring. The approved scope accepts default abuse-monitoring retention for this minimized proof where it is the verified project setting.
2. With actual evidence reviewed, prepare the local attestation under `runtime-content/openai-onboarding-proof/preflight.json` in the live-proof worktree, using a user-restricted ignored directory. Keep it out of Git. Use the reviewed commit, pinned manifest digest, project and organization IDs, SHA-256 of the selected verified key computed locally, and a UTC expiry at most two hours ahead. Include the following closed set of affirmative project checks and supporting references. A checked box or fabricated reference cannot establish any provider setting.

   | Field | Required value |
   | --- | --- |
   | `authorization`, `commit`, `manifestSha`, `rateCard` | Issue comment ID `6775948557`, full reviewed Git SHA, pinned manifest SHA-256, `openai-gpt54mini-standard-usd/2026-11-10.1` |
   | `project`, `organization`, `credentialSha256`, `validUntil` | Verified identifiers, selected key fingerprint and expiry |
   | `countMicros`, `countPriceEvidence` | `0` and the [OpenAI Help Center source](https://help.openai.com/en/articles/4936856-understanding-and-counting-tokens) |
   | `projectAccessEvidence`, `dataControlsEvidence` | Private references to independently verified project controls |
   | `verified` | An object with `pinnedModelEnabled`, `restrictedEndpoints`, `billingAndPhaseBudget`, `trainingOptInDisabled`, `retentionAndCachingReviewed`, `projectCredentialProtected` all set to true after actual verification |

3. In the isolated worktree, set `PG_BIN_DIR` to the local PostgreSQL tools and supply the verified key to the child as `MIOPAGES_OPENAI_DEV_API_KEY` through the protected local prompt or secret loader. If the existing process `OPENAI_API_KEY` was matched and verified in step 1, the local loader may pass that value to the proof process without re-entering or replacing it. Run `node --import tsx scripts/intake/intelligent-live-proof.ts --preflight` to check the local receipt without traffic. After PASS, `--execute` is the single authorized attempt. Preserve the ignored `attempt` directory on success or failure. Inspect the validated excerpts and usage ledger before committing a sanitized handoff.

### Next implementation gate

After a successful semantic proof, define one versioned, reviewable Presence Direction proposal from scoped interview evidence. It should carry source and confidence labels, audience and Offering priorities, proposed site structure and action hierarchy, page briefs, SEO/design/media guidance and explicit unresolved proof. Map its accepted pieces to the existing Core knowledge/proposal contracts and the [Issue #12 integration track](https://github.com/R-Levin/myomaton-web/issues/12). Test generation of a local multi-page candidate against the preserved v3 design and exact preview/review boundaries before extending native WordPress page, navigation, media and action materialization. This proposal carries no new authorization for API spend, source promotion, WordPress materialization or publication.

## Owner-authorized first-trace capability check

[Issue #10 owner direction](https://github.com/R-Levin/myomaton-web/issues/10#issuecomment-6778994149) supersedes the earlier account-evidence stop for one bounded live diagnostic. The owner reported that Default was the only project, one active key had All permissions, the model family appeared in project limits, pay-as-you-go billing was active, all three sharing settings were off, and Responses storage was selectable per request. Matching the locally configured key to that project and confirming dated snapshot access remain unverified. The authorized diagnostic tests effective access with the existing Windows process key. OpenAI resolves the project from that credential. The runner does not construct or transmit unverified project or organization identifiers.

From the clean reviewed worktree, use the existing CLI with `--preflight --owner-diagnostic`. This is local-only. Then use `--execute --owner-diagnostic` once if preflight passes. This explicit mode uses the inherited `OPENAI_API_KEY` without changing the Windows setting or the prior receipt-based mode. Both execution modes share the exclusive ignored attempt directory. The diagnostic is the first C0 buyer question. The runner must count its exact input and validate the returned generation before it can proceed. The successful question is retained in the proof and replayed locally for the alternative answer. There is no separate diagnostic question or extra request pair.

The pinned manifest, dated model, strict schema, TLS-only host, 4,000 input and 1,200 output token ceilings, generation `store:false`, seven generations, seven free counts, zero retries and $0.50 application cap all apply. Stop on the first refusal. Report only the endpoint, HTTP status and safe API error fields. Preserve the usage ledger and any reservation that could not be settled. This mode grants no authority over other model workloads or provider settings.

### Live result · provider accepted, proof stopped before first question

The explicit no-call preflight passed at execution commit
`3fceffd168013770d41b20c765af58fba25df5d2`. Eleven focused checks passed
before execution, including the synthetic first-generation refusal and
14-request ceiling. TypeScript and targeted lint passed. The final
five-check rerun passed after adding the first-question checkpoint.

The exclusive live attempt sent one exact count and one generation.
Both reached the transport's HTTP 200 success path. The ledger confirms
the requested dated model and service tier, validated usage, and a decoded
structured output. There was no HTTP API error receipt. This establishes
effective access for the configured key to both calls for this diagnostic.
It does not independently identify the project or confirm its settings.

| Observed usage | Value |
| --- | --- |
| Requests | 1 free input count, 1 generation, 0 retries |
| Generation tokens | 695 input, 275 output, 0 cached or reasoning tokens |
| Local reservation | US$0.008400 |
| Usage-priced estimate | **US$0.001759** at the published rates. The dashboard charge was outside this check. |

The process exited with `Proof refused or interrupted` after the ledger
settled. It did not write the first validated question or a trace receipt.
The retained evidence locates the stop between provider acceptance and
persisting the first validated question. It does not distinguish an engine
validation failure, another local refusal, or a persistence failure. The
runner kept no raw generated text. The other traces did not run, so there
are no verified question excerpts or answer-dependent assessments to review.
The original one-shot attempt and its usage evidence are preserved. The later
development policy permits fresh, separately recorded attempts under the phase
budget.

## Controlled development iterations

[Development policy at `f2ad4b2`](development-control.md#development-velocity-proportional-safeguards-and-completion-hardening)
and [Issue #10](https://github.com/R-Levin/myomaton-web/issues/10#issuecomment-6779329635)
authorize deliberate synthetic attempts within $5 aggregate and $0.50 per run.
The original `attempt` remains intact. Start each later attempt explicitly
from a clean reviewed checkout with `--execute --owner-diagnostic attempt-02`
or the next unused numbered directory. There are zero automatic retries.
The phase lock prevents overlapping runs. Existing settled costs and unresolved
reservations are counted before admitting another run.

The original response was discarded, so its exact local refusal cannot be
reconstructed. Offline tests reproduced a contract mismatch. The old provider
schema could return an assessment before an answer, foreign citations or
unbounded text even though the local validator rejects those. The proof schema
now distinguishes initial and follow-up turns, narrows citation choices to
the supplied sources and answer reference, and requests concise one-line
text. The first assessment must be null. Existing semantic checks stay in
place. Safe diagnostics distinguish provider failure, proposal validation,
draft persistence, output screening and evidence write. They retain no
rejected model text. [Structured Outputs constraints](https://developers.openai.com/api/docs/guides/structured-outputs)

The first corrected run, `attempt-02` at `96fe3e9bc98b4f366b15638bee473be3843ba073`,
saved all four live traces using seven free counts and seven generations.
It used 4,576 input and 972 output tokens, for a ledger estimate of
$0.007809. The two buyer traces produced different recommendations and evidence
needs from the same first question. Both remained open for evidence. The
Ongoing and C2 assessments contained clipped phrases near the schema length
limits. This run established local saving and answer dependence, with output
quality still incomplete. Preserve it as evidence. The next iteration asks
for shorter complete sentences, gives them more schema headroom, and refuses
incomplete or invisible-control-laden assessment text before saving evidence.

### Functional result · four live traces saved and reviewed

`attempt-03` ran at `a9e303a87c588180d1a4e4e0907167337003c6df`. All four
traces persisted and read back through the existing onboarding engine.
The same C0 buyer question was used in both scenarios. The second copy was a
validated local replay without a provider call. All follow-ups cited the
synthetic answer and at least one allowed source. The fictional C2 response
used only its own source and answer.

**C0 buyer proof, shared first question:** “What one concrete proof, such as
a before-and-after example or client quote, shows Launch and Ongoing are
not old hosting?”

| Synthetic trace | Actual generated follow-up | Actual assessment and material change |
| --- | --- | --- |
| C0 buyer A · Dated internal comparison available | “Which specific proof can be reviewed now to distinguish Launch and Ongoing from the old hosting offer, and what is still withheld?” | “Review the dated comparison internally first, then decide whether any portion can support buyer proof.” A shareable artifact or a clear statement that none is cleared remained necessary. |
| C0 buyer B · No dated comparison, permission or outcomes | “What specific customer evidence could later show Launch and Ongoing changed an actual site, not just our intended process?” | “Review can proceed on process description only, while buyer-proof remains unverified until a dated customer example or permission exists.” The recommendation shifts from inspecting evidence in hand to limiting copy to process and collecting support. Publication clearance remains a separate decision. |
| C0 Ongoing · No baseline or assigned reviewer | “What first Ongoing improvement should the team review now, and which owner decision or evidence will support it?” | “Review response tracking first if no owner decision exists yet.” The draft asks for a decision naming the first improvement and its evidence source. Its first question was “What single ongoing improvement should MioPages support first, and who approves it?” |
| Fictional C2 · Weekday urgent calls in the northern area | “What exact contact route should route routine estimates, given urgent calls use weekdays in the northern service area?” | “Review the routine estimate contact path now, because urgent coverage boundaries are partly defined.” The draft asks for the missing routine estimate route. Its first question was “What exact phone number or contact route handles urgent tree work, separate from routine estimates, on this site?” No number or real contact was supplied. |

Each readiness badge stayed **open**. The changed evidence and recommended
work are visible even though neither answer authorizes readiness or publication.
The two buyer scenarios are the clearest demonstration of material adaptation.
The Ongoing question is comparatively generic. The C2 assessment leaves the
after-hours voicemail or fallback unresolved. Before product acceptance, review
whether both follow-ups ask the most useful next question, and tighten the
distinction between finding proof and having permission to publish it.

| Phase attempt | Free counts | Generations | Input tokens | Output tokens | Usage-priced estimate |
| --- | ---: | ---: | ---: | ---: | ---: |
| Original `attempt` | 1 | 1 | 695 | 275 | $0.001759 |
| `attempt-02` | 7 | 7 | 4,576 | 972 | $0.007809 |
| `attempt-03` | 7 | 7 | 4,821 | 833 | $0.007367 |
| **Total** | **15** | **15** | **10,092** | **2,080** | **$0.016935** |

Costs sum the settled per-request ledger estimates, rounded up to micro-USD.
No retries, cached tokens, reasoning tokens or unresolved reservations were
recorded. The provider dashboard charge was outside the run. Fourteen focused
tests, TypeScript and targeted lint passed on the final implementation.
The pinned manifest and previous attempt evidence were preserved. No private
C0 evidence or hosted customer state was used.

This is functional synthetic proof. Onboarding remains in development. The
next product slice is to show the real question, answer and changed finding in
the Core interview UI, then carry reviewed findings into a versioned Presence
Direction and the existing multi-page Core proposal path for private WordPress
review. Formal hardening and owner acceptance precede production or publication.

## Research-first demonstration

This bounded comparison adds an observed market packet before the shared
interview. The [question rubric](paid-onboarding-knowledge-transfer-contract.md#research-first-demonstration-and-question-rubric)
and [local runner](../scripts/intake/research-first.ts) preserve the distinction
between observations, provisional ratings and confirmed facts. The provider
gets attributed summaries and synthetic replies. Source URLs stay local in
the reviewed packet. The existing runner uses `--execute --owner-diagnostic
attempt-04 --research` for the first dedicated research run under the same
phase budget. Reproduction requires a fresh attempt directory. Each case has
its own disposable tenant. The demo discovers and ranks two or three
questions, saves the highest-ranked one, then saves and reads back the
model's response to one synthetic answer. The alternate answers shown in the
review are decision forecasts.

| Case and search intent | Prior knowledge and public observations | What is still uncertain |
| --- | --- | --- |
| C0 · “managed website ongoing edits scope” | The owner confirmed Launch and Ongoing for startups and established businesses. The public Home still separates old services. Pronto distinguishes editorial/site management from search work. UK provider PresGro distinguishes refresh from rebuild and exposes setup and recurring charges. [C0 Home](https://miopages.com/) · [Pronto](https://www.prontomarketing.com/website-management-services/) · [PresGro](https://www.presgro.com/managed-websites) | What the owner can promise and approve for a routine change, where a prospect needs to qualify scope, which example is cleared, and whether the message will convert. |
| Fictional C2 · “storm damage tree service after hours” and “written tree estimate insurance” | The scenario gives weekday urgent calls in a northern area, possible voicemail and a separate estimate process. An Illinois comparator advertises urgent calling and routine estimate intake separately. A Washington utility illustrates why responsibility depends on local line and location. Consumer guidance raises legitimacy, written scope and price questions. [Acorn](https://acorn-tree.com/contact) · [Snohomish PUD](https://www.snopud.com/outages-safety/prevention/tree-trimming/) · [FTC](https://consumer.ftc.gov/articles/how-avoid-scams-after-weather-emergencies-and-natural-disasters) | The real fallback or referral, staffed hours and territory, insurance proof, and what a quote includes. No comparator's availability or utility guidance applies to C2 by default. |
| Hypothetical mobile bicycle repair startup · “mobile bike repair visit minimum,” “can you fix my e-bike” and “repair estimate dispute” | The founder scenario has one mechanic and no track record. velofix qualifies service by postal code and separates mechanical work from electrical diagnosis. Ben's example distinguishes a labor minimum and parts and states e-bike exclusions. One disputed in-shop repair account illustrates possible confusion around approval of charges. [velofix](https://www.velofix.com/what-we-do/faq/) · [Ben's](https://bensmobilebikerepair.com/) · [BBB complaint and response](https://www.bbb.org/us/ks/wichita/profile/sporting-goods-retail/bicycle-x-change-shops-0714-65095/complaints) | Which trips are viable, eligibility, quote approval, minimum and real customer demand. The complaint is neither a verified finding of fault nor a frequency measure. |

These are small search-discovered samples. Ranking, paid placement, local
demand and commercial performance were outside the sample. Comparator prices
or practices may prompt a question, but they cannot set the prospect's price
or prove a customer outcome.

The first research attempt stopped at local gap validation after one generation.
The second persisted all three cases after the schema required an explicit market
citation for each candidate. Review caught a material issue in that run. It
treated retired C0 offers as an option and suggested broadening C2's urgent
route beyond known coverage. The next iteration explicitly carried forward
the owner-approved retirement decision, told the model to keep verified
coverage fixed in both branches, and asked it to establish how the business
operates before proposing a page or visitor action.

### Original direction for the bicycle pilot

**Proposed headline:** “Check the visit before we set a time.”

**Proposed supporting copy:** “Tell us your postal code, the kind of bike you
ride, and what needs fixing. We'll check whether the job fits our route and
explain the visit cost before you choose a time.”

This concept comes from the fictional founder's one-mechanic route and quote
approval process, informed by the observed market questions about coverage,
eligible work and charges. The proposed action is a request to check a visit.
The page would explain mechanical scope, then show the request and the
confirmation step. Price, territory and service claims stay pending until
confirmed. I compared the copy and proposed flow with the sampled providers
for obvious similarities. The draft uses its own wording and organization,
and contains no competitor prices, reviews, artwork, or distinctive design.
Before any content approval, repeat that check on the actual rendered draft
and verify rights on anything supplied for use.

### Live research and interview results

The existing engine saved and read back all three research-led interviews in
`attempt-07` at `f14313f2`. The focused C0 retest in `attempt-08` at
`346a0e4` added the provisional Launch scope from the business brief. The
table uses the best reviewable result for each case. Each live follow-up used
one synthetic answer. Alternatives below are reviewer interpretations of
what a different answer would change.

| Case | New question and why it matters | Live follow-up and finding | What different answers change |
| --- | --- | --- | --- |
| C0 | “For Launch, what is the maximum included build or migration scope you want the website to promise?” The comparator's explicit scope limits made the implementation boundary a better question than generic buyer proof. Other candidates surfaced support commitments and customer approvals. | “Should Launch include one existing site update or just one new site build or migration, and what needs separate scope approval?” The model held readiness open and asked for limits, but carried a synthetic Ongoing update into Launch. Discard that part of the recommendation. The supplied answer confirms a possible Ongoing workflow within the fixture and leaves Launch scope unanswered. | If typical migrations and new sites fit the supported Launch scope, explain both under one Service page with clear boundaries. If complex migrations need separate scoping, give prospects a scope conversation before promising delivery. Show customer sign-off in a separate Ongoing workflow example. |
| Fictional C2 | “What specific tree problems should the urgent phone route accept as serviceable versus redirect?” A second candidate asked what happens when nobody answers. The distinction matters because a visible phone button can imply a staffed, capable service. | “Which urgent tree jobs in the northern service area are eligible during weekday coverage, excluding power-line hazards?” It called for a review of the urgent script and a verified fallback owner. The fictional answer ruled out power-line work and confirmed no one monitors urgent voicemail after hours. | Verified job categories and coverage support a clearly scoped weekday call path. With no staffed fallback, hold the after-hours urgent action. Keep routine estimates separate, state what an estimate covers after confirmation, and verify any insurance or qualification proof before displaying it. Reject generated branches that treat voicemail as an urgent fallback. |
| Hypothetical bicycle startup | “Which exact areas can you reliably cover for bookings with one mechanic?” The other candidates asked about minimum charge and bike eligibility. Together these affect capacity, quote disputes and the scope of a first visit. | “Which postal codes or neighborhoods are included in the first-month compact route, and which are excluded?” The model called for a verified pilot map. The synthetic answer supports mechanical work, manual confirmation and a quote first. It leaves the minimum and actual territory open. | If the founder confirms a compact area, show the areas and qualify each request before quoting. If the boundary is still changing, ask for location and confirm manually without implying a booking. Ask next which mechanical jobs fit a first visit and when a customer would need a different provider. |

All readiness states stayed **open**. Compared with the fixed-gap proof, the
research made the C0 question about a service promise, the C2 question about
the actual conditions for urgent routing, and the startup question about a
launch constraint that changes the main action. The earlier engine proof
showed answer sensitivity once a gap was supplied. This demo shows the model
can discover a useful gap from observations and a small set of facts. It also
shows that more context does not guarantee correct ranking or phase attribution.
The C0 filter screens known phrasing, and the reviewer still checks meaning.
For a real interview, answer relevance needs an explicit review rule before
any assessment is promoted, and consequential service or safety claims need
the existing confirmation and approval checks.

The demo used manually sampled public pages and live model reasoning. Ten
focused regression tests passed, including the scoped interview and budget
checks. The final two research tests, TypeScript and targeted lint also
passed after the focused C0 change. This research work used **21 generations
and 21 free counts**, 15,552 input and 7,341 output tokens, for a usage-priced
ledger estimate of **$0.044704**. The full Issue #10 phase estimate is
**$0.061639**. No unresolved reservations were recorded. The ledger estimates
use published rates. Dashboard charges were outside this check.

Owner review should focus on whether the selected questions change a real
site decision, whether the system respects previously settled facts, and
whether a partial answer is recognized. Broader Core integration, automatic
research, and production approval remain outside this demonstration.

## Scoped answer review

The owner retained all three scenarios in Issue #10 comment `6783175966`.
The defect was carrying an Ongoing reply into a Launch recommendation. The
existing interview engine now saves a scoped review with the topic, an exact
excerpt, and the unresolved part of the question. Only a direct answer can
produce a planning recommendation for that gap. Partial, off-topic, and
uncertain replies keep it open and require a clarification. The review is
an AI interpretation of a saved answer and grants no approval authority.

The final live run replayed the prior business-specific questions. It used
the same public research summaries and separately seeded synthetic drafts.
The engine read each result back from disposable PostgreSQL.

| Case | What the reply covered | Saved result |
| --- | --- | --- |
| C0 · Ongoing | Changes to an existing client's services and owner sign-off | **Open.** The model identified Ongoing and asked “What is the maximum included Launch build or migration scope, if any, that should be promised?” No Launch recommendation was saved. |
| C0 · Launch | Five core pages, approved copy from up to three existing pages, and separately scoped redirects, integrations and larger migrations | **Planning review.** The recommendation reflects those limits and the model asked no further question on this gap. These are synthetic terms. |
| Fictional C2 · tree service | No after-hours urgent voicemail coverage and no suspected power-line jobs | **Open.** “Which tree jobs are eligible for the urgent route and which need a verified fallback?” The synthetic restrictions remain in place. |
| Hypothetical startup · bicycle repair | Small mechanical pilot with manual confirmation and a quote before scheduling | **Open.** “Which exact territory is covered in the first month for one mechanic?” No locations or public minimum were inferred. |

Attempts 09 and 10 kept the Ongoing case open but misclassified its topic and
refused the direct C0 turn during validation. Exact excerpt constraints and
a single answer-review instruction resolved the conflict. Attempt 11 saved
all four turns. The generated explanations sometimes contain awkward or
unfinished phrasing and the C0 clarification stays close to the original
question. This quality gap is visible in the local review.

The final run used four generations and four free token counts, with 3,532
input and 824 output tokens. Its estimate is $0.006358. Including the two
prior attempts, this correction used eight generations, eight counts, 7,996
input tokens and 1,483 output tokens, estimated at $0.012673. Phase usage
through this checkpoint is 44 generations and 44 counts, estimated at
**$0.074312**. The $0.50 per-run cap and $5 aggregate cap remained in force.
There were zero automatic retries. Private evidence and credentials stay
outside Git.

From the local proof worktree with its existing `attempt-11` receipts, run
`node --import tsx scripts/operator-overview.ts --onboarding-review attempt-11`.
Open [Onboarding interview proof](http://127.0.0.1:4322/development-evidence/onboarding).
This GET-only view uses the existing local Operator shell and reads saved
proof evidence. It makes no provider calls and has no answer editor. The
next step is to expose the same scoped review in a disposable Core customer
interview after saving an answer through either existing entry path.
