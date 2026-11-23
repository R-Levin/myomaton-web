# Request: go live with review drafts on miopages.org

Prepared 2026-11-22 for one owner decision. Background: `docs/hosted-delivery-and-control-plan.md`.

## What you would be approving

Put the first-flight site (rebuilt case `beb8de9c`, version 30) on **miopages.org** as
private review drafts. Core then delivers to that site, and reads back from it, by
itself over a secure web connection.

**What you get:** you open miopages.org (behind its existing password gate), edit text
and add Notes in WordPress. Core takes your review in, keeps your wording, revises the
noted pages and redelivers, replying to and resolving each Note.

**What it costs:** nothing in AI spending. Delivery, read-back and taking a review in
make no AI calls. Each later revision round does. That spending is a separate decision
each time and is not part of this approval.

**Nothing becomes public.** The drafts are WordPress drafts behind miopages.org's
password gate. miopages.com is not touched.

## The steps

Each step says where it happens, what changes and how to undo it. Steps run in order
and stop at the first problem. Claude reports after each stage in plain terms.

| # | Where | What changes | Undo |
|---|---|---|---|
| 1 | GitHub | Push branch `claude/rebuild-2026-11-22` (the code is ready and tested; this session's tool settings blocked the push, so it is listed here). GitHub then builds the Core package. | Nothing to undo; `main` is untouched. |
| 2 | Protected Core (wp-acceptance.miopages.com/core) | Install that package with the existing installer (`core-update.py`), which verifies every file, keeps the current version as `app-before-…`, restarts once and checks `/core`. | `core-update.py rollback app-before-…` (one command; the same installer used for the Nov 22 deployment). |
| 3 | Protected Core | **Enrol miopages.org (creates credentials):** a new key pair (Core keeps the signing half), a receipt key, and a login for Core through miopages.org's password gate (random; Core keeps it in its protected settings; miopages.org only gets its scrambled form). Writes `wordpress-sites/miopages-org.json` in Core's protected folder. | Delete that settings file; the keys then work nowhere. |
| 4 | miopages.org | **A WordPress account for Core** (`miopages-core`, Editor role: it can edit and publish pages and posts and manage comments, but cannot change settings, plugins, themes or users; Core only ever writes drafts with it). Random password that nobody uses; it is never used to log in. | Delete the account. |
| 5 | miopages.org | **Password gate:** add Core's gate login (scrambled form) to the site's existing password file. Your own gate login is unchanged. | Remove that one line. |
| 6 | miopages.org | **Configuration:** the site's settings now name the new review setup instead of Codex's old release setup. The old settings are kept in a dated copy of the configuration file. | Put the dated copy back. |
| 7 | miopages.org | **Plugin and theme:** plugin 0.0.12 → 0.1.0, theme → current. The old versions are kept as dated folders outside the website. Two Codex leftovers are archived the same way: the inactive duplicate plugin copy and the temporary review-guide add-on. | Swap the dated folders back. |
| 8 | Protected Core → miopages.org | **First delivery:** Core sends version 30 as review drafts. Claude then reads the site back and checks the pages in a browser, desktop and phone, before reporting to you. | Move the new drafts to the trash in WordPress and clear Core's delivery record for the site (there is no earlier delivery to restore). |

## What changes for the 16 old Codex drafts on miopages.org

They stay as they are: same text, still drafts, nothing deleted. But they belong to
Codex's old release setup, which step 6 replaces. They will no longer show their branded
preview (colours and wordmark) and will look like plain theme pages. They can be
archived later if you want only the current site there (your earlier open choice).
Restoring the dated configuration copy brings their old look back.

## Credentials involved

| Credential | New or existing | Where it lives |
|---|---|---|
| Core's signing key for miopages.org | New | Core's protected folder only |
| Receipt key (shared) | New | Core's protected folder and miopages.org's private settings |
| Core's login through the password gate | New, its own (your login unchanged) | Core's protected folder; miopages.org keeps only its scrambled form |
| WordPress account `miopages-core` | New | miopages.org; its password is random and unused |
| SSH keys used to carry out steps 2–7 | Existing, unchanged | This computer (key rotation stays on the cleanup list) |

No credential is printed, written to Git, or sent anywhere else.

## Known limits at go-live
- **Formatting you add in WordPress isn't kept:** Core keeps your words, but not bold
  or links, because it stores plain text.
- **No images yet:** the new delivery route doesn't carry images, and this site has
  none.
- **Commands still start from this computer:** Claude starts steps 2–8 and each later
  round over SSH until Core's Operator portal has buttons for them. The work itself runs
  on the Core server and miopages.org; nothing lives on this computer.
- **No "reconcile" button yet:** if WordPress applies a delivery but its receipt never
  reaches Core, Core safely stops delivering until someone reconciles.

## The decision

Approve steps 1–8 as described, or say which to change. Recommended choices are built
in:
- a dedicated WordPress account for Core;
- a dedicated gate login for Core;
- the old drafts kept as they are.
