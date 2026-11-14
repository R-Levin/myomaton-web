#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077
ulimit -c 0
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
[[ -t 0 && -t 1 && "$(pwd -P)" == /home/virtual/vps-bef564/5/53b4381d42/miopages-wp-rehearsal/review-ba185f4c ]] || exit 1
[[ $# == 0 ]] || exit 1
trap 'unset MIOPAGES_V15_MIGRATION_PASSWORD' EXIT
read -r -s -p 'Existing miopages_migration password (blank stops): ' MIOPAGES_V15_MIGRATION_PASSWORD </dev/tty
printf '\n' >/dev/tty
[[ -n "$MIOPAGES_V15_MIGRATION_PASSWORD" ]] || exit 1
export MIOPAGES_V15_MIGRATION_PASSWORD
while IFS= read -r name; do
  case "$name" in HOME|PATH|LANG|MIOPAGES_V15_MIGRATION_PASSWORD) ;; *) unset "$name" ;; esac
done < <(compgen -e)
node --import tsx scripts/wordpress-apply-v15.ts prepare
