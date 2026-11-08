# Commercial V1 becoming-a-customer journey and full onboarding interview

**Status: Working implementation specification for C0 rehearsal, 2026-11-08.** The owner directed that the **complete “I'm becoming a client” process**, including the **full paid onboarding questionnaire**, be the first development step before rebuilding the C0 WordPress site. This document translates existing approved journey and intake decisions into an **initial testable question design**, not final sales terms, a deployed questionnaire, a new source of canonical customer truth or a production authorization. Exact wording, requiredness and effort must be refined by realistic testing.

## Governing principles

- **One progressive interview, not two conflicting forms.** Reuse and extend `lib/platform/intake/model.ts` and the versioned/resumable intake foundation. The existing `foundational-intake/2` (the twelve-screen early intake with primary vs secondary Action) and the older version-1 historical Review packet remain intact. Do not repurpose the October 14 Review submission as the original October 5–6 C0 interview.
- **Normal order:** Free Review or direct start → same foundational knowledge → fit/Launch scope → commercial agreement/commitment verification → **full paid onboarding interview** → customer confirmation of business understanding → one Presence Direction/Home concept → customer acceptance of direction → Core-generated WordPress site. A customer who selects assisted start uses the same information/authority model with Operator help.
- **No retyping answers.** Prefill known values, show source/freshness/confirmation, and ask only for missing or materially changed information. Unknown, inferred, externally observed, old and customer-confirmed values are visibly distinct. A previously approved business brief is *not* a verbatim questionnaire; individual recoverable interview prompts/answers require evidence-based mapping. See `docs/c0-discovery-question-recovery-audit.md`.
- **Conversation beats paperwork.** Group questions into understandable steps; display a compact progress indicator, optional “I don't know yet” responses and save/resume. Do not force prospects to write a sitemap, create content, choose a WordPress theme, specify CSS or become a webmaster. Provide contextual operator help. Don't make every optional answer required or require every question in the initial screen.
- **Requirements depend on what will be built.** Conditional follow-ups are based on the chosen primary conversion path, service/product type, geography, business obligations and integration needs. Ask only if the answer will change core content, design, conversion, trust, privacy or Launch readiness. Capture source and consent/authority; do not request credentials in ordinary text fields.
- **Sufficient-to-build, not exhaustive.** The interview is complete when material facts can be confirmed and the platform can propose a near-finished site with explicitly tracked gaps. A missing nonessential item should not block the entire customer journey.

## Entry: beginning a paid MioPages service

**A. Know what we're starting with.** Show existing business name/URL, chosen goal and context from the Review/direct-start record. Let the customer correct the facts; do not quietly change the originating submission. C0 uses the October 5–6 approved three-pass discovery as a preserved, attributable prior source. If no previous intake exists, obtain only missing foundational fields using the existing question model.

**B. Confirm fit and supported scope.** Plain-language summary of what MioPages proposes to manage, key Pages/Actions needed, known operational constraints, Standard vs possible Expanded Launch and notable exclusions. Material complexity is referred for operator scope review; don't auto-sell unsupported work. Customer understands that this is managed service, not unlimited design or dedicated immediate-response account management.

**C. Commercial gate.** Present the proposed Launch/Ongoing scope, fee treatment, agreement and practical service boundaries, and secure authorized acceptance/commitment through the eventual verified payment/billing method before paid production work begins. Current $1,250/$225×6/$249 planning figures in the commercial contract are **not yet approved public/contractual terms**. The C0 exercise may use an explicit **rehearsal-only commercially-authorized surrogate** with no fake invoice/payment, never to satisfy production P26. Do not activate a live payment or imply customer identity from a clicked link.

## Full onboarding: provisional customer-facing question groups

This is the **starting question bank** for the next implementation iteration. Reuse actual baseline answers by stable keys; conditional prompts appear only if needed. The customer should see normal conversational language, not the table of backend fields.

| Step | Main customer question / prompt | Why it matters / follow-up rule |
| --- | --- | --- |
| **1. Your business** | “Is this an accurate description of your business and what you do?” Show the current synthesized summary, business name, primary contact, geographic presence and existing public web profiles; allow correction. | Source-backed identity and factual confirmation, not a long repeated introduction. Ask for public display name, service geography, locations and legally required business identifiers only when applicable. Confirm the authorized primary reviewer and ordinary correspondence contact separately from public site contact details. |
| **2. What you provide** | “Which services or products should customers learn about first?” | Confirm core offerings, their relative priority and customer-relevant outcomes. For multiple offerings, capture a concise structured listing with optional short details; deeper follow-up about eligibility, constraints, service area, pricing or availability only where needed to make accurate claims. No giant catalogs or ecommerce promise. |
| **3. Who you want to reach** | “Who are the customers you most want to attract, and what are they trying to accomplish?” | Reuse existing `audience`, `goals`, `difference`, `problem`; ask for target segments, common needs and credible distinctions only when these materially affect positioning, conversion or site pages. Support “not sure”; don't generate invented differentiators. |
| **4. How people should contact you** | “What is the most important next step you want an interested visitor to take?” | Reuse the **primary** and optional secondary Action answers from intake v2. Confirm correct public phone/email/contact destination, responsible recipient, service hours/response expectations if stated, and special quote/booking/contact requirements. Any form, booking/CRM/email routing must later be actually configured and tested; no credential collection in questionnaire text. |
| **5. Where and how you operate** | “Where do you serve customers, and is there anything people should know before contacting you?” | Reuse `serviceArea` and `locations`. Conditional location/hours/coverage/qualification, regulated or urgent-service limitations, business-seasonality or fulfillment constraints. Avoid unnecessarily collecting addresses when a remote business has none to publish. |
| **6. Credibility and materials** | “What should visitors see that helps them trust your business?” | Ask which real experience, credentials, testimonials, project examples, results, business photographs, logo/brand files or existing materials are available. Allow optional uploads/references later, track ownership, provenance and permission; not all proof must be provided on first pass. Never invent customer quotes, rights or claims. |
| **7. Existing presence and preferences** | “What should we keep, change or avoid from your existing website or branding?” | Confirm relevant pages/URLs, current content worth retaining, existing brand assets, strong dislikes and desired tone. Ask about necessary redirects, blogs, established domain/hosting and any essential third-party integrations only when relevant. **MioPages recommends** navigation, themes, layouts, typography, colors and site Sections; the customer reviews a proposed direction instead of building a design specification. |
| **8. Operational needs and handoff** | “Are there other systems, people or requirements we need to account for before launch?” | Capture named domain/DNS/email responsibility; integrations/booking/CRM/forms and any owner-managed accounts; content/contact approver, desired initial launch timing/constraints and mandatory compliance/privacy needs. Do not request passwords, payment cards or private admin tokens in these fields. Secure account/access verification comes later only when necessary. |
| **9. How we'll work together** | “Here is how MioPages will manage routine updates. Does this approach work for you?” | Present a short recommended package of scoped standing approval preferences (low-risk technical/form and verified minor fact changes); allow adjustment, withdrawal and explicit acceptance, separate from legal agreement and content approval. Explain how to request help by email and what typical response/scope boundaries mean. Do not treat default toggles as unlimited authorization. |
| **10. Anything important missing?** | “Is there anything else we should understand before proposing your site?” | Optional free-form addition. Follow up only on remaining meaningful contradictions or gaps and give a clear handoff to the synthesized understanding rather than demanding completion of every possible question. |

### Important conditional branches

- New business with no website: skip existing-site problems, migrations and redirects; ask only about initial brand/contact/service setup.
- Several locations: ask about location-specific services, contact destinations, pages and hours only when applicable.
- Service request/booking intent: verify intended real booking/quote workflow; don't assert calendar integration before testing.
- Existing blog/content library: ask which content can be reused, retained or redirected; ordinary blog uses a consistent WordPress article template and featured image.
- Products/services: capture structured list/detail information without assuming ecommerce or a huge catalog.
- Regulated, urgent or unusually sensitive business claims: ask for required limitations, authorized review and proof, and route exceptional policy questions.
- Media and proof: rights and intended display scope must be independently confirmed; files and links do not automatically grant publication rights.
- Special integrations, unusual migration or atypical catalog/site complexity: escalate supported-scope assessment before promising work; never silently expand the contract.

## Confirmation and build basis

After the questionnaire, prepare **“Here is what we understand about your business.”** Show concise factual knowledge first, with evidence/source accessible by expansion and a conversational way to raise an uncertain or broad concern. **Checkpoint 1:** customer/authorized representative confirms or corrects material business truth; version/actor/time and gaps are retained. AI inference remains proposed, not automatically confirmed.

Then generate **one Presence Direction**: principal audience, offerings, primary conversion, recommended Pages and navigation, design/tone/style guidance, proof/media needs, SEO/content priorities, required features and important exclusions, accompanied by a **single representative Home concept**. **Checkpoint 2:** customer accepts or requests changes to that direction. This does not constitute approval of every finished page, public claims or deployment.

Only then generate the initial WordPress site through the controlled plugin/theme, keeping the Core-owned structure/design/content and separately approved local edits reconcilable. The **complete actual WordPress-rendered site** receives later checkpoint-3 customer approval, operational readiness verification and a separate governed launch. Ongoing material changes use checkpoint 4 and the customer's approved standing preferences.

## Implementation sequence and proof

**First Codex implementation slice for Issue #9:** inspect actual shared intake/resume, activation/commitment foundations, confirmed knowledge and customer/Operator UI; source-audit recovered C0 interview Q&A; implement a **real, isolated, versioned/resumable full-onboarding questionnaire continuation** that reuses early C0 knowledge, conditionally asks for missing material inputs, records author/source/authority and can produce a saved, reviewable business-understanding candidate. Include a faithful **customer-facing entry/summary** of the commercial gate with explicit rehearsal-only status if the real agreement/payment mechanism is not ready. Do not wire a fake accepted payment. Demonstrate an actual answer edit + saved/resumed state + stale-revision refusal and scoped access; no mocked completion badge.

**Next slices:** knowledge confirmation/Checkpoint 1; one Presence Direction/Checkpoint 2; Core-to-WordPress private generation; WordPress refinement round-trip and preservation; complete-site customer preview; readiness and authorized launch. Prioritize proof of normal client actions, clear screens and limited customer burden rather than writing a huge static questionnaire or duplicating a form engine.

**Success criteria:** A customer who already submitted a Review or direct-start intake sees known information prefilled; answers only genuinely new questions, can stop/resume, can ask for assistance, can correct facts without overwriting historical evidence, and reaches an evidence-backed reviewable knowledge summary with explicit next action. An Operator sees what is confirmed vs unresolved and how the initial site can be generated. Exact tests, duration, UI links and observed limitations are documented in Git. All existing C0/hosted public WordPress data and publication gates remain protected.

## Source contracts

- [Progressive onboarding, commercial gate and full interview](progressive-onboarding-and-launch-readiness.md#full-structured-commercial-v1-interview)
- [Four approval checkpoints](customer-journey-and-change-management.md#four-approval-checkpoints)
- [Original interview recovery](c0-discovery-question-recovery-audit.md)
- [C0 complete WordPress rebuild exercise](c0-onboarding-wordpress-rebuild-rehearsal.md)
- [Existing foundational intake source](../lib/platform/intake/model.ts)
- [Service scope and customer standing-authorization principles](service-operations-model.md)
- [Development implementation control](development-control.md)
