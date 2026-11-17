"""Operate only the approved native WordPress visual review at miopages.org."""
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import sys
from pathlib import Path
from zipfile import ZipFile

HOME = Path("/home/sites/36a/9/9fe7ae6df4")
DOC = HOME / "public_html"
INSTALLATION = "d84ebc69-46d5-4c64-adc6-ac7b87468f89"
ROOT = HOME / "miopages-private" / ("native-draft-" + INSTALLATION)
RUN = ROOT / "stage-36f5dbff"
PHP = "/usr/php84/usr/bin/php"
PLUGIN = DOC / "wp-content/plugins/miopages-delivery"
THEME = DOC / "wp-content/themes/miopages-managed-site"
CONFIG = DOC / "wp-config.php"
MEDIA = RUN / "media"
PLUGIN_SHA = "a988c26004b261beec943565b30e61e214cd0ea30cd3221a5bbabeaa4de22ddd"
THEME_SHA = "4d2b030a79f585cea2294678c537e6cc4952d9250cb064f053610ab65315e3e3"
OLD_PLUGIN_SHA = "ec75ecd6906742aa9eb5a714263720752afbc80ab547d027910de81d9ee4797c"
OLD_STYLE_SHA = "ad620b0a72a568189f4f546b46219d7c69969897e184f2f147f7367ae414c389"
STATE = ROOT / "apply-ba185f4c/wordpress-v15-readback.php"
stage = "scope"


def check(condition):
    if not condition:
        raise ValueError("Approved staging scope mismatch")


def sha(data):
    return hashlib.sha256(data).hexdigest()


def guarded(path, mode, is_dir=False):
    info = path.lstat()
    check(path.resolve(strict=True) == path and (path.is_dir() if is_dir else path.is_file()))
    check(info.st_uid == os.getuid() and stat.S_IMODE(info.st_mode) == mode)
    return path


def invoke(*args, data=None):
    result = subprocess.run(args, input=data, capture_output=True, timeout=55, check=False)
    if result.returncode:
        raise RuntimeError("Hosted command refused")
    return result.stdout


def wp(*args, data=None, scoped=False):
    options = ["--require=" + str(ROOT / "cli-config.php"), "--user=1"] if scoped else []
    return invoke(PHP, "/usr/local/bin/wp", "--path=" + str(DOC), *options, *args, data=data)


def read_json(data):
    return json.loads(data)


def safe_write(path, data):
    with path.open("xb") as dest:
        dest.write(data)
        dest.flush()
        os.fsync(dest.fileno())
    check(path.read_bytes() == data)


def inventory(root):
    check(root.resolve(strict=True) == root and root.is_dir())
    result = {}
    for path in root.rglob("*"):
        check(not path.is_symlink() and (path.is_dir() or path.is_file()))
        if path.is_file():
            result[path.relative_to(root).as_posix()] = path.read_bytes()
    return result


def release(path, expected, directory):
    guarded(path, 0o600)
    check(sha(path.read_bytes()) == expected)
    result = {}
    with ZipFile(path) as archive:
        for entry in archive.infolist():
            if entry.is_dir():
                continue
            prefix, _, relative = entry.filename.partition("/")
            check(prefix == directory and re.fullmatch(r"[a-zA-Z0-9_.-]+(?:/[a-zA-Z0-9_.-]+)?", relative)
                  and not any(p in (".", "..") for p in relative.split("/")) and relative not in result
                  and not stat.S_ISLNK(entry.external_attr >> 16))
            result[relative] = archive.read(entry)
    return result


def stage_tree(directory, contents):
    directory.mkdir(mode=0o755)
    directory.chmod(0o755)
    for name, data in contents.items():
        target = directory / name
        target.parent.mkdir(mode=0o755, exist_ok=True)
        target.parent.chmod(0o755)
        safe_write(target, data)
        target.chmod(0o644)
    check(inventory(directory) == contents)


def baseline():
    invoke("sha256sum", "-c", str(RUN / "backup.SHA256SUMS"))
    check(wp("--skip-plugins", "--skip-themes", "eval-file", str(STATE)) == (RUN / "baseline-inventory.json").read_bytes())
    check(CONFIG.read_bytes() == guarded(RUN / "wp-config.before.php", 0o600).read_bytes())
    invoke("tar", "--compare", "-zf", str(RUN / "Managed-Site.before.tar.gz"), "-C", str(THEME.parent))
    old = release(ROOT / "apply-ba185f4c/miopages-delivery-0.0.10-lf.zip", OLD_PLUGIN_SHA, PLUGIN.name)
    check(inventory(PLUGIN) == old)
    check(sha((THEME / "style.css").read_bytes()) == OLD_STYLE_SHA)


def replace_config(data, mode, group):
    temp = RUN / "wp-config.swap.php"
    safe_write(temp, data)
    os.chown(temp, -1, group)
    temp.chmod(mode)
    invoke(PHP, "-l", str(temp))
    os.replace(temp, CONFIG)
    check(CONFIG.read_bytes() == data)


def install():
    global stage
    stage = "prior-configuration-and-content"
    baseline()
    next_plugin = release(RUN / "Delivery-0.0.12.zip", PLUGIN_SHA, PLUGIN.name)
    next_theme = release(RUN / "Managed-Site-0.1.0.zip", THEME_SHA, THEME.name)
    check(len(next_plugin) == 15 and len(next_theme) == 7)
    check(sha(next_theme["style.css"]) == "63ca01aa82d2f2872ac327caf6b09faba123299bc7d0a1b77dde91eabb8b1df1")
    check(all(d.stat().st_dev == RUN.stat().st_dev for d in (CONFIG, PLUGIN, THEME)))
    before = CONFIG.read_bytes()
    check(before.startswith(b"<?php") and b"MIOPAGES_NATIVE_DRAFT" not in before)
    info = CONFIG.stat()
    swap = (("plugin", PLUGIN, next_plugin), ("theme", THEME, next_theme))
    for name, _, contents in swap:
        stage_tree(RUN / (name + ".new"), contents)
    MEDIA.mkdir(mode=0o700)
    hook = (
        "\n/* MioPages approved private visual staging media. */\n"
        "if (!defined('MIOPAGES_NATIVE_DRAFT_IDENTITY')) define('MIOPAGES_NATIVE_DRAFT_IDENTITY', "
        "['installationId'=>'" + INSTALLATION + "']);\n"
        "if (!defined('MIOPAGES_NATIVE_DRAFT_MEDIA_DIRECTORY')) define('MIOPAGES_NATIVE_DRAFT_MEDIA_DIRECTORY', "
        "'" + str(MEDIA) + "');\n"
        "if (!defined('MIOPAGES_PRIVATE_PULL')) define('MIOPAGES_PRIVATE_PULL', ['documentRoot'=>'" + str(DOC) + "']);\n"
    ).encode("ascii")
    stage = "swap-exact-private-renderer"
    moved = []
    config_started = False
    try:
        for name, live, contents in swap:
            old = RUN / (name + ".before")
            live.rename(old)
            moved.append((name, live, old))
            (RUN / (name + ".new")).rename(live)
            check(inventory(live) == contents)
        config_started = True
        replace_config(before[:5] + hook + before[5:], stat.S_IMODE(info.st_mode), info.st_gid)
        check(wp("plugin", "get", PLUGIN.name, "--field=version").strip() == b"0.0.12")
        check(wp("--skip-plugins", "--skip-themes", "eval-file", str(STATE)) == (RUN / "baseline-inventory.json").read_bytes())
        guarded(MEDIA, 0o700, True)
        check(wp("eval", "echo defined('MIOPAGES_NATIVE_DRAFT_MEDIA_DIRECTORY') ? 'ready' : 'missing';").strip() == b"ready")
    except (OSError, RuntimeError, ValueError, subprocess.TimeoutExpired):
        stage = "restore-after-install-failure"
        if config_started and CONFIG.read_bytes() != before:
            replace_config(before, stat.S_IMODE(info.st_mode), info.st_gid)
        for name, live, old in reversed(moved):
            if live.exists():
                live.rename(RUN / (name + ".failed"))
            old.rename(live)
        baseline()
        raise


def run():
    global stage
    os.umask(0o077)
    check(Path.home().resolve() == HOME)
    guarded(ROOT, 0o700, True)
    guarded(RUN, 0o700, True)
    guarded(ROOT / "cli-config.php", 0o600)
    os.chdir(RUN)
    check(len(sys.argv) == 2)
    operation = sys.argv[1]
    if operation == "verify-backup":
        baseline()
    elif operation == "install":
        install()
    elif operation in ("verify-apply", "verify-rollback", "verify-restored"):
        stage = operation
        if operation == "verify-rollback":
            envelope = sys.stdin.buffer.read(1_048_577)
            check(0 < len(envelope) <= 1_048_576)
            safe_write(RUN / "rollback-check.json", envelope)
        sys.stdout.buffer.write(wp("eval-file", str(RUN / "wordpress-stage-c0-visual-readback.php"), operation, scoped=True))
        return
    elif operation in ("apply", "retry", "restore"):
        stage = "incoming-" + operation
        data = sys.stdin.buffer.read(4_000_001)
        check(0 < len(data) <= 4_000_000)
        safe_write(RUN / (operation + ".json"), data)
        wire = read_json(data)
        check(wp("plugin", "get", PLUGIN.name, "--field=version").strip() == b"0.0.12")
        if operation == "restore":
            envelope = wire
        else:
            check(set(wire) == {"envelope", "copies"} and len(wire["copies"]) == 2)
            envelope = wire["envelope"]
            for copy in wire["copies"]:
                check(set(copy) == {"copyDigest", "bytesBase64"} and re.fullmatch(r"[0-9a-f]{64}", copy["copyDigest"]))
                staged = read_json(wp("miopages", "native-draft-media", scoped=True, data=json.dumps({"envelope": envelope, **copy}).encode()))
                check(staged == {"status": "staged-private", "copyDigest": copy["copyDigest"]})
        stage = "native-draft-" + operation
        receipt = wp("miopages", "native-draft", scoped=True, data=json.dumps(envelope).encode())
        check(set(read_json(receipt)) == {"receiptBase64", "mac"})
        safe_write(RUN / ("receipt-" + operation + ".json"), receipt)
        sys.stdout.buffer.write(receipt)
        return
    else:
        check(False)
    print(json.dumps({"status": "PASS", "operation": operation}))


if __name__ == "__main__":
    try:
        run()
    except (OSError, RuntimeError, ValueError, KeyError, subprocess.TimeoutExpired) as error:
        print(json.dumps({"status": "BLOCKED", "stage": stage, "code": type(error).__name__}), file=sys.stderr)
        raise SystemExit(1)
