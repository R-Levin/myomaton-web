# Fix 5 — Research-driven visual design: proposed scope

Status: **proposal for owner review, not started.** Prepared 2026-11-22 by Claude.
Requirements served: baseline Part 1 #10 (research visibly changes design), #11
(original, contemporary, justified design), #12 (actual images or FPO), #13 (real
MioPages brand), #15 (new blocks and layouts allowed), #23 (critique before showing).

## The problem in one paragraph

Core's AI already sees peer websites, including desktop and mobile screenshots. But the
only design levers it controls are section layout primitives: columns, spacing, surface
color, text size. Palette, fonts, shape, imagery style and page rhythm come from a fixed
brand record and a fixed theme. The Presence Direction is prose (positioning, approach,
visitor decisions), with no structured visual decisions that anything downstream reads.
So however good the visual research is, it can't change how the site looks beyond
rearranging blocks. That is why every candidate looks like the same template.

## What changes (end to end)

1. **Visual research findings (structured).** Research produces, per peer: layout
   density, hero pattern, imagery type, typography class, color use, trust/proof
   patterns and mobile behavior. Each finding cites its screenshot. The synthesis says
   which conventions buyers expect, which are tired, and where MioPages can be
   distinctive. *Reuses* the existing peer capture and research custody.
2. **Visual Direction (new structured part of the Direction).** Core's AI proposes a
   site design system *within brand guardrails*, and each choice cites a research
   finding or a brand reason:
   - type pairing and scale, chosen from a curated, license-checked font set;
   - density and spacing rhythm, corner shape, how much of each brand color is used
     and where;
   - imagery style (photography, illustration or diagram) with art-direction notes;
   - section rhythm (e.g. full-bleed bands, overlaps, media-led hero) and motion level.
3. **Rendering from tokens.** The WordPress theme and Core's preview read a validated,
   per-site token set instead of fixed values. Data only: no CSS or HTML from the
   model. Contrast checks stay at ≥4.5:1. *Reuses* `presentation/tokens.ts`
   (validatePalette, contrast), `draft-brand.ts` and `design-systems/configuration.ts`.
4. **Richer component vocabulary.** Add a small set of reviewed layout patterns the
   current primitives can't express: media-led and split hero, full-bleed band, overlap
   card, step timeline, comparison table, feature grid with icons, proof strip (only
   grounded proof). The AI composes from these; it still can't emit raw markup.
   *Extends* `presence-native-component.ts` and the PHP renderer.
5. **Imagery plan.** Visual Direction art-direction notes drive every image brief. A
   brief renders as FPO now (done in Step 2), then becomes stock acquisition (existing
   Pixabay path) or a generated illustration, and each real image passes the existing
   rights review.
6. **Visual critique loop.** Render desktop and mobile, then have Core's AI critique the
   screenshots against the Visual Direction and the peers. It revises tokens,
   compositions or imagery, not just copy. *Reuses* the existing capture and critique
   path.

## Guardrails kept
- The purple wordmark and approved brand colors stay as anchors (Part 1 #13).
- Never copy a peer's distinctive design (legal); research informs, it doesn't template.
- Accessibility: contrast, same visual and reading order on mobile, alt text.
- No raw CSS, HTML or script from the model; every token is validated server-side.

## Phasing
| Phase | Work | Spend | Gate |
|---|---|---|---|
| A | Schemas for visual findings and Visual Direction; token projection into theme and Core preview; curated fonts; new layout patterns; tests | none | none (local) |
| B | Local proof: render the *existing* 129 content under two or three hand-entered token sets, to prove the system can produce visibly different, on-brand designs. These are test fixtures only and are labeled as such; they are not Core's design and not a candidate. | none | none |
| C | Step 3 paid round: Core produces research → Visual Direction → tokens and compositions → images or FPO → critique and revision | paid | owner budget decision |

Phase A+B is roughly several focused working sessions. I'll report actual progress
rather than estimate further before you approve the scope.

## Decisions I need from you
1. **Brand flexibility.** May Core's design add tints, shades and one or two supporting
   accent colors derived from the approved palette? Or must it use only the current
   seven palette colors?
2. **Fonts.** Is a curated set of open-license fonts, self-hosted (e.g. 6–10 families),
   acceptable, or should typography stay with the current Source Serif and Source Sans?
3. **Images in Step 3.** Should the paid round include AI-generated illustrations, or
   licensed stock plus FPO only?
4. **Per-page variation.** One design system for the whole site (recommended), or allow
   page-level variation?
