#!/usr/bin/env bash
# Child shell only; no public runtime configuration, raw token files or history.
set +x
set -euo pipefail
umask 077
ulimit -c 0
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
[[ -t 0 && -t 1 && $# == 2 ]] || { printf 'Use the authenticated interactive Cloud shell, reviewed manifest path and SHA256.\n' >&2; exit 1; }
[[ "$(pwd -P)" == /home/virtual/vps-bef564/5/53b4381d42/miopages-wp-rehearsal ]] || exit 1
git diff --quiet HEAD -- scripts lib/platform
trap 'unset WP_REHEARSAL_MIGRATION_PASSWORD' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP
read -r -s -p 'Existing miopages_migration password (MioPages migration role; blank stops): ' WP_REHEARSAL_MIGRATION_PASSWORD </dev/tty
printf '\n' >/dev/tty
[[ -n "$WP_REHEARSAL_MIGRATION_PASSWORD" ]] || { printf 'BLOCKED: existing migration password unavailable.\n' >&2; exit 1; }
# Export directly: never put a password in env(1)'s command-line arguments.
export WP_REHEARSAL_MIGRATION_PASSWORD
while IFS= read -r name; do
  case "$name" in HOME|PATH|LANG|WP_REHEARSAL_MIGRATION_PASSWORD) ;; *) unset "$name" ;; esac
done < <(compgen -e)
export NODE_ENV=production NODE_EXTRA_CA_CERTS="$HOME/supabase-ca.crt"
node --import tsx scripts/wordpress-enroll-rehearsal-principals.ts "$1" "$2"
