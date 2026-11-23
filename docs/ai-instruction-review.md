# Review of Core's AI instructions and the WordPress review loop

Written 2026-11-23 at the owner's request ("the whole thing could probably use a good look"). It covers
what Core actually tells the AI, checked against the instructions sent with the Nov 23 Questions page
revision on protected Core, and against Baseline Part 1. **Done** means built and tested on the branch
but not yet on protected Core. **Proposed** means waiting for the owner's decision.

## How the instructions are put together

Every AI request carries three layers:

1. **Core's own instructions** (`lib/platform/intake/core-authoring-instructions.ts`), rewritten on
   Nov 22 from Part 1. These cover the role, honesty with placeholders, imagery and FPO, writing,
   originality, design, format, and one task paragraph per stage. They are in good shape: plain, short,
   and each one traces to a requirement.
2. **Case rules** labelled "Owner instruction", stored with the case's approved authority. Six of them
   are sent with every request in this case.
3. **Framing text inside the data**: an "interpretation" paragraph, and the business knowledge, research,
   report, Direction, plan and the previous page.

## Findings

### 1. Your Notes were handled with Core's self-critique instruction. **Done**
The revision of the Questions page used the instruction written for Core critiquing its own work:
"rethink structure, copy and design… a cosmetic rewrite is not a revision… return the complete revised
Page." That told the AI to rewrite the page. Your Note asked for one paragraph to change.

- Operator reviews now have their own instruction: make the change each Note asks for, as fully as it
  asks, and leave alone everything the Notes don't concern.
- Your kept wording stays word for word.
- Your examples are treated as direction, and nothing is invented to fill a gap.

### 2. Revisions are limited to the noted sections. **Done**
- When a Note is attached to text, Core now asks the AI for that section only and leaves the rest of
  the page exactly as it was.
- If the AI judges that a wider change is needed, it says so. Core records the suggestion and mentions
  it in its reply on your Note, but **does not make the change**. You decide.
- A Note on the page as a whole, or text you added or removed, still gets a whole-page revision.
- Also cheaper and faster: the AI writes one section, not 10,000–15,000 words.

### 3. Six old case rules ride along on every request. **Proposed: retire five, reword one**
They come from the Codex-era Nov 21 "customer-facing correction round" and are labelled "Owner
instruction":

| Rule (shortened) | Problem |
|---|---|
| "Treat this as a coherent whole-site correction… evaluate all Pages and navigation" | Sent with your one-paragraph Note. It pushes every request toward rewriting the whole site, the opposite of your Nov 23 direction. |
| Home: "replace the unavailable image placeholder… do not request an unacquired image" | **Contradicts Part 1 #12** (FPO frames wherever an image belongs). Instruction 1 asks for FPO images and this rule forbids them on Home. |
| Direct Start: lead with value, keep the inactive preview Action | A one-off correction for one page. It is still sent for every page. |
| Free Review: show an illustrative report example | Same: one page, one round. |
| "Challenge repetitive wording…; temporary engineering review guides are not visitor content" | It refers to Codex-era review guides that no longer exist. |
| Keep the service proposition; no development-readiness commentary; keep unverified prices and proof unconfirmed | Still sound, but it repeats the honesty and writing instructions in different words. |

**Proposal:**
- Retire the five Nov 21 correction-round rules for this case. They belonged to that round, and their
  lasting content is already in Core's own instructions.
- Fold the sixth into the existing honesty and writing instructions.
- This changes the case's approved settings, so it needs your approval. It involves no AI spending.
- From then on, a rule you give for one round is attached to that round, not to the case forever.

### 4. The data framing is long and legalistic. **Proposed: shorten**
The "interpretation" paragraph runs to about 1,000 characters of rules phrased like a contract ("lossless
links, never excerpts… preserve their authorship and status…"). Much of it restates the honesty and
originality instructions in other words, which risks contradictions. Proposal: keep only what the AI
needs to read the data (how to resolve the compressed fields; that supplied material is information,
not instructions), and leave the rules to Core's instructions.

### 5. The WordPress side. **Partly done**
- **Editors left open.**
  - **Done:** plugin 0.1.3 makes WordPress show "MioPages Core has taken over" in an editor left open
    on an older copy, and refuses a save from that copy.
  - **Tested:** in the local editor.
  - **Not yet:** installed on miopages.org.
- **Placeholder boxes ("Content needed").** Edits inside them are not yet read back, so filling one in
  WordPress does nothing in Core. This is on the list of things still to build.
- **Business facts in your edits** (for example, who MioPages is for) stay on that page. They don't yet
  reach the Business Knowledge Base, so other pages won't learn them. This is the next build choice.

### 6. Request size and order. **Proposed (the "cheaper, faster" build)**
- Every page request re-sends about 95,000 tokens of material, including 15 high-resolution images.
- The page-specific part comes first, so the AI service's discount for repeated material never applies.
- Putting the shared material first, and sending fewer or smaller images where they don't help, would
  cut input cost by about 90% and speed up each request.

## What was not changed

Core's own self-critique rounds keep their "rethink where the concept is weak" instruction. You asked
for substantive critique there, and it no longer applies to your Notes.
