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
**Spending:** C0 milestone 3 run, $15.80 of a $21 cap. Ask before any paid step, and state both
the development cost and the production equivalent.

## Now

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
   - Step 4: one Core pass to the brief (design, then the ten pages, words unchanged): in progress.

## Next (agreed, in order)

2. **A real redesign of C0: the design has to change.**
   - "It still looks pretty much like the original site." "Still the same damned design." (Nov 26–27)
   - Approach: a short design brief agreed with the Principal (a clearly different look, how much
     goes on a page, how many pictures). Then one clean Core pass to that brief, checked on
     miopages.org before the Principal sees it.
   - Status: not started. Needs a spending OK (about $3–4; the cap has $2.20 left).
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
13. The 9 old Nov 23 drafts on miopages.org (pages 53–61): leave them, or archive them?

## Done (kept for the record)

- Nov 27: design rules approved and built (`docs/design-rules.md`); the footer is part of the Site
  plan; miopages.org re-connected to the new Core; the theme guarantees readable text and the
  other mechanics; U.S. English to the Principal, and each site in its Client's language.
