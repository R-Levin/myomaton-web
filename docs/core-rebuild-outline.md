# How the rebuilt Core works: outline for owner review (2026-11-22)

Draft for the owner to steer **before** building. It is based on `MIOPAGES-BASELINE.md`
Part 1, the owner decisions P0-1 to P0-27 and the owner's November 22 corrections. It
reuses everything listed under "Keep" in `docs/claude-service-inventory.md`.

## Four principles that replace the old rule pile

1. **Core's AI does the thinking; Core gives it everything and gets out of the way.**
   At each stage the AI receives the complete knowledge (originals, research, report,
   Direction, earlier decisions) and short, plain instructions written from Part 1, not
   hundreds of lines of warnings.
2. **Missing material becomes a visible placeholder, never a gap or an invention.**
   Sometimes the plan calls for something that doesn't exist yet: an image, testimonial,
   price, case result, guarantee, team photo or contact detail. The AI then places a
   clearly marked notice at that spot, e.g. "Customer testimonial needed here: a
   recent client describing the onboarding experience", or an FPO image frame. Each
   notice becomes an open item in Core for the customer or an Operator. Presenting
   invented material as real is never allowed; leaving the spot out isn't either.
3. **Core designs each site.** The AI decides the visual design from research and the
   business:
   - palette;
   - type pairing;
   - spacing and rhythm;
   - layouts;
   - imagery style.

   Nothing is fixed by rule, not even the logo or name. The customer's existing brand
   assets are real inputs: Core uses them and never silently drops them (the logo once
   vanished for no reason, P0-17). Core may *recommend* changing them, and the
   owner or customer decides (owner, Nov 22). The theme renders Core's
   design choices as validated settings, so no raw code comes from the AI. New layout
   patterns can be added. A genuinely new block type is written up as a spec and
   reviewed by the developer before production (Part 1 #15).
4. **Controls match the stage** (Part 1 #22):
   - local work: no ceremony;
   - a paid AI round: one owner budget approval with a plain running cost log;
   - writes to protected systems, customer approval and publishing: owner approval
     each time.

## The stages

| Stage | What Core's AI does | What people do | Result |
|---|---|---|---|
| Entry (Free Review or Direct Start) | Reads the submitted information and public site; writes the Review. | Prospect submits; Operator checks. | Review, or a direct start into onboarding. |
| Research and interview | Researches the business and several peers (words *and* visuals). Asks adaptive, second-order questions with no fixed count. | Customer answers and uploads material. | Evidence and answers, each with its source. |
| Business Knowledge Base | Proposes facts and flags contradictions and gaps. | Customer sees, confirms, corrects and adds; Operator assists. | The living "My Business" record (P0-14). |
| Report and Presence Direction | Writes the Business Understanding Report and a Direction that now **includes a Visual Direction**. | Customer and owner review and correct. | Direction that drives everything after it. |
| Site creation | Plans the pages from the Direction. Writes all copy. Designs the site. Places images, FPO frames and placeholder notices. Critiques its own rendered pages and revises them. | Developer reviews any new block specs. | A complete site candidate. |
| Review | — | Owner or customer review **on the real WordPress site** (20i Reseller), not screenshots; feedback goes back to Core. | Revisions, then approval. |
| Delivery and Launch | — | Existing signed delivery to WordPress (unchanged); publication approved by owner or customer. | Live site. |
| Inquiries and measurement | Summarizes inquiries and first-party metrics. | Customer confirms outcomes. | Reports with real numbers only. |
| Ongoing | Proposes content, site and blog improvements from evidence; writes them. | Review and approve; Operator handles exceptions. | Releases, then re-measurement. |

## Safeguards that remain (each has a real reason)
- No invented testimonials, results, prices, credentials or claims presented as real.
  Use a placeholder instead.
- No copying of competitors' wording or distinctive design.
- Image licence and rights review for real images.
- Accessibility: readable contrast, the same reading order on mobile, alt text.
- No raw code from the AI into live sites.
- Spending stops at the approved budget.
- Separate customers stay separate (C0, C2 and Myomaton never mix).
- Secrets never leave protected storage.

## Build order (each step ends with something the owner can see)
1. **Site-creation AI rebuilt:** new instructions, placeholders, slimmed checks. Tested
   with recorded AI responses (no spend). *Visible:* an explanation, with examples, of
   what Core is now told and allowed to do.
2. **Design system:** Visual Direction, design settings, theme, and new layout patterns.
   *Visible:* the existing content rendered locally in two or three clearly labelled
   test designs, proving the site can look genuinely different.
3. **Ceremony simplified:** one budget approval, a plain cost log, no hash-locked grants.
4. **One properly funded full round** (owner approves the budget). Core runs research →
   report → Direction → design → pages → images, FPO and placeholders → critique →
   revision. The result lands on the 20i Reseller WordPress for owner review.
5. **In parallel, then after:**
   - Core's own screens rebuilt for owner, customer and Operator;
   - the interview, folding in the unmerged November 10 work;
   - Knowledge Base confirmation;
   - inquiries, measurement and Ongoing on real data;
   - a proof with WordPress hosted outside 20i (P0-6).

## Infrastructure notes
- The current server is enough for one or two proof customers with one heavy job at a
  time. Upgrade if real use shows otherwise.
- **The database is Supabase's free plan.** As I understand Supabase's current terms,
  free projects pause after a period of inactivity, and the plan doesn't include
  Supabase's own managed backups. Before customers rely on it, upgrade to a paid plan.
  Until then, use the project's own backup tooling and make sure nothing important
  exists only there.
