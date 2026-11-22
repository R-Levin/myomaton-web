# Hosted delivery and control: current state and plan

Written 2026-11-22 after the owner asked to start hosted delivery to miopages.org and to
clean up "what is controlled from where", including the second server account. Companion
to `what-lives-where.md`. Owner preference (Nov 22): build toward production; stay off
the development PC.

## Who controls what today

| Action | Where it is controlled today | Problem |
|---|---|---|
| Site creation (research, Direction, design, pages, revisions) | **Core**, on the Core server. | None. This is where it belongs. |
| Approving a release | **Core**: per-page review and approval records, then a signed delivery package. | Built for *releases*. It cannot send a draft for Operator review (see below). |
| Signing the delivery package | **Core**: its operator service holds the signing key. | None. |
| Carrying the package to miopages.org | **By hand.** A Codex session on the development PC sent it through the **runtime.miopages.com account** into miopages.org over SSH. A one-off script stored on miopages.org then ran it. | Nothing in Core does this. It depends on the PC, the second account and per-run scripts pinned to plugin 0.0.10 (the site now runs 0.0.12). |
| Writing drafts into WordPress | **The MioPages plugin on miopages.org**, through a WordPress command on the server. It checks Core's signature and returns a signed receipt. | Sound, but reachable only by shell access, not from Core. |
| Getting the receipt back into Core | **By hand**, the same way. | Same as carrying the package. |
| Reading Operator edits and Notes back | **Nothing.** Not built. | The Operator loop cannot close. |
| Installing the plugin and theme on miopages.org | **By hand** from the PC over SSH, with per-version pinned scripts. | No routine, repeatable update path. |
| Deploying and restarting Core | **By hand** from the PC (SSH and scripts in this repo). | Acceptable for development; the scripts are Codex-era and heavy. |
| Local WordPress on the PC | The PC: a downloaded packet and a local install script. | Temporary scaffolding; retire it. |

**Secrets and keys involved today:**
- Core's signing key, in Core.
- On miopages.org: the site's installation identity and receipt key, in a private folder outside the website.
- Five SSH keys on the development PC.

## Two mismatches with the owner's method

1. **Wrong stage gate.** The owner's method (Nov 22): Core delivers a draft, the
   Operator edits and annotates it *in WordPress*, and Core revises. The hosted path
   only accepts pages that are already individually approved and have passed a quality
   verdict. That is a release gate, applied before the review it should follow.
2. **Core's design is refused.** Codex limited Core's own page designs (custom
   layouts, FPO frames, "content needed" notices) and the design Core's AI chose
   (fonts, colours, shape, spacing) to the local install. The hosted path would refuse
   the accepted baseline site outright. The WordPress side already understands the
   chosen design; the refusals sit in Core's checks and in the renderer.

## Target: Core is in control

- **Core delivers and reads back by itself,** from the Core server, triggered from
  Core's Operator portal. There is no hand-carrying, the PC is not involved, and the
  second account plays no part.
- **Two kinds of delivery, with controls matched to the stage** (baseline Part 1 #22):
  - **Review draft:** private draft pages in Operator WordPress for editing and Notes.
    Core-signed and never public. It needs no per-page approval, because review is
    what it is for.
  - **Release:** the existing approval path, unchanged, for anything that becomes
    public. Publishing stays an owner/customer gate.
- **Read-back:** Core fetches the pages and Notes and compares them with what it
  delivered. It keeps the Operator's edits and turns Notes into revision requests for
  those exact blocks. The plugin already refuses to overwrite a page that was edited
  after delivery, so an unread edit can't be lost.
- **Plugin and theme updates** become a routine, reversible Core-driven step, not a
  per-version hand script.
- **The development PC** builds and tests only.

### How Core reaches WordPress (decided: option A)

| Option | How it works | Assessment |
|---|---|---|
| **A. Secure web endpoint in the plugin** (recommended) | Core sends the signed package to the MioPages plugin over HTTPS and gets the signed receipt back. Read-back works the same way. | Works on any WordPress host, including outside 20i (P0-6). Core needs no shell access to customer hosting. Reuses the existing signatures and receipts. Core must also pass the site's password gate during development. |
| B. Core runs the WordPress command over SSH | As today, but run by Core from its server. | Only works where the host offers SSH. Gives Core shell access to every customer's hosting, which is a much larger blast radius. |
| C. WordPress fetches from Core | The plugin checks Core for new drafts on a schedule. (A partial "release pull" exists.) | Slower and indirect. Read-back still needs a channel back to Core. |

## Cleanup list

| Item | Action | Who |
|---|---|---|
| runtime.miopages.com app (old public build) | Stop it. | Owner, in My20i (as agreed Nov 22). |
| runtime.miopages.com files (Codex operator workspace) | Inventory them. Keep what Core needs, archive the rest outside the website. Then the account can close. | Claude prepares; closing is the owner's call. |
| Per-run delivery scripts and pinned config on miopages.org | Archive them once Core's own delivery works. | Hosted change: owner approval. |
| Inactive duplicate plugin copy on miopages.org | Remove (keep an archive). | Hosted change: owner approval. |
| Temporary review-guide add-on on miopages.org | Remove when the new delivery lands. | Hosted change: owner approval. |
| SSH keys on the development PC | Keep only those still needed, and rotate keys used by earlier AI sessions. | Credential change: owner approval (already recommended in the baseline). |
| Local WordPress router fix and local install script | Retire once miopages.org works. | Claude. |
| 16 Codex-era drafts on miopages.org | Leave them, or archive them so only the current site shows. | Owner's choice. |

## Order of work

**Local code and tests (no hosted changes; Claude proceeds):**
1. ~~Carry the design Core's AI chose in the signed delivery package.~~ Done Nov 22.
2. ~~Let Core's own page designs through the renderer for review drafts.~~ Done Nov 22.
3. ~~Add the review-draft delivery kind, signed by Core and never public.~~ Done Nov 22.
4. ~~Add the plugin's web endpoint for delivery, and Core's sender.~~ Done Nov 22
   (plugin 0.1.0). Images still go through the command-line path; they move to the
   endpoint when a case has images.
5. ~~Core's control: send a review draft for a case from Core, with the site's
   settings in Core's protected configuration.~~ Done Nov 22: Core server commands
   `deliver-review` and `read-back`, settings in `wordpress-sites/<site>.json` on the
   Core server, enrolment tool `scripts/wordpress-enrol-review-site.ts`. The same
   functions will serve the Operator portal once its interface is rebuilt.
6. ~~Read-back: pages and Notes.~~ Done Nov 22. Core gets each delivered page as it
   is now, whether it was edited, and every Note with its block, replies and status.
   Core refuses to deliver over unread edits.
7. ~~Turn read-back into revisions inside Core's workflow.~~ Done Nov 22 (owner chose
   this before going live). Core server command `take-in-review`:
   - the Operator's wording goes into Core's pages as written;
   - pages with Notes (or added or removed blocks) go to Core's revision with those
     concerns, and a revision that drops the Operator's wording is rejected;
   - the next delivery replaces exactly what Core read back, keeps the Operator's
     version in WordPress's page history, and answers and resolves each Note.

   Known limits: inline formatting the Operator adds (bold, links) is not kept, because
   Core stores plain text. Images are not covered yet.
8. **Next:** a "reconcile" action for the rare case where WordPress applied a draft
   but its receipt never reached Core (Core then refuses further deliveries, safely).

**Then one owner approval covering:**
- running the enrolment for miopages.org (creates its keys);
- a dedicated WordPress account for Core's delivery on miopages.org (or using the
  existing admin account);
- adding the site's new private settings to miopages.org's configuration, and
  archiving the Codex-era command-line settings it replaces;
- deploying the current Core;
- updating the plugin and theme on miopages.org;
- enrolling miopages.org for the rebuilt case;
- delivering the baseline site as review drafts.

**Then:** the owner reviews and annotates on miopages.org, Core reads back and revises,
and the cleanup items follow.

## Decisions (owner, Nov 22)

1. **How Core reaches WordPress:** option A, a secure web endpoint in the plugin.
2. **Review drafts need no per-page approval.** Releases keep the approval path.
