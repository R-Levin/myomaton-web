#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077
ulimit -c 0
home="$(realpath -- "$HOME")"
[[ "$home" == /home/virtual/vps-bef564/5/53b4381d42 && $# == 0 && -t 0 && -t 1 ]]
cd -- "$home/miopages-account-cycle-mandate-4bc2cd00"
[[ "$(pwd -P)" == "$home/miopages-account-cycle-mandate-4bc2cd00" && "$(stat -c '%a:%u' .)" == "700:$(id -u)" ]]
sha256sum --status -c SHA256SUMS
[[ ! -e before-install.json && ! -e installation-evidence.json ]]
printf '%s\n' 'Exact customer-mandate compatibility amendment, proposal4bc2cd00.'
printf '%s\n' 'Combined SQL SHA256 a126f6851329fb3889d2746a080ccebea68465f7fabf39985d8401b4ef0e7799.'
printf '%s\n' 'Same three approved owner permissions; no new identity, credentials, budget, activation or publication.'
read -r -p 'To authorize and apply this exact SQL amendment, type APPLY-MANDATE-AMENDMENT (anything else stops): ' consent </dev/tty
[[ "$consent" == APPLY-MANDATE-AMENDMENT ]]
read -r -s -p 'Existing miopages_migration password (blank stops): ' password </dev/tty
printf '\n' >/dev/tty
read -r -s -p 'Existing Core owner password for HTTPS login/logout verification (blank skips): ' owner_password </dev/tty
printf '\n' >/dev/tty
trap 'unset password owner_password consent' EXIT
[[ -n "$password" ]]
printf '%s\n%s\n' "$password" "$owner_password" | env -i HOME="$home" PATH=/usr/bin:/bin NODE_PATH="$home/miopages-wp-rehearsal/node_modules" node install.cjs APPLY-PROTECTED-ACCOUNT-MANDATE
