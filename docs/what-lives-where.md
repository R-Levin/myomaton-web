# What lives where

Written 2026-11-22 at the owner's request, after the WordPress editor fix. It answers
three questions: where each part of MioPages runs, how the parts connect, and which
work is permanent and which is temporary scaffolding. Update it when any of that
changes.

## The principle

**Core is the system of record. WordPress is a delivery mechanism.** Core holds what
it knows about the business and what it designed: research, report, Direction, design,
and every page's content and layout, in Core's own format. WordPress shows that site to
people and lets them edit and comment. If WordPress were replaced, Core would not change;
only the translator described below would. *(Baseline Part 1, item 3)*

## Where each part runs

| Part | Today | Planned |
|---|---|---|
| **Core** (knowledge, workflow, AI work, history, Operator/Customer portal) | Protected Core at wp-acceptance.miopages.com/core, on the 20i cloud server. Updated Nov 22 for the first rebuilt run (owner-approved build of `b7a4c51`; the running build was not re-checked for this document). | Same server. Upgrade it when real use needs it (owner, Nov 22). |
| **Core's data** | Main database on Supabase (free plan), plus a private database on the Core server that holds the C0 evaluation cases. The rebuilt case `beb8de9c` is in Core's databases; which of the two was not re-checked for this document. | Same until real use needs more. |
| **Operator WordPress** (where the Operator reviews, edits and annotates drafts) | **Local, on the owner's computer:** http://127.0.0.1:4474. The first-flight site is pages 248–256 there. | **miopages.org** on 20i Reseller hosting (owner, Nov 22). It already holds an older Codex-era draft (revision 6). |
| **Public MioPages website** | miopages.com on 20i shared hosting. Not touched by this work. | Unchanged until a site is approved and published. |
| **Customer sites** | None yet. | One WordPress site per customer on 20i Reseller hosting. Outside WordPress hosting comes later (owner, Nov 22). |
| **runtime.miopages.com** | Old public build plus the Operator workspace files, on the same server. | Stop the app and keep the files (owner, Nov 22; an owner action in My20i). |
| **Code** | Git branch `claude/rebuild-2026-11-22`. | Merged into `main` when the owner decides. |

## How the parts connect

```
Core (the site, in Core's own format)
  │ 1. Deliver: the translator turns each page into WordPress blocks
  ▼
WordPress (people look, edit text, add Notes)
  │ 2. Read back: Core compares the pages with what it delivered        ← NOT BUILT
  ▼
Core: edits become kept content, Notes become revision requests for that spot
  │ 3. Revise: Core rewrites only what was asked for, keeps the rest   ← partly exists
  └──► back to step 1
```

**The translator** is the MioPages Delivery plugin installed in WordPress
(`wordpress/miopages-delivery`) plus the site theme (`wordpress/miopages-managed-site`).
It takes Core's page description and writes WordPress pages. The same page-building
code serves the local install and the delivery to hosted WordPress.

**Status of each step:**
1. **Deliver.** Works to local WordPress, carrying Core's new design. Delivery to hosted
   WordPress (miopages.org) works but predates the rebuild: it does not yet carry
   Core's own design.
2. **Read back.** Not built. Nothing yet carries WordPress edits or Notes into Core.
   The Nov 22 editor fix was its precondition: a page saved without changes now comes
   back byte-identical, so Core will see only real edits.
3. **Revise.** Core can already critique and revise pages, and it has pieces of a
   keep/revise method (editorial findings, page revision requests). It cannot yet take
   revision requests from WordPress Notes.

**Core's in-app preview** reuses the translator's output (WordPress-format page
markup) to show the site inside Core, rather than having a separate renderer. The
source is still Core's own data, but the preview is tied to WordPress's page format.
If WordPress were ever replaced, the preview would need its own renderer.

## Permanent work and temporary scaffolding

| Piece | Status |
|---|---|
| Core's workflow, AI instructions, stored cases and history | **Permanent.** Git and Core's databases. |
| The translator: plugin and theme, including the Nov 22 editor fix | **Permanent.** In Git; it goes wherever MioPages delivers to WordPress. |
| Core's preview layout fix (Nov 22) | **Permanent code, not deployed.** Protected Core runs the older version until the owner approves a deployment. |
| Local WordPress at 127.0.0.1:4474, with its routing file and local login | **Temporary workbench.** It exists only on the owner's computer and is replaced by miopages.org. Its routing fix (which lets the editor save) is not in Git. |
| `scripts/intake/source-aware-local-wordpress.php` (installs a Core export into local WordPress) | **Temporary bridge**, until hosted delivery carries Core's design. |
| The first-flight pages 248–256 in local WordPress | **A copy.** The original stays in Core (case `beb8de9c`, version 30). |
| **Edits and Notes made in local WordPress** | **Not safe yet.** They exist only in that local database until read-back is built. Moving to miopages.org would leave them behind, and so would re-installing the site from Core (it replaces page text; WordPress keeps the old text only as a page revision). |

## Until read-back exists

- Trying the editor in local WordPress is safe. A serious round of edits and Notes can
  wait until there is a path into Core, or it must be carried over deliberately.
- Before re-installing a site into any WordPress, check whether anyone saved edits or
  Notes there.
- Core must not deliver over a WordPress page that people have edited without reading
  the page back first. Read-back must enforce this; for now it is a working rule.

## Open owner decisions

1. **Order of the next two steps:** build read-back against local WordPress first, or
   move Operator WordPress to miopages.org first and annotate there.
2. **Deploying the preview fix** to protected Core (a hosted change; owner approval).
3. **Core's preview tied to WordPress's page format:** keep it, or give Core its own
   renderer later. No action needed now.
