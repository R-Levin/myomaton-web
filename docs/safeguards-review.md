# Safeguards review — for the Principal (Nov 25)

Status: **accepted** by the Principal on Nov 25 (both recommendations). Asked for on Nov 25:
"a safe, but not overweening system" (baseline Part 1, #22). Work is in progress locally.

## The short version

The previous tool (Codex) built Core so that almost every step re-proves the step before it.
In `lib/platform` there are about 1,370 places that refuse to continue, and about 650
fingerprint comparisons, in 22,000 lines. A few of these protect real things. Most protect
nothing a business of this size needs protecting, and they are why ordinary work keeps
stalling. The worst example is the AI authorization file: Core's AI may not act on a Client's
correction until that exact correction has been listed in advance in a fixed file.

The proposal: **keep** the safeguards that protect real data, money and the Client's word;
**replace** the rest with the shared objects we have now (the Change record, versions,
the people list); **remove** what is left over from Codex's rehearsals.

## Keep (they protect something real)

| Safeguard | What it protects |
|---|---|
| Spending caps and the usage ledger for AI calls | Money |
| Who may give the Client's word (Client people, Client standing) | The Client's authority over their business |
| Sign-in, and permissions per Account | Private Client data |
| Separate test and real modes (a test can never act as a real person) | Real records from test runs |
| Secrets kept out of Git and out of the AI | Credentials and private data |
| What the Client approves is exactly what is published (when Publish is built) | The Client's approval |
| An AI answer must match the request it answers | Paying for, and using, the right answer |
| Permanent history (nothing overwritten, nothing erased) | The record, and undo |

## Replace with something simpler

1. **Advance authorization of every item the AI may read.** Today a fixed authorization file
   must list the fingerprint of every source, Client correction, Specialist note and Home
   feedback before Core's AI may use it. Any new item needs a new file, issued by hand.
   *Instead:* consent once per Account to use the Client's own material with the AI (part of
   the service agreement), plus a spending budget per Account that you set. Every call is still
   recorded with its cost, and Core stops at the budget. This is the change that most frees the
   service. It needs your decision (question 1).
2. **Protected database rules written for C0 alone.** The protected database's rules name
   C0's exact case and record identities, so a second Client would need new rules written and
   installed. *Instead:* rules scoped to "this Account", so each new Client works the same way.
3. **A separate signed amendment for every small database change.** Each change becomes its
   own checksummed file chained to the last one (the Client people list needed one).
   *Instead:* one ordinary sequence of database updates, reviewed once at each deploy.
4. **AI prices written into the code.** A change in the model's price stops the service until
   the code is redeployed. *Instead:* prices kept in settings, still checked against what the
   provider bills.
5. **Whole-object fingerprints compared between steps.** Most of the 650 comparisons check
   that nothing moved between two internal steps. *Instead:* the Change record and versions
   from step 4 already say what each change was made against. Keep fingerprints only at the
   real boundaries (what was approved = what is published; the AI answer matches its request).
6. **C0 as code, and several ways to run the same thing.** Ten C0-specific files, and separate
   "disposable", "evaluation" and "protected" paths through the same work. *Instead:* one path
   per object, with C0 as data like any other Client.

## Remove

- About 40 rehearsal, proof and recovery folders and their scripts in `runtime-content` and
  `scripts`, left from Codex's one-off proofs. I'll confirm each is unused before removing it,
  and keep anything that holds retained evidence (moved to the archive, not deleted).

## Order, and what touches hosted systems

| Step | Local only? | Needs you |
|---|---|---|
| 5. Internal fingerprints → Change record and versions | Yes | No |
| 4. Prices in settings | Yes, until next deploy | No |
| 6. One path per object, C0 as data | Yes, until next deploy | No |
| Remove the rehearsal leftovers | Yes | No (retained evidence is archived, not deleted) |
| 1. Account consent and budget instead of per-item files | Changes how AI spending is approved | **Question 1** |
| 2 and 3. Protected database rules per Account; one update sequence | Hosted change | **Question 2** |

Each step lands with the tests still passing. The tests that only prove a removed check still
refuses things go with it, and none of the safeguards in "Keep" is weakened.

## Progress

- *Nov 25, item 1 (local):* the AI authorization takes an Account consent. With it, Client
  corrections, Specialist notes and feedback no longer need listing in advance, and all of the
  Account's own material may be used; the usage ledger's cap is the Account's budget. Without
  it, the old per-item lists still apply, so existing authorizations on protected Core keep
  working unchanged. The full run now includes a Client correcting the Report, which the old
  lists blocked.
- *Nov 25, item 4 (local):* the AI model and prices are no longer written into the code (five
  places). A rate card only has to be well formed; the ledger still prices every call from it.
- *Nov 25, items 2 and 3 (prepared, not installed):* the protected database is one ordered update
  sequence (`scripts/db/protected-account-updates.ts`). Each update is applied once and recorded
  with its checksum, and the sequence recognizes what protected Core already has. Update 0005
  makes the rules cover every Account in scope instead of naming C0's records. It goes on at
  the next deploy the Principal approves.
- *Nov 25, leftovers:* six one-off proof scripts referenced nowhere were removed (Git keeps their
  history). Recovery and rollout scripts for the hosted servers, and the script that finishes
  custody of retained images, were kept. The local rehearsal folders in `runtime-content` are
  outside Git and hold retained evidence; they are left untouched.
- *Nov 25:* items 5 and 6 are superseded by `docs/rebuild-plan.md`: the code they would have
  cleaned is retired and replaced, not repaired (Principal direction).

## Decisions for the Principal

1. **AI spending approval:** replace per-item authorization files with consent to use the
   Client's material with the AI once per Account, and a spending budget per Account that you
   set? *Recommended: yes.* During development I would still ask you before any paid call, as
   now; the budget is how it works in operation.
2. **Go-ahead** to make the local simplifications now, and to apply the protected-database
   parts (rules per Account, one update sequence) at the next deploy you approve?
   *Recommended: yes.*
