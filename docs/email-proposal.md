# Email across MioPages — proposal for the Principal (Nov 25)

Status: **accepted** by the Principal on Nov 25 (all four recommendations; see
`docs/owner-critical-conversations.md`). Not built yet. The local build (step 1 below) needs no
further decision; connecting an email service is a hosted change for the Principal's go-ahead.

## Why

Clients will most often tell us things by email. Today that only reaches Core if a
Specialist retypes it, so Client input can be missed or recorded inconsistently. Email out
of Core (notices, reports, copies to the right people) does not exist yet at all.

## What exists today

- **Incoming:** nothing. A Specialist can enter a Client email by hand (built Nov 24). It
  counts as the Client's word only when the sender is on the Account's list of Client people
  (built Nov 25).
- **Outgoing:** only a Visitor's enquiry from the site's Contact form, forwarded through a
  delivery route. No notices, reports or copies.

## The proposal: email uses the objects we already have

No new machinery. Every email is one of two things the object model already has.

### 1. Email in is a Request, kept as Evidence

- Each Account gets an address Core receives at. Clients write to it, or copy it on email
  they send their Specialist.
- Every message is kept whole as **Evidence** on the Account (attachments too), so the record
  is complete without anyone retyping it.
- From one of the Account's **Client people**: it becomes a **Client Request**, and it shows
  in the Specialist's **Queue** as a **Task**. The Client's own words count as Confirmed;
  anything reworded is Proposed, exactly as now.
- From anyone else: it goes to the Queue to sort out (attach to an Account, add the person
  to the list, or set aside). It never counts as the Client's word.
- A reply to something Core sent joins the same Request, so a conversation stays together.

### 2. Email out is a Delivery of a Work product to people on the Account

- **Notices:** something waits for someone. Examples: Proposed facts to confirm, a Review
  summary, a Publish approval.
- **Reports:** the Business Understanding Report, and later the regular performance report
  from first-party measurement.
- **Copies:** the Specialist and the Account Manager get copies by their role, not by anyone
  remembering to forward.
- **Administrative reports** to the Principal across Accounts: the Queue, what is waiting
  on whom, and costs.

Who receives what follows from each person's role on the Account. The list of Client people
grows to say who speaks for the Client, who receives enquiries and who receives reports. No
one types addresses into individual messages. Every send is recorded as a Delivery with its
receipt, so we can always see what was sent to whom.

Visitor enquiries stay as they are: an **Observation** (and a **Lead**), forwarded to the
Client people who receive enquiries.

## How it would be built

1. **Locally first, no sending:** the extra roles on the people list, and outgoing
   notices and reports written to a local outbox we can read. Incoming mail through a
   simulated mailbox, so the whole loop runs end to end.
2. **Then, with the Principal's approval:** one email service connected to Core for both
   receiving and sending, on MioPages' domain.

Safeguards, kept in proportion: the sender check, Evidence kept whole, private Client email
kept in Core and never in Git, and a record of every send. Nothing beyond that.

## Decisions for the Principal

1. **One address per Account** (clear for the Client, easy to copy) or **one shared address**
   matched by sender? *Recommended: one per Account; Core still checks the sender.*
2. **Should Core's AI read each incoming email and propose the facts and changes in it**
   for the Specialist to confirm? This is a small paid call per email. *Recommended: yes; it
   saves the Specialist the retyping and costs little at Launch volumes.*
3. **Which email service:** one provider for both directions, chosen when we connect it (a
   hosted change, new credentials and a small monthly cost).
4. **Who gets copies by default:** the Specialist on every Client email and notice, and the
   Principal on administrative reports only? *Recommended: yes, adjustable per Account.*
