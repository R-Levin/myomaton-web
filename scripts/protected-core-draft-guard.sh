#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077
ulimit -c 0
home=$(realpath -- "$HOME")
dir="$home/miopages-protected-draft-guard-a3b5d83"
[[ "$home" == /home/virtual/vps-bef564/5/53b4381d42 && -t 0 && -t 1 && $# == 1 ]]
[[ "$1" == APPLY-PROTECTED-CORE-DRAFT-GUARD || "$1" == RESTORE-PROTECTED-CORE-DRAFT-GUARD ]]
cd -- "$dir"
[[ "$(pwd -P)" == "$dir" && "$(stat -c '%a:%u' .)" == "700:$(id -u)" ]]
sha256sum -c SHA256SUMS >/dev/null
read -r -s -p 'Existing miopages_migration password (blank stops): ' password </dev/tty
printf '\n' >/dev/tty
[[ -n "$password" ]]
trap 'unset password' EXIT
printf '%s\n' "$password" | env -i HOME="$home" PATH="$PATH" NODE_PATH="$home/miopages-wp-rehearsal/node_modules" node "$dir/owner.cjs" "$1"
