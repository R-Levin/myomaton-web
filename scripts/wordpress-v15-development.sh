#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077
root="$(realpath -- "$HOME")"
[[ "$root" == /home/sites/36a/9/9fe7ae6df4 && $# -ge 1 && $# -le 2 ]] || exit 1
config="$root/miopages-private/native-draft-d84ebc69-46d5-4c64-adc6-ac7b87468f89"
run="$config/apply-ba185f4c"
[[ -O "$run" && ! -L "$run" && "$(stat -c %a "$run")" == 700 ]] || exit 1
cd -- "$run"
wp() { /usr/php84/usr/bin/php /usr/local/bin/wp --path="$root/public_html" "$@"; }
case "$1" in
  read)
    [[ $# == 1 ]]
    wp eval-file "$run/wordpress-v15-readback.php"
    ;;
  install)
    [[ $# == 1 ]]
    [[ "$(wp plugin get miopages-delivery --field=version)" == 0.0.9 ]]
    python3 - "$root" <<'PY'
import hashlib, os, pathlib, re, stat, sys, zipfile
root = pathlib.Path(sys.argv[1])
current = root / "public_html/wp-content/plugins/miopages-delivery"
backup = root / "miopages-stable-draft.x7CEVvk2/miopages-delivery-0.0.9.zip"
release = pathlib.Path.cwd() / "miopages-delivery-0.0.10-lf.zip"
def bundle(path, digest):
    assert not path.is_symlink() and stat.S_IMODE(path.stat().st_mode) == 0o600
    assert hashlib.sha256(path.read_bytes()).hexdigest() == digest
    with zipfile.ZipFile(path) as archive:
        files = {}
        for entry in archive.infolist():
            if entry.is_dir():
                continue
            m = re.fullmatch(r"miopages-delivery/((?:(?:includes|assets)/)?[a-zA-Z0-9_.-]+)", entry.filename)
            assert m and m[1] not in files and not stat.S_ISLNK(entry.external_attr >> 16)
            files[m[1]] = archive.read(entry)
        return files
previous = bundle(backup, "6c3f812f0eb03016f97d433a8ea365c732d12e31c19662c8c1159ace9742fa7e")
next_files = bundle(release, "ec75ecd6906742aa9eb5a714263720752afbc80ab547d027910de81d9ee4797c")
def inventory(path):
    assert not path.is_symlink() and all(not p.is_symlink() for p in path.rglob("*"))
    return {p.relative_to(path).as_posix(): p.read_bytes() for p in path.rglob("*") if p.is_file()}
assert inventory(current) == previous
assert next_files.keys() == previous.keys()
assert {f for f in previous if next_files[f] != previous[f]} == {
    "miopages-delivery.php", "includes/class-miopages-native-draft-envelope.php",
    "includes/class-miopages-native-draft-writer.php"
}
staged = pathlib.Path.cwd() / "Delivery-0.0.10-staged"
preserved = pathlib.Path.cwd() / "Delivery-0.0.9-preserved"
assert not preserved.exists() and current.stat().st_dev == pathlib.Path.cwd().stat().st_dev
staged.mkdir(mode=0o755)
for name, content in next_files.items():
    path = staged / name
    path.parent.mkdir(mode=0o755, exist_ok=True)
    path.parent.chmod(0o755)
    with path.open("xb") as file:
        file.write(content)
    path.chmod(0o644)
assert inventory(staged) == next_files
os.rename(current, preserved)
try:
    os.rename(staged, current)
except OSError:
    os.rename(preserved, current)
    raise
assert inventory(current) == next_files and inventory(preserved) == previous
PY
    wp plugin get miopages-delivery --fields=version,status --format=json
    ;;
  apply|retry|restore)
    [[ "$(wp plugin get miopages-delivery --field=version)" == 0.0.10 ]]
    [[ -O "$config/cli-config.php" && ! -L "$config/cli-config.php" && "$(stat -c %a "$config/cli-config.php")" == 600 ]]
    [[ $# == 2 && "$2" =~ ^[0-9a-f]{64}$ ]]
    set -o noclobber
    cat >"$run/envelope-$1.json"
    wp --require="$config/cli-config.php" --user=1 eval-file "$run/wordpress-v15-envelope-check.php" "$1" "$2"
    wp --require="$config/cli-config.php" --user=1 miopages native-draft <"$run/envelope-$1.json" >"$run/receipt-$1.json"
    cat "$run/receipt-$1.json"
    ;;
  *) exit 1 ;;
esac
