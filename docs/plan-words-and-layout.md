# Plan: separate a page's words from its layout (task 1a, Nov 28)

Agreed: "OK, let's proceed and revisit this exact conversation." (the Principal, Nov 28; see
`docs/conversation-2026-11-28-words-and-layout.md`).

## What's wrong today (verified in the code)
A page's visible words exist only inside its layout tree (`presence-native-component.ts`: each
heading, paragraph, list item and quote carries its own text). A section's `body` is only a
summary the layout restates. Every page call returns the whole tree, so Core rewrites words
whenever it lays a page out, and nothing can tell a layout change from a word change.

## Object
The page Work product, unchanged as an object. Its Changes get two more grains alongside the
whole page (`docs/service-object-model.md`, Change grains):
- **Page words:** the page's text as numbered pieces (each heading, paragraph, list item, quote,
  caption, placeholder note; plus the page heading and search text).
- **Page layout:** the arrangement, which places the pieces by number and holds no text of its
  own.
- **Whole page** (first build; "add a section about X"): words and layout together, as now.

Clients still review and approve the page as a whole, as rendered.

## How it works
1. **Stored the same way.** A page version keeps its resolved text, so delivery, the WordPress
   plugin and miopages.org need no change. The pieces are read from the tree when needed.
2. **Layout change.** Core gets the numbered pieces and the current arrangement with numbers in
   place of text. It returns an arrangement that may only use those numbers. The engine refuses an
   unknown number or a piece left out, then fills in the text itself. The words are identical by
   construction.
3. **Word change.** Core returns only the pieces it changes, removes or adds (each new piece placed
   after a named one). The engine applies them to the current layout; nothing else moves.
4. **Whole page.** As today, for a first build or when a Request needs both.
5. **Going back.** A Specialist can restore the words of any earlier version as a word change, with
   no AI call ("record every state so we can go back", Nov 27).
6. **Which grain.** In the workspace the reviewer chooses: the words, the layout, or the whole page.
   Core sorting a Client's own message into a grain comes with email in milestone 5.
7. **Visible check.** Each proposed page shows "Words unchanged" or lists exactly which lines
   changed, so nobody has to take a report on trust (the failure of Nov 27–28).

## Where
- `lib/platform/service/page-words.ts` (new): pieces from a page, arrangement with numbers,
  fill-in, apply word edits, compare two versions.
- `lib/platform/intake/presence-native-component.ts`: the arrangement schema with piece numbers.
- `lib/platform/service/ai-writer.ts`: the schema and instructions for each grain.
- `lib/platform/service/beacon-writer.ts`: the free stand-in does all three grains.
- `lib/platform/service/cycle.ts`: grains on Requests and Changes; what Core is given.
- `app/workspace/`: choose the grain; "restore words"; the words check on each proposal.

## Tests (free stand-in)
- A layout change can't alter, drop or add a word: a stand-in that tries each is refused.
- A word change leaves the arrangement byte-identical apart from the edited pieces.
- Restoring words from an earlier version is exact.
- Whole-page builds work as before; the existing 640 tests still pass.

## Then, for C0 (paid; asked first)
1. Restore the Nov 27 words on the seven pages that drifted (free).
2. One layout change for each of the ten pages to the approved design brief: about $3.50 in
   development, the same for a real Client's redesign. The cap would need to rise to about $28.
3. Check on miopages.org (words unchanged, design rules, phone menu, corners), then show the
   Principal.

## Not solved by this
Design quality: still Core's judgment against the brief and the design rules. This only makes a
layout correction safe to ask for.
