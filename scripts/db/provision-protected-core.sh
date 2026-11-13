#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077
ulimit -c 0
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.."
[[ -t 0 && -t 1 && "$(pwd -P)" == /home/virtual/vps-bef564/5/53b4381d42/miopages-wp-rehearsal ]] || exit 1
[[ $# == 1 && "$1" == PROVISION-PROTECTED-CORE ]] || exit 1
trap 'unset MIOPAGES_PROVIDER_PASSWORD MIOPAGES_MIGRATION_PASSWORD' EXIT
read -r -s -p 'Original Supabase postgres administrator password (blank stops): ' MIOPAGES_PROVIDER_PASSWORD </dev/tty
printf '\n' >/dev/tty
[[ -n "$MIOPAGES_PROVIDER_PASSWORD" ]] || exit 1
read -r -s -p 'Existing miopages_migration password (blank stops): ' MIOPAGES_MIGRATION_PASSWORD </dev/tty
printf '\n' >/dev/tty
[[ -n "$MIOPAGES_MIGRATION_PASSWORD" ]] || exit 1
export MIOPAGES_PROVIDER_PASSWORD MIOPAGES_MIGRATION_PASSWORD
while IFS= read -r name; do
  case "$name" in HOME|PATH|LANG|MIOPAGES_PROVIDER_PASSWORD|MIOPAGES_MIGRATION_PASSWORD) ;; *) unset "$name" ;; esac
done < <(compgen -e)
node --import tsx scripts/db/provision-protected-core.ts
