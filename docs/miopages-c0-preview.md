# MioPages disposable rendered preview

This operator preview prepares customer-facing content and provisional presentation
for internal review. It does not update real MioPages or Myomaton, publish a site,
or authorize commercial launch. Final copy still needs operator review. Iteration
six, A Business in Focus / service-led v3, is now the human-accepted provisional
direction; the earlier iteration records below describe their historical status.
That direction has since been [promoted into reviewed canonical state](miopages-canonical-promotion.md)
under separate authorization. These preview commands remain disposable and use the
frozen historical initial graph after recognizing the exact promoted canonical graph.

## Run and inspect

After `npm run build`, run `npm run preview:miopages`. The command prints a random
loopback-only URL and records it in ignored `runtime-content/miopages-preview.json`.
Routes are `/`, `/service`, `/experience`, and `/review`. Leave the command running
for review. Normal signal handling stops its server, drops only its self-created
schema, and checks preservation again; forced process termination can leave the
isolated fixture behind. The managed asset directory is a separately named OS
temporary directory. Immutable preview bytes remain for explicit inspection.

The plan lives in `scripts/customer-previews/miopages.ts`. The reusable fixture in
`disposable.ts` reads real customer tables in a read-only snapshot, requires the
committed C0 graph and canonical revision fingerprints, replays the nine checked-in
migrations in a random schema, and copies only the selected customer. All preview
writes target that schema. Serving uses its own connection with a schema-only search
path and read-only transactions; there is no public fallback. Foreign keys stay
inside the fixture. This is operator tooling, not a customer authoring or public
preview API.

Optional responsive QA uses isolated headless Chrome, never an operator profile:

```powershell
npm install --prefix runtime-content/browser-tools --no-package-lock playwright-core
node scripts/capture-disposable-preview.mjs --url http://127.0.0.1:PORT
```

The driver is ignored local tooling, not a runtime dependency. `--chrome` can supply
another installed Chrome executable. Captures and measurements live under ignored
`runtime-content/preview-review-PORT/`. The command checks all four routes at
1440x1000, 820x1180 and 390x844, plus responsive menu opening and Escape dismissal.
It allows requests only to the supplied loopback origin. Operator approval is not
inferred from automated checks.

## Second-preview content

Approved IA and shallow Navigation are unchanged. Home explains audience, managed
work, Launch-to-Ongoing continuity and the useful Review. Service carries the
commercial explanation: Launch scope, supported expansion, ongoing attention,
pricing structure, shared responsibilities, connections, exclusions and ownership.
Experience leads with business understanding and practical judgment. Review leads
with what the prospect receives and how it helps a decision.

Business Knowledge and Offering remain authoritative and are copied unchanged,
including revisions and internal pricing eligibility. The second preview uses
Page-owned concise editorial summaries rather than direct content projections.
The full Offering overview and raw ownership entry contain internal phrasing that
does not read naturally here. Current bindings do not provide a separate approved
short public summary; this is a reusable content-projection limitation, not a reason
to persist generated presentation copy into canonical records. No prices are copied
into editorial text. Canonical facts must be checked when either source or summary
changes.

Informational Actions retain their Page destinations. The Review Action says
"Explore the free Review", not "Request". Each closing conversion surface carries
one clear preview availability note. There is no form, submit button, conversation
destination or working self-service entry. Development status no longer fills the
service explanation. Operational workflows, metrics, guaranteed outcomes and
commercial launch remain excluded.

Historical candidates TSG Performance, Ragan Design Group and Theia LLC have one
compact reserved evidence slot. No contribution, endorsement, result, testimonial,
client image or publication permission is invented. Historical experience is
separate from results of the new MioPages service.

## Reference interpretation and presentation

Apply the durable [reference/context selection principle](visual-direction.md#reference-and-context-evidence).
MioPages business context and approved brand commitments lead the recommendation;
approved style references provide evidence, not templates or proof of authorship.
Historical client work is experience/domain evidence, not a style source unless
explicitly nominated. The sites reviewed during iteration two were not nominated
as MioPages style references; their presentation is not authority for iteration three.

Current text and information structure were inspected on these accessible sites:

- [TSG Performance](https://tsgperformance.com/): specific service explanations and
  expertise-led language; avoid carrying over its larger catalog and repeated links.
- [Theia LLC](https://theiallc.com/): technical subject matter organized around
  visitor needs, applications and useful next steps.
- [My CU Home Connection](https://mycuhomeconnection.com/): understandable service
  progression and explicit next steps; consumer promotion is not MioPages' register.

Stuart Leon returned 403; Nerds Love Art and Ragan Design timed out. Their current
presentation was not used. This was a bounded structural/text review, not a visual
audit of historical designs. No additional inspiration search was needed. No
external content, imagery, layout or endorsement was reproduced.

Iteration two used reference v2 with the approved `#322f7e` deep purple, warm off-white, sand neutrals,
dark ink and motion Off. Supported sans typography uses base 16, heading scale 1.75
and line height 1.6. Comfortable density and editorial Hero replace the first preview's
asymmetric composition. Selective editorial rows, equal grouped peers, reading-width
explanations and one accent conversion band provide practical hierarchy. Compact
Section spacing is used selectively; groups are not raised feature cards. This
supports a service business that needs concise explanations and trust without
product-dashboard imagery or decorative complexity.

Shared sans typography, navigation behavior and composition vocabulary naturally
remain similar to Myomaton. Novelty is not the goal. No CSS, renderer, Section type,
composition or customer-specific runtime is added. A current reusable constraint is
that reference v2 sets Hero headline measure and responsive display sizing in its
recipe, including a comparatively prominent tablet treatment. General heading scale
does not independently control it. Existing choices are usable here; any future
change should address the recipe generically, not add MioPages overrides. The phone
Header uses the supported two-row arrangement for the wide lockup and menu.

All five PNGs in `brand/miopages/` were inspected. Only `MioPagesDV.png` is used as the
shared horizontal Header/Footer lockup. Managed ingestion strips metadata and
losslessly re-encodes a preview copy. Originals remain unchanged. Alt text is
MioPages; the Header link names Home. Compact, underscored and white alternatives
are reserved, not repeated as decoration. No client media is included.

The subsequent approved repository checkpoint deliberately retains all five brand
originals as versioned source assets, separate from optimized managed bytes; see
[brand provenance](../brand/miopages/README.md). Preview preparation alone did not
authorize production customer AssetUsage changes.

## Validation and human review

HTTP checks verify four headings/routes, Navigation and safe destinations, correct
managed image bytes, no forms/motion/private storage references/prices, foreign media
omission, unavailable utility routes and production Contact refusal. PostgreSQL tests
check fixture FK locality, read-only write refusal, canonical preservation,
baseline-drift refusal, cleanup and separate customer rendering. Real-state snapshots
cover all customers, not only MioPages. Browser measurements check logo decoding,
overflow, clipped text, navigation, forms, animations, footer identity and preview
availability at all three sizes. Full-page and arrival screenshots support bounded
visual inspection without accessing an operator browser.

Human judgment remains necessary for final service wording and commitments, the
two-business-day target, reviewed historical contributions/permissions, final
pricing, and final visual approval. Disposable previews are reviewable, not launch-ready.

## Visual Grammar iteration three

The range audit supersedes the earlier statement that existing presentation choices
were sufficient. This preview selects `restrained-editorial` version 1 through the
existing Visual Direction authority, independently of legacy reference profiles.
Refined copy, four-page IA, approved purple/warm palette and horizontal mark stay
intact. Motion remains Off. Ordinary Section width/alignment/spacing/surface/divider
are omitted; intentional grouped/editorial compositions, compact explanations,
reading-width scope and accent conversion bands remain explicit.

The reusable grammar supplies restrained responsive heading hierarchy, separate
container/prose/support measures, proportionate narrow-screen rhythm and modest
conversion typography. Intrinsic image-brand fitting keeps the lockup and accessible
menu together where space permits. No customer CSS, new composition or Section type
is introduced. The accepted Myomaton reference-v2 path remains unchanged.

`scripts/review-visual-grammar.mjs --baseline` records Myomaton and iteration two
before the shared build. After building and starting the new disposable preview,
run `node --import tsx --env-file=.env.local scripts/review-visual-grammar.mjs --url URL`.
It uses dedicated headless Chrome, records all routes at desktop/tablet/mobile,
compares Myomaton pixels and DOM/measurements exactly, and exercises in-memory
professional/law, local-service and technical fixtures plus airy-density regression.
Evidence lives under ignored `runtime-content/visual-grammar-baseline` and
`runtime-content/visual-grammar-final`; source schemas remain untouched.

Human acceptance, historical publication permissions and service commitments remain
pending. Image-led Hero, portfolio/evidence collection and structured technical
detail remain separate future slices. Brand originals remain a checkpoint decision,
not implicitly approved repository ownership. Nothing is applied to real customers.


## Commercial presentation iteration four

Iteration three remains reproducible experimental behavior. Human review rejected
its suitability for MioPages: hierarchy and Header fit improved, but the house style
remained. Phase 1 replaces its selection only in disposable state: contractVersion 2,
service-led v1, motion Off, approved purple wordmark, warm neutrals and tonal lavender.
Approved brand originals and earlier tooling remain intact.

| Route | Recipe | Hero | Relationships / ending |
| --- | --- | --- | --- |
| `/` | arrival | service-value with approved scaffold | Launch/Ongoing stages; closing emphasis |
| `/service` | service | orientation | stages, scope and responsibilities; integrated invitation |
| `/experience` | evidence | editorial masthead | text-led credibility; focused next step |
| `/review` | assessment | orientation | inputs/outputs and possible paths; focused next step, compact footer |

Expanded Launch is supported scope complexity, never a mandatory stage. Page-owned
summaries condense canonical facts; no generated canonical records or price copies
are persisted. The public-eligible Offering relationship binding is available and
tested; this preview uses approved editorial relationship summaries. No fabricated
images, endorsements, numeric prices or Review submission controls appear.

Use `preview:miopages` after building. Ignored `runtime-content/miopages-preview.json`
records the actual loopback URL and disposable schema.
`scripts/capture-disposable-preview.mjs --url URL` captures all four routes at three
sizes and verifies Navigation and containment.
`node --import tsx --env-file=.env.local scripts/review-presentation-phase1.mjs --url URL`
compares accepted Myomaton and pinned experimental MioPages pixels, DOM and measures,
then checks new MioPages and representative disposable content. Disposable managed
Asset UUIDs are normalized only for the experimental DOM comparison after approved
managed-byte validation; pixels and all other markup/measurements remain exact.
Evidence is saved under ignored `runtime-content/presentation-phase1-final`.

This is an operator-review preview, not aesthetic acceptance or launch. Final copy,
commitments, historical permissions and brand-source repository ownership remain
human checkpoint decisions. Brand originals are recommended for versioned source
ownership at an approved checkpoint, not silently staged here. Phase 2/3 and all
operational workflows remain deferred. Nothing is applied to real customers.

## Clear work, continuing care: iteration five

The previous service-led v1 infrastructure remains useful but its aesthetic proposal
was not accepted. Iteration five selects service-led v2 only in a new disposable
schema. It keeps four approved routes, refined commercial facts, approved original
wordmarks, motion Off and non-operational Review truth.

| Route | Treatment | Ending |
| --- | --- | --- |
| `/` | paper/purple serif proposition beside service-illustration FPO; audience recognition; connected Launch/Ongoing; shared responsibility | warm invitation with illustrative Review artifact |
| `/service` | orientation; connected stages with Expanded attached to Launch; scope and aligned responsibilities; plain pricing structure and quiet ownership | integrated Review invitation |
| `/experience` | editorial masthead; judgment/history; optional featured evidence FPO with unresolved permission | light focused continuation |
| `/review` | orientation; tangible illustrative assessment outline; input/output, qualified timing and possible paths | light low-pressure continuation, no form |

Source Serif 4/Source Sans 3 are real self-hosted licensed resources, not fallback
approximations. Acquisition Review emphasis is separate from current location.
Footer uses the approved light wordmark on deep plum. FPO slots disclose intended
source/aspect and contain no client images, scores, findings or customer data.

Run `preview:miopages` after the production build. The ignored preview report records
the exact live loopback URL, schema, managed logo IDs, FPO metadata and full real-state
fingerprints. `scripts/review-continuing-care.mjs --url URL` captures all routes at
three sizes, tests actual Source font loading, nav/current separation, touch and
containment, normal-production FPO refusal, and exact accepted/pinned legacy
screenshots/DOM/measures. Previous service-led v1 screenshots support comparison,
not acceptance. Results live under ignored `runtime-content/continuing-care-final`.

Human review remains decisive: does this feel like MioPages, does the service become
tangible, is typography appropriate, is the flow coherent, and are placeholders
worth resolving? Copy/commitments, historical contribution/permissions, final prices,
asset resolution and visual direction remain review decisions. Brand originals remain
a repository-ownership checkpoint recommendation. Nothing is applied to real customers,
committed, pushed or commercially launched. Full evidence/portfolio and technical
capabilities remain explicitly preserved in the deferred roadmap.

## A Business in Focus: iteration six

Human visual review accepted this take as Customer #0's provisional direction to
carry forward. It remains disposable, with copy, production imagery/evidence and
workflows subject to later approval. Canonical promotion and commercial launch
have not been authorized by this repository checkpoint.

The additive service-led v3 disposable take is documented in [A Business in Focus](miopages-business-focus.md). The existing preview command/report remain pinned to iteration five. Use scripts/preview-miopages-focus.ts for the new take; real customer state and commercial-launch boundaries remain unchanged.
