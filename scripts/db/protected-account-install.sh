#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077
ulimit -c 0
home="$(realpath -- "$HOME")"
[[ "$home" == /home/virtual/vps-bef564/5/53b4381d42 && $# == 0 && -t 0 && -t 1 ]]
cd -- "$home/miopages-account-cycle-d0aa1d64"
[[ "$(pwd -P)" == "$home/miopages-account-cycle-d0aa1d64" && "$(stat -c '%a:%u' .)" == "700:$(id -u)" ]]
sha256sum --status -c SHA256SUMS
[[ ! -e before-install.json && ! -e installation-evidence.json ]]
read -r -s -p 'Existing miopages_migration password (blank stops): ' password </dev/tty
printf '\n' >/dev/tty
trap 'unset password' EXIT
[[ -n "$password" ]]
printf '%s\n' "$password" | env -i HOME="$home" PATH=/usr/bin:/bin NODE_PATH="$home/miopages-wp-rehearsal/node_modules" node install.cjs APPLY-PROTECTED-ACCOUNT-CYCLE
