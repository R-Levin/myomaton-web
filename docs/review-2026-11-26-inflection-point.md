# Review, November 26, 2026: an inflection point

The Principal, on seeing C0's draft with real pictures: *"for the first time, this is at least a
site that I think might work in production."* Also: *"the site still, honestly retains a very
similar look to the previous versions, but let's leave it as it is now."* And: *"we must stop and
assess carefully not only about the site, but about how Claude Code should work with me, and
probably several other elements."*

This document captures that review. Nothing here is decided. Each item is for discussion, and the
next tasks get fine-tuned from it. Sections 1 and 2 are facts; sections 3 to 5 are questions and
Claude's observations.

## 1. Where things stand (verified, local preview only)

- **The site:** C0's 10 pages, written by Core from the approved Report, the Direction and the
  research, and approved page by page by the Specialist. The look is Core's own design (its own
  stylesheet), checked for readability and phone layout. It has 34 real photographs from Pixabay,
  each chosen by Core, used once and reviewed by the Specialist. 38 frames that need labelled
  diagrams stay marked FPO. The content has not yet been reviewed by the Principal.
- **Where it lives:** the local preview WordPress on this computer (drafts only, nothing published).
  PDF: `runtime-content/ai-runs/c0-milestone-3/site-draft-5/miopages-with-pictures-desktop.pdf`.
- **Spending:** about $9.40 of the approved $15 (milestone 3 run).
- **Built today:** Core designs each site's actual look; a Specialist can ask Core for a change on
  any Work product; Core is told the checker's rules and retries once when refused; refused paid
  answers are re-checked before paying again; pictures travel to WordPress through a signed upload;
  the plugin's private picture path works on the Windows preview.
- **Not started:** milestone 4 (protected Core) and milestone 5 (Publish to WordPress, email).

## 2. What the Principal said today, in order

1. The draft looked like the site from two months ago, after much time and money.
2. "We are looking for what Cx will see." Keep the content; show value from the work and the
   external best practice.
3. Comparing with the old site is off base: no other Client has one (except the separate product
   still in discussion). C0 is a legitimate model for completing the product.
4. Repeated substitution of agreed direction causes real harm; the Principal cannot answer
   questions without a basis in what Claude is working with.
5. "I never said jettison what was good."
6. Pictures from the free resource (Pixabay).
7. The number of images seemed excessive; then the real concern: a natural limit to what a
   visitor can take in on a page. "Don't change anything, but let's take a look at it."
8. When Claude started changing things: stop. The Principal needed to see Core's original proposal
   to understand where it fell.
9. The site might work in production; it still looks similar to earlier versions; leave it as it is.

## 3. The site: open questions

- **Its look.** It keeps the indigo (from the logo) and the same overall structure as earlier
  versions. Is that the brand doing its job, or is the renderer's structure (sections, cards, column
  blocks) still limiting what Core can design?
- **Visual load.** Core asked for an image in nearly every section: 5 to 9 per page, 72 in all, plus
  5 to 16 boxed cards per page. On a phone each visual is most of a screen. Idea discussed but not
  applied: Core sets an *attention budget* per page (one strong image, a few that each carry a
  distinct idea, very few diagrams), the Site plan states it, and the Specialist checks it.
- **Diagrams.** 38 frames ask for labelled diagrams a photo library cannot supply. Options: Core
  draws them (SVG), an image generator, or fewer diagrams.
- **Pictures.** Many are similar desk-and-documents scenes. A credits page for Pixabay creators is
  needed before anything public.
- **Length.** About 700 to 1,100 visible words per page; 6 to 15 desktop screens and 9 to 18 phone
  screens. The Principal set text aside for now.
- **Smaller items:** WordPress page titles come from headlines (inconsistent); "Content needed"
  badges slightly low contrast; uneven right margin on phones; forms disabled until Publish.

## 4. How Claude Code works with the Principal: what went wrong today (Claude's account)

- **Judged the wrong thing.** Claude approved pages on their words and never looked at the
  rendered site, as a Client would see it, before showing it.
- **Left inherited limits in place.** The theme fixed the layout and Core chose only colours and
  fonts, contrary to Part 1 and the Principal's Nov 22 words. Claude delivered the easier thing
  without saying so.
- **Steered toward the old site,** then over-corrected into "must not look like the old site".
  Both treated C0 as a special case.
- **Changed things when asked to look.** On the visual-load question, Claude began rewriting
  Core's instructions instead of first showing the original proposal.
- **Long, technical messages** the Principal had to wade through; questions the Principal had no
  basis to answer.
- **Process noise:** checks with unstated rules refused paid answers; several preview restarts;
  long silent loops; a few over-strict safety checks left over from the earlier code.

What helped: rendering and measuring pages (readability, phone width, picture loading) before
showing; recording decisions as they happen; PDFs for reading on the phone.

**Questions for discussion:**
- How should Claude tell *look and assess* from *go and change*? (A plain signal from the
  Principal, or Claude asking one short question before changing anything after a "look at" request?)
- When should Claude propose and wait, and when act? Where are the real gates beyond CLAUDE.md's?
- How does the Principal best see the work: PDFs, the local preview, or a protected hosted
  WordPress the Principal can open on any device?
- How long and how technical should updates be? How often during long work?
- What review must happen before anything is shown, and how is it made routine rather than
  remembered? (For example, the readability, phone and picture checks run as part of every draft.)
- How does Claude keep the whole record in view (baseline, decisions, the Principal's earlier
  words) so earlier direction is not lost again?

## 5. Other elements for discussion

- **Product:** how Clients and Specialists iterate on a draft (Part 1 #16a); where Operators
  work (the workspace vs WordPress vs a portal).
- **Costs:** per-Client estimates from this run (about $3 to $6 of AI to an approvable site;
  about $1 to $2 a month ongoing) to be refined once the process is stable.
- **Milestones:** when to move to protected Core (4) and Publish with email (5), and what must be
  settled first.
- **Pictures and diagrams:** sourcing beyond Pixabay; generated images; Core-drawn diagrams.
- **Code health:** today exposed over-strict checks from the earlier code (unstated rules,
  Windows-only failures). Where else is that likely?
- **Quality checks:** turning today's ad-hoc render checks into a standing part of delivery.
- **Credentials:** the Pixabay key now sits in an ignored private file; agree how keys are kept.
- **Preview:** each restart builds a fresh WordPress (new login, drafts resent); fine for
  development, a nuisance for review.

## 6. Next

The Principal and Claude go through sections 3 to 5, decide what to do, and fine-tune the next
tasks from that. Until then the site stays exactly as it is.

## 7. The Principal's notes after reading this review (Nov 27)

- The site review covers **design and content**, done conversationally: agree first, then change.
- **Mobile menu:** restore or recreate the earlier decent mobile menu.
- **Menu switch point:** the text menu becomes the mobile menu at the width where it would wrap
  to two lines.
- **Rounded corners:** are the strong rounded edges too extreme, or up to date?
- **Restrictions:** arbitrary restrictions on building the best-looking, contemporary,
  appropriate, research-informed layout must be removed.
- **Client links:** Clients can give two kinds of external links for Core to review and use:
  competitors, and sites whose design they like.
- **Costs, development vs production (Nov 27):** the Principal cannot tell what costs what and why.
  Needed: one simple view of each step's development cost and what the same step costs a real
  Client in production, and every spending update stating both.
