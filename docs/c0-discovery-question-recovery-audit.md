# Original C0 discovery question recovery audit

**Status: partial recovery verified from historical conversation context and retained source documents; complete verbatim transcript NOT yet verified.**
**Audit date: November 8, 2026.** This audit corrects the overbroad earlier claim that original C0 discovery questions/answers were unavailable or entirely lost.

## Distinguish two real interview events

1. **October 5–6 original MioPages Customer 0 business discovery (three conversational passes):** This is the authentic first-customer/business-model interview, whose first and second pass syntheses and approved final brief survive. Certain original assistant questions and owner answers can be recovered from past ChatGPT conversation context. The approved brief remains `docs/miopages-c0-business-brief.md`, with `docs/miopages-c0-product-model.md` describing the original method. It was not a fake test-data questionnaire.
2. **October 14 later Free Web Presence Review intake:** A different real human submission through `foundational-intake/1`; four selected Q&A fields are currently rendered by `scripts/operator-overview/c0-review.ts` + `views.tsx` under "Read selected answers from the later Free Review interview." Their source is the saved local Review store, not the original three-pass discovery. Do not reattribute those answers to October 5.

## Original October 5 conversation prompts recoverable from previous conversations

**Source type: past ChatGPT conversation retrieval; not yet independently matched to a complete raw local transcript.** The following short quotations or prompt fragments are recovered as original conversation context, not text invented from the final brief:

- “Who do you most want MioPages to attract first?” — original ICP discovery. The owner accepted an initial focus on established expertise-led service businesses, roughly 3–25 people as planning profile, and distinguished a managed outcome from webmaster work or bloated agencies.
- “what frustrates them enough that they would actually switch from whatever they are doing now?” — pain-profile follow-up; the owner emphasized outcomes and conversion over pixel-perfect vanity design.
- Follow-up discovery asked what MioPages actually sells, “What do they get on day one?”, “What happens after launch that makes the service worth keeping?”, the role of 20i, and what the service explicitly does not do. Some are retrievable short prompt fragments or topic paraphrases, not a verified ordered transcript.
- The early discussion subsequently asked for the core Launch vs Ongoing offer, and whether to formally capture product/customer decisions. Do not invent a precise question sequence or missing user answers.

A separate October 9 intake-design discussion included “What does MioPages do — or what do you want it to do now — in one or two plain-language sentences?” This is later than the October 5–6 three-pass discovery and **must not be silently merged into its transcript**.

## Preserved original pass-by-pass written evidence

**First-pass synthesized review (historical uploaded artifact `Pasted markdown(5).md`, not yet mapped to a canonical Git path):** Describes confirmed product direction and explicitly lists **eight unresolved discovery questions**: initial sellable Launch/Ongoing scope; commercial terms; approved identity; Review request fulfillment; initial customer segment; publishable proof; retained active assets; and initial delivery capacity. These are written **follow-up questions in the first synthesis**, not proof that each was asked verbatim in the actual live interview.

**Second-pass review (historical uploaded artifact `Pasted markdown(6).md`, with comparable `Pasted markdown(7).md`):** Explicitly states that two passes resolved many strategic unknowns; narrows the unresolved list to **five written questions**: first-cohort delivery commitment; approved pricing/rules; operating promise of the Review; public identity/contact; and which historical examples can be shown. Its confirmed facts include single managed service, target expertise-led small businesses, remote US focus, launch/ongoing structure, public-price preference, stub social presence and cohort estimate. Again, these are **written synthesis questions**, not necessarily a complete verbatim chat transcript.

**Third-pass final approved synthesis:** `docs/miopages-c0-business-brief.md` and historical artifact `Pasted markdown(8).md` preserve the approved outcome and onboarding-method lessons. The original individual first/second/third pass messages may be discoverable in chat archives or local retained logs, but a complete line-for-line transcript has not been independently verified by this audit.

## What Codex actually put in the current Operator console

Commit `6321344d9b110a8cec13c7c29e31a415fcf3a123` added a C0 journey with a three-pass **approved discovery summary**, plus a **separate** expandable set of four real October 14 Free Review answers. The code explicitly imports `prospectInterview` and selects `offer`, `audience`, `problem`, `reviewFocus` from the later Review packet; `views.tsx` labels them later Free Review answers. This was not evidence that Codex had imported verbatim October 5 discovery questions into that current screen. The screen's statement “The original interview transcript and verbatim answers were unavailable for this walkthrough” describes what that view **had loaded**, not proof no other records can recover the earlier questions.

## C0 rebuild guidance and outstanding verification

- Use the **authentic early October discovery** as the starting event, including the preserved approved brief and whatever exact prompt/answer evidence can be verified. Do not re-interview for the sake of a development demonstration, and never invent a transcript.
- First show recovered exact questions with their attributable source and stated confidence. Show synthesis-only questions and approved conclusions as **different evidence types**. Newly confirmed/corrected facts are new events, not retroactive original answers.
- The customer/Operator interface may offer the historical questions as evidence alongside the brief once provenance is confirmed; do not mistake October 14 Free Review inputs as first-pass discovery.
- Before building the interview UI, **Codex should perform a targeted read-only audit** of Git history, local repository/worktree, preserved October 5–6 artifacts and available ChatGPT/Codex chat-export logs or recovery notes, specifically seeking the full original three-pass questions and user responses. Search only authorized local evidence locations; don't collect credentials, unrelated private records or write hosted data. Report exact source paths, date, quotes, completeness and discrepancies. If only partial evidence survives, use the partial record with clear labels; do not block real onboarding on impossible perfect recovery.
- Correct the C0 onboarding rehearsal and issue #9 to reflect **partially recovered original questions and multi-pass synthesis**, without claiming a complete transcript.

This is an evidence/correction checkpoint, not authorization to modify C0 canonical state or publish a site.
