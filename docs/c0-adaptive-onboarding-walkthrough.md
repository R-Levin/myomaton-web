# Customer 0 adaptive paid onboarding walkthrough

**Owner review draft · November 9, 2026 · [Issue #10](https://github.com/R-Levin/myomaton-web/issues/10)**

This walkthrough uses MioPages as the real customer. It starts after the existing
fit and commercial handoff, with the rehearsal-only checkpoint where applicable.
Read the screen copy and choose how you would answer. Questions in quotation marks
are **proposed for this interview** unless explicitly identified as recovered.
Branches show what the system would do with a future answer. The assessment at the
end uses evidence already available, without assuming those future answers.

## What the interviewer brings

| Input | What can be reused | Boundary |
| --- | --- | --- |
| October 5–6 discovery | The [recovery audit](c0-discovery-question-recovery-audit.md) preserves fragments about whom to attract, what prompts a switch, what customers get at launch and what makes service worth keeping. It records the owner's accepted audience direction and emphasis on useful outcomes and conversion. | The fragments are attributed to the historical conversation. Owner responses summarized in the audit are paraphrases. The first- and second-pass lists are written synthesis follow-ups. The complete verbatim conversation and its exact order remain unverified. |
| Approved third-pass synthesis | The [C0 business brief](miopages-c0-business-brief.md) was retained in Git at `277c094`. It establishes one managed Web Presence service, an initial established expertise-led audience, a remote US focus, Launch into Ongoing, and the Free Review's role. | This is approved discovery guidance. Timing, price and capacity figures are provisional. The November working commercial model supersedes the earlier price hypotheses for planning. [Commercial model](progressive-onboarding-and-launch-readiness.md#miopages-working-commercial-model) |
| Confirmed C0 records | Business Knowledge and Offering revision 1 in [the reviewed graph](../scripts/customer-updates/miopages-focus-reviewed.json) retain the source approval and structured Standard Launch, Expanded Launch and Ongoing components. The audience, ownership and reduced administrative burden can be carried forward with those references. | The four-page accepted v3 design and later development revamp are historical comparison points. This interview should produce its own direction from the evidence. [Canonical promotion](miopages-canonical-promotion.md) · [Later transition](miopages-c0-transition.md) |
| Separate later material | The October 14 Free Review is a later human intake, documented in the [recovery audit](c0-discovery-question-recovery-audit.md). The Issue #9 owner run establishes concrete feedback about the product experience. | The later answers are not substituted for October 5–6 discovery. The owner's saved rehearsal result remains separate and was left in place. |
| Public site observation | A November 9 read-only inspection found the legacy site still organized around WordPress websites, hosting/email, support, a gallery and a general contact path. | Observed content is evidence of what the site shows. Current service commitments, delivery, ownership, permissions and traffic require other evidence. See the [inventory](#the-existing-site-review). |

Source check for this draft used the Git-tracked brief, recovery audit, product model
and reviewed graph. The retained references to `Pasted markdown(5).md` through
`Pasted markdown(8).md` are described in the audit. A targeted repository and
attachment filename check did not locate those originals. This draft uses the
recorded partial recovery and does not claim new transcript recovery.

Two recovered prompts show how the opening skips work. “Who do you most want
MioPages to attract first?” already has an approved answer about established
expertise-led businesses. Use it to open the buying-decision branch directly.
“What happens after launch that makes the service worth keeping?” has a retained
answer in the approved Ongoing synthesis about continuing updates, improvement
and measurement. Ask what that looks like in a real month. The synthesis supplies
the answer used here. The owner's exact words and their order remain unverified.

### What the ten-step prototype can carry forward

The [actual question bank](../lib/platform/intake/onboarding.ts) preloads five
values via the [C0 launcher](../scripts/intake/c0-onboarding.ts). It has a single
offer field and optional priority, one audience and optional needs field, a main
contact choice with limited follow-ups, one general proof field, and a positive
website retention prompt. It accepts short dependency and style notes. The
[client](../scripts/intake/c0-onboarding-client.tsx) displays step progress, then
lists captured fields and a small set of gaps. The [intake service](../lib/platform/intake/service.ts)
uses scoped sessions, optimistic versions, conditional normalization and immutable
submissions. The terminal step and field validation govern submission. They do not
measure whether the information can support a site.

Keep the tested draft, resume, source, validation and submission mechanics as the
implementation starting point. Remove the question about discussing routine
updates individually in the future interview. Managed routine work is the recorded
default. Ask about business decisions, factual changes and approvals that actually
need the customer. [Operating direction](service-operations-model.md#whole-site-launch-approval-versus-ongoing-delegated-changes)

## Coverage and gaps for MioPages

| Domain | What the interviewer already has | Consequential gaps and where to get them | Why it matters |
| --- | --- | --- | --- |
| Identity and business | MioPages, `miopages.com`, one managed service. The brand represents real functions and does not claim extra headcount. | Ask only about a changed public name or material brand/organization distinction. Obtain the approved public identity and contact details from the accountable owner. | Company framing, footer and trust. Existing details on the old site are observations. |
| Offerings, delivery and scope | Standard and Expanded Launch and Ongoing are components of one relationship. Review is the free entry option. | Walk through a normal start, the deliverables, customer inputs, practical exclusions, the first month of Ongoing and the actual boundary for expanded scope. Ask for a sample scope or checklist. Keep pricing, response time and terms separate until verified and approved. | Useful Service copy, comparison questions, fit assessment and a handoff the team can deliver. |
| Buyers and decisions | Established expertise-led small service or technical businesses. The 3–25 size range is a planning profile. | Ask for a de-identified real inquiry, buying trigger, qualification test, common objections and one poor-fit pattern. Ask for the owner's preferred initial segment only if prioritization would change the message. | Audience language, search topics, trust content, sequencing and conversion. |
| Differentiation and claims | Managed responsibility, clearer explanation, ownership and less administration are approved directions. | Ask how those distinctions show up in actual delivery. Request artifacts that substantiate an example. Classify promises, outcomes and comparisons separately. | Prevent unsupported guarantees, broad support claims and invented comparative superiority. |
| Projects, materials and proof | The brief lists historical leads. The public Gallery displays several of them. The owner declined the C0 stock candidates. | Use a case-by-case contribution and permission review. Ask for a dated image or document reference, what it proves, and exactly where it may be used. | Experience can remain text-led until independently supportable claims and usage rights exist. |
| Contact and conversion | The brief describes a useful Free Review and a direct-start option. The legacy site displays forms and contact choices. | Confirm the intended primary action, minimum inputs, lead recipient, qualification, fallback and follow-up. Technical Operator verifies test delivery before live use. | Distinguish choosing an action from completing it, delivery from acceptance, and inquiries from qualified opportunities. |
| Geography and practical constraints | Remote US focus is established for the initial offer. | Ask only for consequential exceptions such as onsite work, time zones, industry exclusions or regulated claims. Obtain required wording and reviewer if an exception applies. | Accurate eligibility and routing, without speculative location pages or availability promises. |
| Website and URL history | Starter inventory from the public site below. Known historical C0 design is available for comparison. | Ask which old claims, pages, assets and features to keep, rewrite, replace, retire or exclude. Obtain old URLs, campaign links, download lists and available search evidence to assess continuity. | The new site needs deliberate content decisions and a separately verified redirect map. |
| Brand and content preferences | Prior C0 review favored purposeful explanatory imagery and declined unrelated stock. Earlier style references have an approved historical rationale. | Ask which attributes matter for this build and which must be avoided. Invite a reference link, brand kit, existing wording or example, with context and reuse rights. | Provide design direction without asking the customer to select themes, layouts or CSS. |
| Systems, search and measurement | The brief records legacy 20i hosting, email and social presence. The site links to the account portal. GA4/Search Console access remains unverified in the reviewed inputs. | Identify each dependency, continuity owner and need for integration. Ask for page lists, export or authorized metrics as available. Verify domains, mail, forms, search properties and event collection separately. | Preserve working customer access, avoid misleading integration claims and plan an evidence-based baseline. |
| Content library and future topics | The offer gives useful themes such as fit, delivery, ownership and ongoing care. A production library or performance history was not established here. | Invite service sheets, anonymized FAQs, articles, policies, slide decks, launch notes and useful links. Ask what is current, historical, private or inappropriate for reuse. | Identify substantive initial content and later opportunities instead of filling a blog quota. |
| Authority and timing | The canonical journey separates business confirmation, direction, complete site review and later authorized launch. | Identify who can confirm business facts, approve use of each asset and accept each milestone. Verify the actual commitment and readiness conditions in their own workflows. | Prevent a questionnaire answer, role selection or draft assessment from authorizing publication. |

## The customer conversation

### Open with what MioPages already knows

> **Here is what we already know.** MioPages helps established service and technical businesses across the US present their expertise clearly and keep their Web presence useful. There is one managed service, starting with Launch and continuing into Ongoing. The Free Review helps someone understand their priorities before deciding what to do. You can correct any of this. We’ll ask about the details that affect what the new site should say or do.

The first screen shows **Where this came from** next to each prefilled item. An
unchanged confirmed fact is carried forward. **Something has changed** opens the
specific item for correction and saves the new statement alongside the original
source. It triggers a follow-up only where the change matters, such as a new
audience changing the lead qualification or main page. **I'm not sure** keeps an
uncertainty open and offers a note or Operator help. The customer can open any
relevant topic, save and return. Progress shows decisions still needed, with no
fixed question count or implication that a completed screen equals readiness.

### Understand the offering well enough to explain it

The interviewer preloads **Managed Web Presence** as the Offering and **Standard
Launch**, **Expanded Launch** and **Ongoing** as its components. It opens the
missing detail under Standard Launch first.

> “Think of a good-fit business that has just agreed to start. What do you need from them, and what do they get before the new site goes live? If you have a scope document or launch checklist, share that instead of typing it out.”

- If a checklist is supplied, show a short draft extraction of deliverables, inputs,
  exclusions and milestones. Ask only about unsupported or contradictory entries.
  “The checklist names a contact form. Who agrees what the form should collect,
  and what must work before you hand the site over?”
- If the answer is still general, ask for a concrete walkthrough. “What do you
  prepare first? What does the customer review? What counts as a finished Launch?”
  Capture planned delivery separately from an example actually delivered.
- Once the usual scope is clear, ask “What would move a job outside Standard? For
  example, how would you decide whether to review a large archive or a booking
  integration separately?” If unusual work is identified, retain the specific
  dependency and refer scope to the Operator. Avoid inventing numerical thresholds,
  price or eligibility rules from examples.
- Continue with “What would a customer typically see or receive after launch? Walk
  me through a small factual update, then a bigger change such as adding a new
  service. Which part needs the customer’s judgment?” Reuse the recorded default of
  managed routine work. Ask about factual confirmation and consequential change,
  without offering a per-update approval workflow as the default.
- Ask “What would you want a prospect to understand about the free Review before
  they request it? What do they leave with, even if they choose another next step?”
  The brief already supplies a useful independent assessment and roughly three
  priorities. Follow up on present delivery ownership and realistic turnaround
  only if the new site will invite requests.

The draft stores scope and process under the existing Offering, with source and
review status per material statement. It can turn verified steps into a useful
Service section and put real boundary questions alongside them. Historical prices
and provisional current numbers stay out of public copy pending commercial review.

### Explore one buying decision in depth

Start with the approved audience. If useful, let the owner pick a first example
within it. A technical consultancy is an illustrative branch here, without an
assertion that MioPages has that specific customer.

> “When a firm like that contacts you, what has usually changed that makes the website worth dealing with now? Could you describe a recent example without names or private contact information?”

- If the trigger is a change in what the firm sells, ask “What do referrals already
  understand that a new visitor would miss? What two questions do prospects ask
  before they are ready to talk?” Use exact vocabulary from a permitted example
  for copy research. Record the source and avoid treating one case as a trend.
- If the trigger is being too busy to manage the site, ask “What are they doing now,
  what work do they want you to take over, and what responsibility do they expect
  to keep?” This helps explain the customer/MioPages division of work.
- For an objection such as losing control, ask “What would reassure a prospect
  about owning the domain and getting their content back? What can we substantiate
  today, and what still needs an agreed exit procedure?” For an objection about
  price, ask what should be explained about scope and value without repeating an
  unapproved price or claiming a cheaper alternative.
- End the branch with “What makes an inquiry a good fit for this service? What
  would you refer elsewhere or review before making a commitment?” If a second
  segment makes a materially different decision, repeat the buyer analysis for
  that segment. If the same reasons and path apply, reuse the existing evidence.

The customer sees an editable summary such as **Why they start**, **What they need
to understand** and **When to take the next step**. Unanswered prompts stay open.
No response in this example is recorded as a C0 fact.

## The existing site review

The November 9 inspection read the public homepage and its five business links.
All six returned HTTP 200 and displayed a contact form in the HTML. The footer's
privacy and terms links also returned 200. The public robots file pointed to
`/sitemap.xml`, which returned an XML list of 28 same-origin URLs, including
older offers and articles. This is a starter inventory of inspected
surfaces. Form submission, delivery, private portal access, destination behavior,
traffic, rankings, download rights and asset ownership remain unverified.

> “Here’s what I found on the site. I’ve suggested what to do with each item. Tell me what must stay, what should change, and anything you never want to see in the new site. We’ll handle old links separately.”

Each row can be **Keep as is**, **Improve**, **Replace**, **Retire**, **Exclude
from the new site** or **Investigate**. The state below is a recommendation
unless it points to an already recorded owner decision. Retiring legacy content,
excluding an inherited claim and changing a URL are separate decisions.

| Observed surface | Proposed disposition | What the customer sees next |
| --- | --- | --- |
| Homepage leads with WordPress, hosting and email. [Homepage](https://miopages.com/) | **Replace** the main message with the one managed service and its intended outcomes. Preserve the brand identity subject to the approved source. | “Is there a phrase or explanation here people still recognize and rely on? What should never be reused as the new homepage promise?” |
| Websites page speaks to creatives, lists several builders and offers broad customization. [Websites](https://miopages.com/websites/) | **Replace** the public offer explanation. Propose **excluding** the broad builder/customization promise under the bounded managed-service direction. | “Which, if any, of these old services are still offered to existing customers? Should they be absent from the new offer, or mentioned only in existing-customer help?” |
| Hosting & Email and the account link are visible on the current site. [Hosting & Email](https://miopages.com/web-hosting-and-email/) · [Account destination](https://my.miopages.com/) | **Investigate** which access paths should remain. **Exclude** hosting/email as the new headline offer. Prefer retaining a verified utility link where existing customers rely on it. | “Which link do existing hosting customers actually use? Is anything still sold separately, or do they just need account access and support?” If they rely on it, add a utility continuity check rather than routing it into new customer signup. |
| Web Support lists broad services and implies immediate availability. [Web Support](https://miopages.com/web-support/) | **Improve** accurate existing-customer support guidance. Propose **retiring** the open-ended new-customer support claim and **excluding** immediate-response wording unless separately substantiated and approved. | “Which support categories can we still describe? Which promises should be removed? Is there a separate urgent path for existing customers that we must preserve and verify?” |
| A self-managed QR website offer with a low monthly price remains reachable via the sitemap. Separate proposal and Kickstart pages also returned 200. [Self-managed websites](https://miopages.com/self-managed-websites-with-qr/) · [Request a Proposal](https://miopages.com/request-proposal/) · [Kickstart Wizard](https://miopages.com/online-kickstart-mind-map-wizard/) · [Kickstart session](https://miopages.com/online-kickstart-with-a-zoom-mind-mapping-session/) | Propose **excluding** the DIY offer and its old price from the new service, and **retiring** the old acquisition flows only after checking who uses them. | “Is anyone still using the QR product or sending customers to one of these pages? Should any path survive as legacy help?” Inspect dependencies before choosing any redirect. |
| The Gallery shows legacy project names and images, including Ragan Design Group, TSG Performance and Nerds Love Art. [Project Gallery](https://miopages.com/project-gallery/) | **Replace** the gallery treatment with evidence-led Experience. The brief explicitly holds back Nerds Love Art. Leave other cards in **Investigate** until the individual contribution and rights are clear. | “Is any old item too dated, no longer yours to show, or likely to imply a current relationship?” Keep the holdback through imports and future drafts. Preserve private reference only when authorized. |
| General contact form and published contact choices. [Contact](https://miopages.com/contact/) | **Investigate** what works and what customers use. **Improve** to route a Review, a new service question and existing-customer help appropriately if evidence supports separate paths. | “Which of these routes should a new prospect use? Which are only for existing customers? Who receives each one today?” Leave observed phone/email details unconfirmed until checked. |
| Blog index displays older articles, including an old QR offer and an account-portal announcement. [Blog](https://miopages.com/blog/) | **Investigate** by topic and URL. **Keep as is** is available for any accurate, owned evergreen article verified by the owner. Group expired offers and announcements for possible **retirement**, subject to continuity checks. | “Which articles do you still share or want prospects to find? Which links should keep working even if the article or offer is retired?” Exclude old prices and activation prompts from imported new-site content. |
| Footer policy and terms links. [Privacy Policy](https://miopages.com/privacy-policy/) · [Terms of Use](https://miopages.com/terms-of-use/) | **Investigate** continuity and obtain the owner-approved text applicable to the new service before deciding whether to keep or replace. | “Which policy or terms must remain accessible during the transition, and who can approve updates?” Existing text does not establish suitability for the new offer. |

**A practical negative branch.** The Gallery includes Nerds Love Art and the brief
already says to hold it back. The interviewer marks that item **Exclude from the
initial public site**, cites the brief, and skips asking whether to reuse it. If a
later portfolio PDF contains the item, the system retains that exclusion and shows
the conflict for review. A new grant or decision would require an explicit,
attributed change. The previously declined stock candidates are also excluded from
C0 Home suggestions. These decisions do not delete source files or retire old URLs.

For the rest of the inventory, group the items the customer can decide together
and expand a row for exceptions. If the owner identifies a frequently linked
article, campaign or document, request the URL or available export and the reason
to preserve it. Research backlinks, analytics and redirect options only with
applicable access and evidence. Store the old URL, content decision, replacement
purpose and separately proposed redirect destination. Approval and verification
of redirects remain part of launch work.

### Turn proof into useful evidence

> “The brief and Gallery both mention TSG Performance. Is there one specific piece of that work you would want a prospect to see? What was the problem, what did you personally contribute, and what can we show with permission?”

- If the customer offers a screenshot or document, ask which version it is, who
  owns it, whether client identity may appear, and whether permission covers a
  public case, a private example only, or an anonymous description. Save the
  evidence reference with the proposed claim and display scope.
- If the customer describes results, ask “What records support that outcome, over
  what period, and what could have affected it besides your work?” Without support,
  keep the result open and focus on the verified contribution. Historical work
  does not establish results from the new MioPages platform.
- If permission is unknown or declined, keep the item out of the proposed public
  page and offer another example or a text-led explanation of the service approach.
  If a second project supports the same point, keep it optional. If it supports a
  materially different audience need, offer a second evidence record.

### Decide what the website should help a visitor do

> “The brief suggests the Free Review as a useful first step. When someone has read the service page and thinks MioPages could help, what should they do first? What do you need to know to make that next interaction useful?”

- If the intended action is **Request a Review**, ask who receives it, what minimum
  information they need, what confirmation is appropriate and what happens if
  delivery fails. Check for duplicate fields already supplied and how the person
  can continue after the Review. Timing language remains conditional until confirmed.
- If the intended action is **Start a conversation**, ask whether the next step is
  a message, a call or a booking, which destination is approved, who responds and
  what fallback to show if a booking tool is unavailable. Request only a public
  link or the system name. Configuration and verification happen through the
  protected workflow.
- If an existing customer needs hosting access or urgent help, preserve that as a
  distinct utility intent with an approved destination. It should not be counted as
  a new prospect conversion. For a poor fit, determine the useful next path with
  the owner, without implying paid work or immediate support.

Follow the chosen action through **viewed → selected → accepted → delivered →
qualified**, where those events are applicable. The scope review names who can
verify each step. For C0 today, the brief establishes the Review concept and the
legacy site displays contact forms. The production destination and successful
handoff are unresolved. [Conversion Architecture](conversion-architecture.md)

### Let the customer give as much useful context as they have

> “You can add a link, paste an explanation or give us the material you already use. Tell us what it is and whether it’s current. We’ll bring back the parts that affect the website and ask about anything unclear.”

The proposed interface accepts material alongside its topic, with repeatable
entries for offerings, evidence, locations and existing-site items. A customer can
also describe the business in their own words. A proposal might extract claims
from a scope document, group FAQs from several notes and flag an old brochure that
contradicts an approved brief. Show source passages and dates, then ask one targeted
question about the contradiction. Reuse a verified answer wherever it applies.

Allow relevant follow-ups and additional material after saving, without a quota on
topics or questions. Bound individual uploads and requests for safety, with a clear
way to add more in separate items. Future document/media intake needs scoped private
storage, type and size validation, rights and consent labels, redaction guidance,
retention and an authenticated access path. The customer can share nonsecret links
or references in an assisted review until that is available. Never ask for passwords
or client data dumps. Mark statements as supplied, observed, inferred for review,
confirmed, excluded or unresolved at the level where the evidence applies.

Context can make other questions relevant. A proposed integration prompts a question
about the owner and required behavior, not credentials. A new location prompts which
services and contacts differ. A reference site prompts what the customer likes or
dislikes and why, not permission to clone it. A compliance or ownership conflict
routes to the right reviewer before that claim or material is used.

## The assessment C0 would see today

> **Here is what we understand about MioPages.** You help established service and technical businesses explain their expertise and keep their Web presence useful. The service has a defined starting point in Launch and continuing support in Ongoing. The old site makes hosting, builders and broad support much more prominent than the managed relationship. It also gives existing customers a recognizable account link, which is worth preserving if verified. The new site should explain the relationship first and give existing customers a clear utility route.

| Candidate knowledge or recommendation | Evidence and status | Effect on the proposed site |
| --- | --- | --- |
| Initial audience, US remote focus, ownership and lower administrative burden | Confirmed in C0 Business Knowledge. A more specific buyer trigger, objection and fit signal remain open. | A grounded Home message is possible. Buyer-specific copy and targeting need examples. |
| One Offering with Launch, expanded scope when justified, and Ongoing | Approved brief and Offering revision 1. Normal deliverables and handoff detail require confirmation. | Service can explain the relationship and its stages. Detailed inclusions, timelines and commercial promises stay provisional. |
| Move legacy hosting and open-ended support out of new-client positioning | Direct site observation plus approved service positioning. Specific old-content dispositions are recommendations for owner review. | Lead with managed outcomes. Keep verified existing-customer account/support access separate from the new-client path. |
| Proof on Experience | Named historical leads and legacy Gallery observed. Specific contribution, outcome and permissions are open. The recorded holdback and stock rejections apply. | Use an accurate text-led Experience draft while evidence is gathered. Any public case, image or results claim needs its own clearance. |
| Review-first visitor action with a secondary conversation or start path | The brief supports the Review and a continuation choice. The production primary action, destination, delivery and recipient are unresolved. | Draft the Review explanation and outline the flow. Hold any live form or timing promise until operational verification. |
| Design and content continuity | Prior accepted v3 explains the service visually and is useful reference evidence. Legacy URLs and assets need item decisions. | Compare purposeful explanatory graphics with verified materials. Propose a single direction after knowledge confirmation. Keep URL migration independent of visual approval. |

**Initial structure to discuss.** Home answers whom the service helps and what
responsibility MioPages takes. Service explains the start, handoff, continuing care
and fit boundaries. Experience explains the relevant work with the proof actually
available. Review sets useful expectations and supports the confirmed visitor
action when verified. Existing customers get a distinct utility route. Policies
and contact paths depend on applicable approval and verified destinations. This
outline follows the evidence and remains a recommendation. The customer can
correct intent or priority without choosing pages, templates or styling mechanics.

**First content proposal for review.** On Home, pair the confirmed low-admin goal
with a plain-language draft such as “A clearer Web presence, with someone to keep
it useful.” Explain what customers still contribute. On Service, answer “Who owns
the website and what happens if I leave?” from the confirmed ownership principle,
with specific transfer promises held for verification. At the end of Service,
propose **Request a Free Review** as the next action for an interested prospect,
subject to confirmation of the actual path and handoff. Preserve the separate
utility route for existing customers. The initial priorities are to make the
offer understandable, protect customer continuity, and verify the next visitor
action before asking people to use it.

**What is ready.** There is enough evidence for an initial assessment and an
outline. Before requesting confirmation of the build basis, ask for the normal
Launch/Ongoing deliverables and limits, one real buying example, and the owner's
decision on the legacy offer and customer-access paths. Decide whether Experience
can remain text-led. Agree the primary visitor action and assign verification of
its recipient and delivery. Make any accepted fallback explicit in the summary.
Optional extra proof or content can continue in parallel. Business understanding,
Presence Direction and complete-site acceptance still use the existing checkpoints.
[Four approval checkpoints](customer-journey-and-change-management.md#four-approval-checkpoints)

## Owner acceptance before implementation

- Walk through the opening, Standard Launch, buyer objection, legacy exclusion,
  proof and conversion branches. Mark questions that repeat known facts, lack a
  practical purpose or should instead be answered from a document or research.
- Verify that giving additional material can remove redundant questions and reveal
  a material conflict. The proposed summary must show the source, the decision it
  affects and the remaining question. Unanswered items remain visible, with a
  distinction between required decisions and optional enrichment.
- Verify that switching an action or scope retires the inapplicable follow-up from
  the active draft, preserving source history. An explicit exclusion must survive
  later imports and proposed copy. The C0 identity, original interview provenance,
  old site and accepted preview remain separate throughout.
- Judge the assessment against the actual site. The owner should be able to trace
  each suggested page, claim or action to known evidence, see what is provisional,
  and explain what must be resolved for the next checkpoint. Reaching the end of
  the conversation is not the acceptance test.

After owner acceptance, propose a bounded implementation slice that combines one
real deep offering branch, a prior-answer skip, a source reference, one durable
legacy exclusion and a resumable assessment. Reuse the existing intake and
authorization boundaries. Automated public inventory/import, document upload and
extraction, dynamic gap scoring and the proposed review screens are future work.
The design review precedes implementation and carries no authority to write
customer facts, change the commercial gate, generate WordPress or publish.
