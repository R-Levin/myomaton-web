# C0 real-world onboarding and WordPress rebuild rehearsal

Status: **Owner-approved development direction, 2026-11-08. Execution not yet implemented.** This is a bounded, interface-led proving plan, not authorization to publish, migrate live content, write hosted canonical records, or bypass release/approval gates.

## Goal

Run MioPages as if it is a real new managed-presence customer, starting from its **authentic already-completed initial three-pass interview/discovery**, and build a **new managed WordPress site from scratch** through the intended customer, Operator, Core and WordPress interactions. Learn from actual friction and manual effort rather than continuing to review only a read-only showcase console.

Use the existing MioPages business as the customer. Preserve all accepted historic C0 work as a comparison and provenance reference. **Do not restart the interview or rewrite the prior C0 canonical state.** The new rehearsal is a separate, explicitly identified customer-onboarding/build run, not a secret mutation of the accepted service-led v3.

## Starting source, provenance and limits

- `docs/miopages-c0-business-brief.md` is the **approved provisional C0 three-pass discovery synthesis**, marked READY FOR IA / CONTENT MODEL. Treat it as authentic customer discovery evidence, not an invented or developer-supplied fixture. It is not final marketing copy, final commercial terms or publication approval.
- The original three-pass discovery **is partially recoverable**: prior October 5 conversation context yields some exact question prompts and responses, and preserved first-/second-pass syntheses include explicit follow-up question lists. A **complete verbatim, source-audited transcript has not yet been verified**. See [the question recovery audit](c0-discovery-question-recovery-audit.md). Do not invent missing responses or confuse the October 14 Free Review Q&A with the earlier discovery. The interface should distinguish **recovered original Q&A**, **synthesis-only follow-up questions**, the **approved interview/discovery summary**, and **new customer responses**, with provenance attached to each.
- `docs/miopages-c0-canonical-state.md`, `docs/miopages-canonical-promotion.md`, approved service-led v3 previews and existing C0 runtime state remain references, **not automatic inputs to the new initial build**. A baseline comparison may explain improvements, but the new design should emerge from the approved interview knowledge and normal system recommendations and approvals.
- Reuse the same existing progressive onboarding, knowledge/proposal, content authority, site model and WordPress adapter concepts. Do not construct a parallel C0-only system. The normal rules for confirmed vs inferred vs unresolved facts, sourcing, approval and requested corrections apply.
- This is a **direct-start/onboarding exercise**: a previous optional Free Review must not be retroactively asserted, and the initial interview should not be repeated solely to drive a UI.

## Workflow to exercise

1. **Open the C0 rehearsal as a new onboarding run.** In the normal MioPages customer/Operator experience, show the available approved discovery summary and where it came from. Offer focused corrections, new information and genuinely consequential unanswered questions only. Capture actual changes as identifiable new evidence; don't silently promote synthesis into a fake verbatim transcript. Record account/service status and role permissions. Avoid flooding the Operator with forms.
2. **Confirm business knowledge and make one Presence Direction.** Show confirmed business information first, expandable provenance and focused discussions. Generate a concise recommended business/site direction (audience, offering, navigation/pages, conversion, content, styling/media intent) and a Home concept, then obtain applicable human/customer approval. Missing media/claims remain visibly unresolved; no invented proof.
3. **Generate the first site from Core into private WordPress.** Core retains authoritative proposed design, pages/sections, navigation, content, SEO, initial theme/fonts/layout/spacing, media choices and approved release identity. Use **one supported controlled block theme** with native Gutenberg/Appearance facilities; the MioPages plugin translates the approved staged specification into WordPress pages, sections/blocks, templates and styling. Inspect the actual rendered site. Reuse the existing experimental plugin/release proof instead of rebuilding a second integration stack. Do not claim private preview-only tooling already performs full generation.
4. **Review and refine in WordPress.** Authorized Operators use actual WordPress frontend/Gutenberg and Appearance tools, with convenient links back to role-aware MioPages review. Supported content/design/CSS edits and creation of a new page/section are automatically observed and recorded as scoped, versioned Core proposals. Verify at least one edit can be returned, accepted, and preserved on a subsequent update. The plugin must not interpret every arbitrary theme/plugin edit as structurally understood. Flag unsupported or unverified divergence.
5. **Review the complete proposed site as the customer.** Include meaningful navigation, key pages, responsive behavior, media/provenance, a representative blog post and safely demonstrable form behavior. In MioPages (not WP Admin), present simple Approve / Request Changes with comments tied to a specific actual rendered preview/version. Follow the approval/checkpoint rules; avoid isolated per-page signoffs as default.
6. **Prove readiness and handoff without a surprise production release.** Show exception-first readiness and a readily available complete report; distinguish Ready for Customer Review, Customer Approved, Ready for Launch and verified Live. Stage launch sequencing/communications as a rehearsal; real DNS, public publication, mail delivery, domain cutover, production contact handling or activation require their separate actual approvals and verified operational gates. Test the beginning of Ongoing: communications, baseline reporting, simple change request, prioritization and authorized follow-up.

## First development milestone: full becoming-a-customer questionnaire

**Owner-updated priority, November 8, 2026; supersedes the narrower
interview-summary-only first slice below.** The first experience
to build and test is the real **Start with MioPages → fit/scope →
verified commercial commitment → complete progressive paid-onboarding
questionnaire** flow. This is the full “I'm becoming a client”
journey, not a standalone form and not another static interview
timeline. Reuse the existing foundational-intake v2 and the
authentic first C0 discovery evidence; verify recoverable original
questions/answers before prefill, distinguish synthesis from
verbatim source and ask only significant missing facts. The new
paid questionnaire must be conditional, versioned/resumable, linked
to source and ownership and have a clear customer/Operator
handoff into confirmation of business understanding. The currently
unresolved commercial/payment gate can only be exercised as an
explicit **rehearsal surrogate**, never represented as paid/verified
production activation.

Use [the detailed questionnaire and customer-journey specification](commercial-v1-full-onboarding-questionnaire.md)
for provisional customer-facing questions, branches, records, UI
principles, acceptance checks and the first implementation task.
Once the full interview/resume is genuinely working, proceed with
Checkpoint 1 knowledge confirmation and Presence Direction,
then initial Core-to-WordPress site creation as the immediately
following integration goal. The historical read-only console
remains a reference, not the product workflow under test.

## Implementation approach and first bounded coding slice

**Do not attempt all six stages in a single blind implementation change.** Begin by inspecting the current branch, runtime and accepted documents. The first deliverable is an interactive, isolated **C0 onboarding resume** path in the existing customer/Operator architecture, not another static C0 timeline:

- Create a **separate rehearsal identity/session** and an explicit source reference to the approved C0 business brief. Keep accepted C0 canonical/hosted data and historical customer-facing site untouched. Use a disposable/local tenant or fixture initially if real hosted authorization is not established; label its status accurately.
- Render a truthful **Interview / What we understand** view based on that approved discovery summary, with provenance, known vs proposed vs unresolved information, a small set of actionable corrections/confirmations and an unmistakable next step. The source is a summary, not a recovered Q&A transcript.
- Persist user-entered corrections/confirmations through the **existing approved proposal/knowledge interfaces**, or report the specific missing capability and deliver the narrow tested implementation. No fake state transition. Include role and customer authority and revision checks.
- Show the resulting confirmed-knowledge candidate and an initial proposed site structure in a reusable way, without covertly copying accepted v3 page/section content as if generated from the interview. Keep visual design and WordPress delivery as the **immediately following bounded slice**; expose the integration seam rather than promising a full site is already built.
- Record the current WordPress plugin/controlled theme readiness and the minimum required changes for a WordPress-generated Home + navigation, then full-site expansion. Do not bypass current synthetic-fixture approval/credential constraints or touch live databases to achieve a demonstration.

**First acceptance test:** an Operator can follow the real existing interview summary into a customer-visible knowledge review, submit one actual correction/confirmation in the isolated run, see the corresponding versioned outcome, and view the proposed next action/site outline without developer-side manual data reconstruction. The test must distinguish implemented behavior from placeholders and include authorization, provenance and stale-revision refusal. A short manual browser walkthrough plus automated regression tests should substantiate the result.

**Subsequent slice:** plugin-driven, privately staged Core-to-WordPress Home/nav render in a controlled theme, a real approved Gutenberg/style change returning to Core and surviving a follow-on release; only then expand to four+ pages, working forms, blog, customer preview and launch/Ongoing checks.

## Evidence and hard boundaries

- Measure actual Operator actions and time, customer questions/friction, missing integration, manual workarounds, content/design quality, change preservation and approval clarity. Mark each step **implemented/tested**, **manual surrogate**, **not implemented**, **blocked** or **verified** with evidence; a surrogate does not prove functionality.
- Make legitimate media usage/rights and factual verification explicit; no fabricated customer quotes, testimonials, project history, form delivery, stock usage grants or business claims.
- Preserve existing Next.js/runtime C0, hosted PG17 records, current accepted v3, active WordPress rehearsal fixture and private environment until a separate authorized migration/launch. Inspect credentials, WP private access and existing staging contents before modifying any hosted WP instance. No uncontrolled hosted writes, DNS changes, publication, privilege escalation or replacing security credentials.
- This rehearsal reuses the current technical foundation and should not grow into a second proprietary page builder, unrestricted CRM or arbitrary WordPress theme/HTML round-trip parser.
- The implementation owner must record exact commit, tests, UI URLs, isolated data identity, known limitations and the next decision in `docs/development-control.md` before calling any slice complete.

## Related canonical contracts

- [Approved C0 discovery synthesis](miopages-c0-business-brief.md)
- [C0 product model and original proof](miopages-c0-product-model.md)
- [Progressive onboarding and launch readiness](progressive-onboarding-and-launch-readiness.md)
- [Customer journey/change authority](customer-journey-and-change-management.md)
- [WordPress delivery, Appearance and inbound editing](wordpress-delivery-feasibility.md)
- [Launch and ongoing service operations](service-operations-model.md)
- [Development control / live host protection](development-control.md)
