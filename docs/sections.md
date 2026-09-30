# Editorial Section presentation

Sections remain structured content, not a free-form page builder. `normalizeSection`
is a read-time projection shared by the microsite service and renderer. Unknown
Section types are omitted; malformed fields and unknown configuration keys are
ignored. Stored JSON, identity, version and timestamps are never rewritten.

Content is plain escaped text: `heading`, `text`, and one optional UUID `actionId`.
Hero also accepts `eyebrow`. Actions resolve in one tenant-scoped batch through the
existing Action service. Unavailable or unsafe Actions are omitted independently
of content. Labels and destinations belong to Action, never Section JSON.

Hero and CTA use the `default` variant. Intro supports `stack`, `split-text-first`
and `split-image-first`; null, `default`, and unsupported variants fall back to
stack. Images come exclusively from AssetUsage via the existing presentation
service. Absent images render text-only stacked structure. Text and Action lead
in DOM/mobile reading order; the image-first variant moves the image left only
at the platform's desktop breakpoint (48rem).

Validated `Section.configuration` options:

| Key | Values | Default / meaning |
| --- | --- | --- |
| anchor | Existing safe fragment identifier | Omitted if invalid; same destination grammar as Navigation |
| width | reading, standard, wide | standard; platform inner limits of 42, 64, 80rem |
| spacing | compact, normal, spacious | normal; 0.5, 1, 1.5 times Design System section spacing |
| alignment | left, center | left; copy/headings/action only, never media placement |
| surface | default, subtle, accent | default (CTA: subtle); background, surface, accent tokens |
| divider | none, rule, spacing | rule preserves existing separation between adjacent sections; spacing adds token-based separation, none adds no separator |
| mediaFit | natural, contain, cover | Intro only; natural preserves intrinsic ratio without cropping |

Every outer section spans its container; width constrains the inner content.
No separate full-width flag is needed. Explicit contain/cover modes use a single
platform-owned 4:3 frame; contain keeps the complete image, cover may crop.
Rounding comes from the existing radius token. Default documentation imagery
should remain natural (or contain when a frame is wanted).

Surface text and buttons use existing Design System roles. Accent surfaces use
onAccent for text, with reversed accent/onAccent buttons and visible focus rings.
Design System owners remain responsible for choosing contrasting color pairs;
this slice does not introduce color authoring or contrast enforcement.

No schema, migration, seed, content or Asset association changes are required.
The deferred register was reviewed: no new writer, editing, publishing, routing,
Asset lifecycle, usage-metadata override, or Content Engine trigger is reached.
Customer-owned semantic configuration remains separable from platform CSS.
