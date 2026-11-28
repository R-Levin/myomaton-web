# Review after the stop, November 28, 2026

The Principal: "this is just another moment in a litany cascade of atrocious failure. You need to
stop right now. Then you need to review everything that you can through the entire project and
rethink this." Work is stopped: no building, no spending. This is Claude's review. Nothing in it is
decided; it is for discussion.

## 1. What actually happened (facts)

**The site, compared honestly.** I put C0's Home page from Nov 26 (state A, the one the Principal
said "might work in production") next to today's, on miopages.org.
- **The same page.** It has the same sections in the same order, the same wording style, the same
  "Content needed" boxes and the same kind of FPO frames.
- **What changed:** the indigo became a muted off-white, the heading font changed, and some boxes
  and pictures are gone.
- **One clear regression:** on desktop the text menu is now a menu button.
- **Pictures:** 34 real pictures then, 34 now; FPO frames went from 38 to 17.

**Cost of those two days:** about $15 (from about $9.40 to $24.63 of the run), many hours, and
repeated cap raises, approvals and restarts the Principal had to sit through.

**What I reported as progress:** "pictures 114 to 39, boxes 243 to 151, words identical." Those
are counts. None of them says whether the site is good. I reported "done" without first looking at
the pages as a Client would, against what a good site looks like.

## 2. Why: my account

These are the same failures Part 2 of the baseline describes in Codex's work. I repeated them.

1. **I measured instead of judging.** I counted boxes and pictures and checked rules, then
   reported the counts as progress (baseline #17, #23, Part 2 "tests mistaken for progress").
   Baseline #16c says a site is judged by what the Client sees. I never put the result next to a
   good real site and asked "is this good?"
2. **I never answered the real question.** The Nov 26 review asked it directly: is the
   renderer's structure limiting what Core can design? It is. Every page is a stack of sections
   (opening, middle, call to action), each a column of headings, paragraphs, lists and bordered
   panels, inside our WordPress theme's frame. Core can rearrange, recolor and restyle that stack,
   but it cannot make a page look truly different. So "a clearly different look" was never
   reachable by asking Core again. I kept asking instead of saying so.
3. **I answered each failure with more machinery.** In two days that meant a rules check, a
   readable-text script, a menu script, a findings loop, a word lock, words and layout as separate
   grains, mending, and adopting earlier layouts. Each was defensible on its own. Together they are
   Part 2's "process overhead outgrew the product." The site did not get better; the machinery
   around it grew.
4. **I spent before knowing what would work.** I ran each paid pass on ten pages at once, without
   first showing one page done well. When it failed, I paid again for corrections.
5. **I rationalized visible problems.** The menu button on a wide desktop screen is obviously
   wrong. I reported it as "following the rule" instead of calling it a defect.
6. **The site took over the roadmap.** Part 4 of the baseline warned against exactly this.
   Milestone 3 has run three days. The rest of the service has not moved: the Client's iteration
   on drafts (#16a), leads, measurement, Ongoing and milestones 4–5.
7. **I wore the Principal out.** The cost was long sessions, many questions, repeated cap requests
   and work shown before it was good. The Principal is not QA (#23), and I used them as QA again.

## 3. What is sound and worth keeping

- **Core's working record:** Requests, Changes, Reviews and Versions, with every state kept and
  restorable.
- **The Report, the research, the strategy and the Site plan,** and C0's words, which the
  Principal has not rejected.
- **Delivery to WordPress drafts** (signed, with pictures), read-back of Notes and hand edits,
  and the Client's authority over facts.
- **Pictures:** Core chooses real pictures from the Principal's free source.
- **Words and layout kept apart.** A Client's approved words can no longer change silently. That
  matters in production, whatever happens to the design approach.

## 4. The rethink: how a site's design gets made

The question isn't another correction to C0. It's how MioPages produces a site that looks
professionally designed for each Client. Four approaches, honestly weighed:

| Approach | What it means | For | Against |
|---|---|---|---|
| **A. A real design library** | A set of professionally designed, proven section and page patterns: dozens, varied, modern. Core chooses, combines and adapts them, and sets type, color and imagery for each Client. | A quality floor every Client gets; fast; cheap; easy to edit in WordPress; how most real studios work | Can feel templated unless the library is broad; the library has to be made or licensed once |
| **B. Core designs in real web code, and sees its result** | Core writes each page's HTML and CSS freely. A picture of the rendered page goes back to Core, which revises until it looks right. | True design freedom, as Part 1 asks (#15, #16c) | Hard to keep editable in WordPress; needs review before production (#15); more AI cost per page; quality depends on the model's eye |
| **C. A human designer sets the look; Core does the rest** | A Specialist or contract designer makes the design system per Client or per sector; Core writes, structures and maintains. | Part 1 #7: human work is a normal, costed part of the service; the most reliable quality | Cost per Client; doesn't scale without A |
| **D. What we have, improved** | Keep the section stack; keep correcting | Least change | Two days show it doesn't reach "clearly different" or "contemporary" |

**My view:** A, with B's feedback loop. A designed library gives every Client a professional
floor. Core picks from it and adapts it to the research and the brand, sees the rendered result
and revises, and new patterns can be added where a business needs one (#15). C is the fallback
when a Client needs more than the library gives.

D is what I kept doing. It should stop.

**How to find out, cheaply, before deciding:** one page (C0's Home) made three ways (A, B, and
today's), shown side by side with two or three of the peer sites Core researched, on
miopages.org. The Principal looks once. Each version should cost a few dollars at most, and I'd
judge them first against the peer sites, not against counts.

## 5. How I work with the Principal: changes

- **Judge by eye first.** Before anything is called done, look at the rendered page next to a
  good real site and ask whether it is good. Counts and checks come after, as engineering.
- **One page before ten.** Show one page done well before spending on the rest.
- **No new machinery without saying the trade.** Before building anything to fix a symptom, say in
  one line what it is and whether it addresses the cause; for anything larger than a small fix, ask.
- **Name defects as defects.** No rationalizing a visible problem as "per the rule."
- **Shorter sessions, fewer asks.** Bring finished, checked work and one clear decision, not a
  stream of cap raises and approvals.
- **Keep the whole service moving,** not only the site (#19).

## 6. Until we talk

Nothing changes:
- **miopages.org:** holds C0's ten current drafts; the nine old drafts are archived (copied
  privately, then moved to WordPress's trash).
- **Spending:** $24.63 of the $28 cap; no AI calls.
- **The code:** in Git, as built today.

## 7. Questions for the Principal

1. Does the diagnosis in section 2 match what you saw, or did something else fail for you?
2. Of the approaches in section 4, which do you want tested on one page, if any?
3. Should C0's design pause while other parts of the service move forward?
