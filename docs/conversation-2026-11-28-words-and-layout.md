# Conversation, Nov 28: Core melds a page's words and layout (to revisit)

The Principal asked for this conversation to be recorded so it can be revisited: "OK, let's
proceed and revisit this exact conversation. Please record it for that purpose." (Nov 28)
The Principal's words are quoted; Claude's answers are summarized faithfully.

## What prompted it
After the PC restart, Claude checked Core's last correction of three C0 pages (Scope & Fit,
Free Review, Direct Start) against the approved Nov 27 words, visible text only:
- The layouts followed the design brief (far fewer boxes and frames, almost no nesting).
- But Core rewrote the words: Scope & Fit lost or reworded 45 of 145 lines, Free Review 25 of
  110, Direct Start 37 of 133. Examples gone: "Startups are included…", the "You provide /
  MioPages handles" panels, "The Review is free initially and useful independently of a sale",
  most of Direct Start's "What happens next".
- The seven pages already approved had also each lost a few lines (Home lost "A tangled web
  behind the scenes. A beautifully simple experience for the customer."; Pricing lost "Launch
  establishes the presence; Ongoing carries knowledge and priorities into continuing
  improvement."). Only Q&A was untouched. Claude had earlier reported "words unchanged"; that
  check was too coarse and the report was wrong.
- Pattern across the day: when told to keep the words, Core kept them and brought back the old
  layout; when told to change the layout, it rewrote the words.
- Nothing was approved or sent to miopages.org. All versions are kept; the Nov 27 words are
  still each page's current version.

## The exchange

**Principal:** "Holy crap. So broken. I don't know if this is worth doing. I don't even know what
the best path would be. Maybe the words need to change, but in that case, there is really no
foundation to work from. This sucks."

**Claude:** The foundation is intact (the Nov 27 words are current; the rewrites are only
proposals). The failure is Core's, not C0's words: Core can't change a layout without rewriting
the words, and a real Client would hit the same thing. Whether C0's words should change is a fair
but separate question, and should be its own step rather than drift.

**Principal:** "No, at this point I don't care. I don't know if the word lock makes sense or a
redesign that fixes the melding of the words and design as seen in core."

**Claude:** The word lock would be a patch; the melding is the defect. Today a page is one
object whose text sits inside its layout tree. The proper fix: a page's words and its layout
become two parts (grains) of the same Work product, each with its own versions and approval.
The layout only arranges the words and points to them, so it can't change them. This fits the
object model (`docs/service-object-model.md`: one Work product, Change grains); no new object.
It is engineering only, no AI spending, built and tested on the free stand-in; substantial
(page format, how Core is asked for pages, the review screen, the WordPress plugin); Claude's
estimate a day or two.

**Principal:** "Will that work though?"

**Claude:** For the words, yes, provably before spending: Core gets the approved text as
numbered pieces and can only place them by number; anything else is refused (the same way Core
already may only use the picture frames it's given, which it has kept to); the engine also
refuses a layout that leaves a piece out. It does **not** guarantee good design; that remains
Core's judgment against the brief and design rules, but design problems become fixable one at a
time because a layout correction can no longer damage anything else. Some flexibility is lost
(Core can't shorten a heading to fit a card without asking for a word change).

**Principal:** "But what happens with a new onboarded client. There are no words. How is the site
generated?"

**Claude:** At the start, much as now: onboarding, research, Report, strategy, Site plan; then for
each page Core writes words and layout together in one call (copy and design shape each other),
but the engine stores them as two parts. The Client reviews and approves the page as a whole, as
rendered; no separate text approval for Clients. Same cost and calls as today. The split pays off
at every later change: a word change keeps the layout; a layout change can't touch the words;
"add a section" changes both on purpose. Correction to an earlier remark: Clients approve pages,
not words and layout separately. C0 is different only because a redesign is being repaired.

**Principal:** "OK, let's proceed and revisit this exact conversation. Please record it for that
purpose."

## Where it left things
- Agreed: proceed with separating a page's words from its layout in Core (task in
  `docs/tasks.md`).
- To revisit with the Principal: this conversation as a whole. Open within it: whether the
  separation proves out as described; whether C0's Nov 27 words stand or need revising; design
  quality, which the separation doesn't solve.
