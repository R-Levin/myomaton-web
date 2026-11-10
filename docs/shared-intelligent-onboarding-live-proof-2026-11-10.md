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
