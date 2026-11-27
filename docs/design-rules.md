# Design rules

Approved by the Principal on Nov 27, 2026 (see `docs/design-rules-proposal.md` for where each
earlier limit came from). These are the only limits on how Core designs a site. Core is told
them; the checks enforce them on the rendered page, desktop and phone. Everything else (color,
corners, layout, section order, density, number of pictures, typefaces within the licensed set)
is Core's design decision, informed by its research and the Client's taste, and reviewed by the
Specialist and the Client like any other design choice.

The code holds the same list (`lib/platform/design-systems/design-rules.ts`); a test keeps the two
identical. Code cites a rule by number and adds no rules of its own.

1. **Safe.** The site loads nothing from outside and runs nothing Core wrote; styling never reaches WordPress admin. *Why: Security.*
2. **Faithful.** Every word on the page is Core's approved copy, unchanged; styling adds no text. *Why: Core writes, the Specialist approves (Part 1).*
3. **Structured.** One page title per page, headings in order, every picture described for screen readers. *Why: Accessibility and search; legal exposure.*
4. **Readable.** Text meets standard contrast (WCAG AA) against its background, and body text is at a readable size on phones. *Why: Visitors; accessibility.*
5. **Reachable.** Every approved word and link can be reached on desktop and phone; the menu works by touch and keyboard. *Why: Visitors; accessibility.*
6. **Fits the phone.** No sideways scrolling of the page; nothing pinned covers more than a small part of a phone screen; buttons and links are big enough to tap. *Why: Visitors.*
7. **Honest about gaps.** FPO frames and missing-material notices stay clearly visible and recognizable. *Why: Part 1 #12.*
8. **Licensed.** Fonts and pictures come from licensed sources, with credits recorded. *Why: Legal.*
9. **Respectful of motion.** Animation stops for visitors who ask their device for reduced motion. *Why: Accessibility.*
