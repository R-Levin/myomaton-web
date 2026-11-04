# Hosted synthetic concurrency and interrupted-write proof

Status: **source committed, no execution proof yet** (2026-11-04). Scoped to 20i Linux hosting package for the password-protected miopages.org development WordPress installation.

## Why CLI, not browser or admin posts

The prior WordPress v0.0.4 test confirmed one-process file operations inside the dedicated sibling directory with mode 0700. It did **not** prove that two independent PHP processes agree on locks or that failed writes do not reset a release marker. 20i documentation describes account-scoped **SSH Access** (My20i → Manage Hosting → package → Security → SSH Access), including key or 2FA authentication. Availability for this specific account has not been confirmed.

A CLI test permits genuinely separate PHP worker processes in one filesystem lock domain and avoids adding an HTTP test endpoint or relying on WordPress admin AJAX. This remains **a synthetic file exercise, not a release test**.

## Exact safe boundaries

- File: `scripts/wordpress-host-filesystem-recovery-proof.php`. The operator may copy it to the **existing `miopages-private` sibling** using File Manager/SFTP, but **never** to `public_html`, a Git-served path, or another public location. Do not upload before PHP syntax and local Linux test review.
- Requires CLI PHP on 20i with working `proc_open`, `flock`, `link`, `rename`. Stops if unavailable; no attempt to bypass hosting restrictions.
- From SSH, `cd` into `miopages-private` and run `php wordpress-host-filesystem-recovery-proof.php`. **Do not run as root.** The code checks the current folder is named exactly `miopages-private` and is a sibling of `public_html`. It performs no real release storage, WP publication, network or key exchange.
- The script creates a fresh random `mp-host-proof-...` private child, starts two subprocesses against one synthetic active marker, requires exactly one activation and one replay refusal, checks a synthetic abandoned pending write cannot change active state, then injects a corrupted **test marker only** and requires its read to fail closed. It restores its own test marker, deletes only files under the freshly created test child and attempts to remove that directory.
- A failed test or cleanup warning means **stop**, inspect the test folder manually, and do not repeat blindly. Do not edit real staging markers.
- Only report PASS/FAIL lines and any warnings, not SSH access information, private home paths or credentials.

## What passing would and would not show

A PASS would be evidence that independent CLI PHP processes on that 20i host share cooperative locks, one writer wins, marker updates use same-directory rename, and synthetic recovery inspection refuses a corrupted marker. It would **not** establish PHP-FPM/CLI process equivalence, an abrupt power-loss durable fsync, cross-host/distributed locking, hostile storage races, real release signer authority, complete HTTP isolation, WordPress page activation, or correct operator rollback.

## Prerequisite and next steps

First confirm My20i shows **SSH Access** for the `miopages.org` package. This is a read-only UI check. Then locally lint the new script using `php -l scripts/wordpress-host-filesystem-recovery-proof.php` and review/test it in a local isolated Linux-style sibling directory before deployment. Set up SSH access through 20i only if the user approves and the host offers it. The local Windows PHP 8.3 test is not a substitute for Linux hosted process behavior.

20i guide: https://docs.20i.com/reseller-hosting/connect-via-ssh/
