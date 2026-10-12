> Historical checkpoint. Current execution and accepted-state authority: [final C0 checkpoint](miopages-c0-checkpoint.md). Earlier commands, URLs and fingerprints below describe that stage only. Source links now point to retained successor tooling.

# MioPages C0: bounded Home revamp preview

## Status and authority

Operator-authorized scope: reconcile the business model, settle Page purposes,
map existing material and compose Home first. This is proposed work in a newly
created disposable schema. No real-customer transition, publication, commercial
activation or visual acceptance is authorized. No commit/push is part of this slice.

The baseline is the current accepted canonical graph at `53d462c`, not the earlier
disposable experiment. The complete real-customer fingerprint is
`4758d79cea7a0ecb9019cc59b4fd8d824c2c8bdb845c37552e1b019c491cb980`.
The [accepted direction and production-safe media boundary](miopages-canonical-promotion.md)
remain the starting point. Existing unresolved VisualNeed metadata is retained;
no candidate or FPO becomes an Asset and no illustration is generated or attached.

## Business reconciliation

The preview retains the existing Business Knowledge and integrated service
Offering UUIDs, their first revisions, component identities, private pricing,
exclusions and Action references. The existing optimistic canonical writer creates
one new revision of each record inside the disposable schema only.

Audience: businesses and organizations that understand marketing is necessary but
do not want online prospecting to become another job. A fixed headcount or a
service/technical-business category is not an eligibility boundary.

Outcomes: qualified discovery, useful enquiries/leads, search visibility,
performance understanding, worthwhile growth opportunities, continuing improvement
and reduced customer administration. These are service aims, not guaranteed results.

Human judgment, structured automation and guided AI contribute to one coordinated
service. Customers supply truth, goals, preferences, assets and approvals; MioPages
owns bounded structure, presentation and operation. The core site represents stable
truth/conversion; useful content supports discovery and growth. Routine evolution
is expected; Campaigns and a future major Revamp remain exceptional scoped work.
AI is not the headline and no new commercial terms are confirmed.

This does not turn planned reporting, intake, content or optimization workflows
into functioning product features. The [journey](customer-journey-and-change-management.md)
and [opportunity model](opportunity-and-optimization-model.md) retain their status boundaries.

## Eventual Page purposes and Navigation

| Destination | Purpose | Bounded disposition |
| --- | --- | --- |
| Home | Integrated outcome, fit, model and next step | Rewrite now in preview. |
| What Is MioPages? | Explain the one managed service | Evolve `/service` later; preserve UUID/route initially. |
| What You Get | Concrete scope, value and Launch/Ongoing inclusions | Separate Page only with substantial content; otherwise Service section. |
| Getting Started | Gated Review, self-directed/assisted entry, progressive onboarding and approvals | Explain only what is available; no workflow in this slice. |
| Why MioPages | Judgment, model differentiation and truthful credibility | Reframe `/experience` later, preserving identity where practical. |
| See It in Action | Concrete, clearly labeled demonstration | Substantial section first; separate Page when justified. |
| FAQ / Q&A | Scope, ownership, infrastructure and practical questions | Section first if sufficient; existing editorial capabilities can represent it. |
| Contact | Confirmed contact/assisted route | Add only a truthful destination with approved methods. |
| Web Presence Review | Free diagnosis/fit exchange, distinct from paid Launch | Keep `/review`; currently explanatory, not operational. |
| Case Studies / Results | Verified, permissioned outcomes | Conditional; no invented proof or empty destination. |
| Account / Sign In | Functional customer utility | Omit until implemented. |

Eventual discovery Navigation should distinguish understanding the product, scope,
getting started and trust. Keep Review as a clear acquisition Action; Account is
secondary utility. Do not place every conceptual destination in the primary bar.

For this slice, Navigation, Action labels/destinations and all non-Home Page/Section
rows remain exact: Service, Experience, Review; Home through the logo. The proposed
future names are not applied ahead of their content. No empty Pages are created.

## Existing content mapping before rewriting

| Existing material | Destination/action |
| --- | --- |
| Home one-service, fit and reduced-burden proposition | Preserve intent, broaden audience and strengthen discovery/enquiry outcomes. |
| Home early Launch/Expanded Launch diagram | Remove from Home prominence; preserve detailed stages on Service. |
| Home responsibility text | Preserve truth/approval boundary in the integrated value explanation. |
| Home Review invitation | Reassign to two editorial start-path concepts with existing informational Actions. |
| Service integrated relationship | Future What Is MioPages?; no editorial rewrite now. |
| Service inclusions | Future What You Get; Home shows a short integrated summary. |
| Service journey/responsibilities | Future Getting Started; no detailed duplication on Home. |
| Service exclusions/infrastructure/ownership | Future FAQ and Why MioPages; no long exclusion list on Home. |
| Experience practical judgment | Future Why MioPages; Home explains the model without historical proof claims. |
| Experience historical-work placeholder | Conditional verified case material; no fabricated Home evidence. |
| C0 example | Future See It in Action; current Home uses an explicitly hypothetical example. |
| Review free diagnosis, fit and paid boundary | Preserve current explanatory destination; no submission or onboarding added. |

## Home composition

Six Sections: outcome Hero; what the service does; human/automation/AI model;
integrated scope; a concrete hypothetical example; two start concepts. All five
existing Home Section UUIDs are reused and one demonstration Section is added.
The old stage binding is deliberately removed from Home; it remains on Service.
The model explanation retains a live Knowledge projection (`service-posture`).
Service's existing component/scope/price projections remain unchanged because
their source fields and component summaries are preserved.

The self-directed concept links to the existing Service explanation. The assisted
concept links to the existing Review explanation. The functioning links say
"Understand the Service" and "Explore the free Review"; they do not say that they
start onboarding, book a conversation or submit a request. Hero and start-section
disclosures make the unavailable workflows explicit. No disabled/fake form appears.

Source Sans 3, managed wordmarks, accepted palette, restrained fields and motion-off
remain. A reusable opt-in `overview` Page recipe for service-led v3 reduces Hero
scale and outer spacing, uses the existing 2/3-column collection choice, stacks on
mobile and removes empty action/prose spacing. Its CSS applies only to that recipe.
No real customer selects it, and existing recipes remain pinned. No new provider,
media type, business domain, free-form styling control or workflow is introduced.

## Preview, validation and stop boundary

Build first, then run:

```powershell
node --import tsx --env-file=.env.local scripts/preview-miopages-home-revamp.ts
```

The [fixture](../scripts/customer-previews/miopages-c0-fixture.ts) refuses a drifted
MioPages source, creates its own random schema, replays migrations there only,
copies the current owned graph and copies immutable managed bytes into a temporary
root. Public source connections and the loopback renderer are read-only; writer
connections have only the disposable schema in their search path. No public-write
mode exists. Ctrl+C stops its server and removes only its self-created schema.

The ignored receipt is `runtime-content/miopages-home-revamp/preview.json`; it records
URL, schema, process, scoped state fingerprint and real-customer preservation.
Output/evidence stays under runtime-content, reusable tooling under scripts/tests.

Validation covers canonical normalization/revisions, preserved prices/identities,
non-Home rows, four-route serving, truthful Action destinations, absent workflows,
candidate/foreign-media refusal, managed-byte equality and complete real-state
preservation. Rendered review covers desktop, tablet and narrow mobile. Automated
layout checks and agent review do not establish operator visual acceptance.

Scope classification: A content/positioning, B bounded Page composition and future
IA, C opt-in refinement of the accepted language. No new D workflow capability is
implemented. Live Review, prospect persistence/synthesis, Contact activation,
onboarding/accounts, durable approvals, billing, measurement/reporting, opportunity,
Campaign and Revamp runtimes remain out of scope. Stop for human review before
any real canonical transition, commit or push.

## Rendered review and validation checkpoint

Agent inspection on 2026-10-10 covered the actual production-safe preview:

| Viewport | Document height | Horizontal overflow | Observation |
| --- | --- | --- | --- |
| Desktop 1440 x 1000 | 3248px | None | Two-column Hero, three-column summaries and two start concepts. |
| Tablet 768 x 1024 | 3440px | None | Single-column Hero; summaries remain readable in three columns. |
| Narrow mobile 360 x 800 | 5132px | None | Single-column summaries and starts; wordmark fits; menu expands/collapses. |

Each view has one H1. Both Hero links were followed: Service and Review remain
explanatory destinations with their existing preview disclosure. No submission or
onboarding was activated. The outcome proposition, integrated-service explanation,
hypothetical demonstration and planned start paths are visibly distinct.

Remaining human review points: mobile is still a long editorial page; the Hero
combines proposition, audience and a necessary development disclosure; the shared
footer still uses the accepted Launch/continuing-care signoff. No Hero image is
attached. Existing VisualNeeds remain unresolved metadata. These are review points,
not visual acceptance or authorization to apply the proposal.

Validation passed: 210 standard tests (including three new focused unit tests),
nine relevant PostgreSQL checks (including the new isolated fixture and existing
MioPages/Myomaton regressions), lint, explicit type-check, production build,
documentation links and whitespace checks. The final hypothetical-example wording
was checked again with the focused unit tests. Evidence/logs and the running-preview
receipt are ignored local output under `runtime-content/miopages-home-revamp/`.

The final read-only verification confirmed the complete real-customer fingerprint
above, the accepted canonical MioPages graph, Myomaton, all other customers and all
nine live migration rows unchanged. The existing acquisition pilot fingerprint
also remains `d53b46adeca3c487ec5544d27e90a8abbec70b704628fadf8bde8a9f27f5169a`.

Reviewed source inventory (nine paths; all unstaged):

- `app/focus-presentation.css`
- `components/managed-sites/focus-page.tsx`
- `lib/platform/presentation/plan.ts`
- `docs/miopages-home-revamp.md`
- `scripts/customer-previews/miopages-home-fixture.ts`
- `scripts/customer-previews/miopages-home-revamp.ts`
- `scripts/preview-miopages-home-revamp.ts`
- `tests/integration/miopages-home-revamp.test.ts`
- `tests/miopages-home-revamp.test.tsx`

The reusable additions are preview tooling, a bounded presentation recipe and
tests. No live intake, measurement or other deferred platform workflow was added.
