# MioPages tasks

The one list of what the Principal and Claude have agreed to do. It's shown to Claude
automatically with every message (`.claude/settings.json`). Claude checks each response against it
and updates it in the same turn whenever a task is added, changed, started or finished. Each task
records the Principal's own words and the date. The Principal's examples illustrate a point; they
aren't separate tasks unless agreed. Nothing gets built that isn't on this list or agreed
in conversation first.

**The roadmap is `docs/rebuild-plan.md`** (the Principal's direction, Nov 25): milestones 1–5.
We are in milestone 3, one real AI run on C0, accepted against baseline Part 1 (#9–#16). This list
holds the agreed near-term work under that plan.

**Where the Principal looks:** miopages.org (password-protected review WordPress), drafts only.
**Spending:** C0 milestone 3 run, $24.63 of a $28 cap. Ask before any paid step, and state both
the development cost and the production equivalent.

## Now

**STOPPED (Nov 28).** "You need to stop right now. Then you need to review everything that you can
through the entire project and rethink this." No building or spending. The one task now: the
project-wide review (`docs/review-2026-11-28-stop.md`), then discuss it with the Principal. Everything
below is on hold until then.
- Nov 28, later: that review was rejected: "rehashed ideas ... think from a blank sheet of paper ... a
  pretty decent website was built a month and a half ago without all this bloated overload so just
  start there and just keep working until you have some kind of an idea ... No more talking tonight."
  Now: find the mid-October site, learn how and why it worked, review everything since, and think
  from a blank sheet. Work quietly; no spending, no hosted changes.

0. **Triage, then decide the path.** "Start with that. But first record everything into logical
   containers so we might go back to one of the old states." (Nov 27)
   - Done: states A and B recorded (`docs/states.md`, tags `c0-state-a-2026-11-26` and
     `c0-state-b-2026-11-27`, a private record snapshot, a miopages.org database export).
   - Done: triage in `docs/triage-2026-11-27.md`; its path approved (task 1).

1. **The presentation of C0's draft is broken throughout; replace it, keeping the content.**
   - "A bloated, inexplicable deformed clone." "One example out of a thousand broken shards of
     glass." (Nov 27) The Principal's examples (overlapping boxes, scores of FPO frames, button
     notes) illustrate the whole; they aren't a checklist. Keep perspective.
   - Decided: "Go ahead and follow your suggestions." (Nov 27) The triage path, in order: see the
     drafts on miopages.org as the Principal does; find and fix the overlapping; a short design
     brief for the Principal's OK; one clean Core pass keeping the content; check on
     miopages.org before showing.
   - Step 1 done: a login for Claude's checks (approved), and the drafts seen on miopages.org.
   - Step 2 found: the overlapping comes from Core's own design stylesheet (pictures pushed over
     the text panels, boxes inside boxes), not today's theme changes; the redesign removes it.
   - Step 3 done: design brief approved, cap raised to $21. "How much per page should
     ultimately be driven by need. Neither extravagant nor too constricted. Use your limit for
     now." (Nov 27)
   - Step 4: new design (Direction v16) approved; checked on miopages.org. Seven page layouts
     approved (words unchanged; frames 114 to about 40; no indigo opening; no pull quotes).
     Left: Scope & Fit (Core dropped a section) and Free Review (rewrote the headline) go back to
     Core with "keep every word"; Direct Start's layout was blocked by the cap. Cap raised to
     $24 ("Yes, raise to $24", Nov 27); in progress.
   - Paused: "If there are brand colors, they need to be discussed, not overridden." (Nov 27)
     The brief's "no indigo opening band" (Claude's wording) led v16 to use the brand indigo
     once; the heading font also changed. "Not enough information at this point to decide.
     Let's see what Core delivers, but we will discuss after." (Nov 27) So: finish the three
     pages, deliver to miopages.org, then discuss the brand color and font.
   - Nov 28: the three pages came back with every word right, but Scope & Fit and Free Review
     reverted to the old bloated layout, and Direct Start nests boxes. One more correction to the
     brief is done ($20.70 spent). Checked Nov 28: the layouts follow the brief, but Core rewrote the
     words (Scope & Fit lost 45 of 145 lines, Review 25 of 110, Direct Start 37 of 133). Not approved.
     A closer check also found the seven approved pages lost a few lines each (Home lost "A tangled
     web behind the scenes. A beautifully simple experience for the customer."); Claude's earlier
     "words unchanged" was wrong. Cause: each layout call rewrites the whole page, words included.
     Paused for task 1a, which replaces the word-lock idea.

1a. **Separate a page's words from its layout in Core.** "I don't know if the word lock makes
   sense or a redesign that fixes the melding of the words and design as seen in core." Then:
   "OK, let's proceed and revisit this exact conversation. Please record it for that purpose."
   (Nov 28; recorded in `docs/conversation-2026-11-28-words-and-layout.md`.)
   - Object: the page Work product, with words and layout as two grains (each versioned and
     approved); the layout only places the words by reference. Clients still approve the page
     as a whole. No new object.
   - Engineering only, no AI spending; built and tested on the free stand-in first. Then C0's
     ten layouts in one paid pass (about $3.50; cap to about $28, to be asked then).
   - Plan: `docs/plan-words-and-layout.md` (Nov 28).
   - Built and tested on the free stand-in (Nov 28): words and layout grains in the engine and Core's
     writer; a layout that changes, drops or invents a word is refused; going back to any earlier page
     version (no AI); "Words unchanged" or the exact changed lines on each proposed page. All ten real
     C0 pages pass offline. Cap raised to $28 ("Yes", Nov 28).
   - Done Nov 28 ($3.93): Nov 27 words restored on six pages (free); Core's layouts with the words
     kept apart; Core's slips mended (no word touched); where an earlier layout was better, that
     layout with the approved words (free). All ten pages approved, words identical to Nov 27;
     pictures 114 to 39, boxes 243 to 151, nested boxes 51 to 11, pull quotes 15 to 1. Sent to
     miopages.org (review draft 2). Rendered check: the new pages pass; its problems are on the 9
     old Nov 23 drafts. Open: 11 nested boxes remain (Home 4); the 9-link menu doesn't fit one line
     even at 1440px, so desktop shows the menu button (as the rule says). Next: the Principal looks
     on miopages.org, then brand color and font.

## Next (agreed, in order)

2. **A real redesign of C0: the design has to change.**
   - "It still looks pretty much like the original site." "Still the same damned design." (Nov 26–27)
   - Approach: a short design brief agreed with the Principal (a clearly different look, how much
     goes on a page, how many pictures). Then one clean Core pass to that brief, checked on
     miopages.org before the Principal sees it.
   - Status: being done as task 1, step 4 (brief approved, cap $21).
3. **Pages not bloated.** "A natural limit to what a visitor can comprehend on a page." (Nov 26)
   Settled inside the design brief (task 2); not a fixed rule.
4. **Phone menu and switch point.** "Restore or recreate the mobile menu." "Text menu must go to
   mobile at the width it wraps to two lines." (Nov 27)
   - Status: built; to verify on miopages.org.
5. **Corners.** "Are the strong rounded edges too extreme?" (Nov 27) Core reduced them; verify on
   miopages.org.

## Owed to the Principal

6. **Cost sheet.** Each step's development cost against what it costs a real Client in production,
   and time alongside cost. (Nov 27)
7. **A cleaner way of working.** Build and test on the free stand-in, then one clean paid pass;
   the Principal sees only finished, checked work. (Nov 27; standing rules in CLAUDE.md)

## Agreed, later

8. **Client links in onboarding.** Competitors and sites they like; optional; weighting in
   baseline #16e. (Nov 27)
9. **Milestones 4 and 5** (rebuild plan, agreed Nov 25): 4, the rebuilt Core on protected Core;
   5, Publish to WordPress plus email in and out. After milestone 3 is accepted.

## Open questions (for discussion, nothing decided)

10. Renaming page addresses in a redesign (Nov 27).
11. The review document's sections 3–5 (`docs/review-2026-11-26-inflection-point.md`).
12. Processing time closer to production (Nov 27).
13. Done Nov 28: the 9 old Nov 23 drafts (pages 53–61) archived ("Archive what you can"): copied, then trashed.
14. **Revisit the Nov 28 words-and-layout conversation** with the Principal
    (`docs/conversation-2026-11-28-words-and-layout.md`): did the separation work, do C0's words
    stand, and design quality (which the separation doesn't solve).

## Done (kept for the record)

- Nov 27: design rules approved and built (`docs/design-rules.md`); the footer is part of the Site
  plan; miopages.org re-connected to the new Core; the theme guarantees readable text and the
  other mechanics; U.S. English to the Principal, and each site in its Client's language.
