"""Relay only the exact signed envelopes and matching receipts over pinned SSH."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess

CLOUD = "runtime.miopages.com@ssh.iad.stackcp.com"
WORDPRESS = "miopages.org@ssh.us.stackcp.com"
CORE_RUN = "$HOME/miopages-wp-review-1333ddc4/apply-ba185f4c"
CORE_TOOL = "$HOME/miopages-wp-rehearsal/review-ba185f4c"
WP_RUN = "$HOME/miopages-private/native-draft-d84ebc69-46d5-4c64-adc6-ac7b87468f89/apply-ba185f4c"
APPROVAL = "ba185f4c51f60e04c787678df9722ecbf76445596840f23d11f668b753433646"
REVISION_3 = "85786f251ed5b93e42d9ae2b8c7247d85d99280aa9b1bc5932a1321330a043db"
REVISION_4 = "1a6343c049c0430e51ef7fa3780123c9475352af0328301d661a38a9b500eb2a"
BASELINE = [
    "960fea54ac23eb52c15eb9aedec4e84023903c845160942ebc96256b58999940",
    "90c4917bfe9fa5fd7d478df98a972c6cfd26050e47d54a0c735ef369d9cbc39e",
]
PROPOSED = [
    "9a2a218c24ab25bd5f31c6122617f28786ea705a6db9d91d81f8d1bde2d2816b",
    "eb3c0a43811f6c6f882317ede97c8e8e0cdbfc8b6d4c513fef12a6b91ab75b5f",
]
HOME, SERVICE = [f"https://miopages.org/?page_id={i}&preview=true" for i in (13, 14)]
STAGE = "startup"


def ssh(account, command, *, data=None):
    port, key = (39304, "miopages_20i") if account == CLOUD else (22, "miopages_wp_20i")
    path = Path(os.environ["USERPROFILE"]) / ".ssh" / key
    result = subprocess.run(
        ["ssh", "-T", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes",
         "-o", "ConnectTimeout=8", "-o", "ServerAliveInterval=8", "-o", "ServerAliveCountMax=2",
         "-i", str(path), "-p", str(port), account, command],
        input=data, capture_output=True, timeout=65, check=False,
    )
    if result.returncode != 0:
        raise RuntimeError("Remote step stopped")
    return result.stdout


def require(condition):
    if not condition:
        raise ValueError("Readback mismatch")


def inspect(digest, revision, high_water, restored, hashes, links):
    data = json.loads(ssh(WORDPRESS, f'bash "{WP_RUN}/wordpress-v15-development.sh" read'))
    require((data["digest"], data["revision"], data["highWater"], data["restoredFrom"]) ==
            (digest, revision, high_water, restored))
    require(data["pageIds"] == [2, 3, 13, 14, 15, 16] and data["theme"] == "miopages-managed-site")
    require([(p["id"], p["slug"], p["status"], p["sha256"], p["links"]) for p in data["posts"]] == [
        (13, "home-miopages-13", "draft", hashes[0], links[0]),
        (14, "service-miopages-14", "draft", hashes[1], links[1]),
    ])
    return data


def core(mode):
    return json.loads(ssh(CLOUD, f'cd "{CORE_TOOL}" && node --import tsx scripts/wordpress-apply-v15.ts {mode}'))


def transfer(mode, digest):
    operation = "apply" if mode == "retry" else mode
    envelope = ssh(CLOUD, f'cat "{CORE_RUN}/{operation}.json"')
    require(len(envelope) <= 1048576 and json.loads(envelope)["version"] == 2)
    wire = ssh(WORDPRESS, f'bash "{WP_RUN}/wordpress-v15-development.sh" {mode} {digest}', data=envelope)
    require(len(wire) < 20000 and set(json.loads(wire)) == {"receiptBase64", "mac"})
    ssh(CLOUD, f'umask 077; set -o noclobber; cat >"{CORE_RUN}/received-{mode}.json"', data=wire)


def run():
    global STAGE
    STAGE = "approval-evidence"
    approved = json.loads(ssh(CLOUD, f'cat "{CORE_RUN}/approval-evidence.json"'))
    digest = approved["candidateDigest"]
    require(re.fullmatch("[a-f0-9]{64}", digest) and approved["status"] == "PASS" and approved["scope"] == APPROVAL)
    baseline_links = [[HOME, SERVICE, SERVICE], [HOME, SERVICE]]
    proposed_links = [[HOME, SERVICE, SERVICE], [HOME, SERVICE, HOME]]
    STAGE = "baseline-readback"
    baseline = inspect(REVISION_3, 3, 4, REVISION_4, BASELINE, baseline_links)
    STAGE = "plugin-install"
    plugin = json.loads(ssh(WORDPRESS, f'bash "{WP_RUN}/wordpress-v15-development.sh" install'))
    require(plugin == {"version": "0.0.10", "status": "active"})
    STAGE = "post-install-readback"
    require(inspect(REVISION_3, 3, 4, REVISION_4, BASELINE, baseline_links) == baseline)
    STAGE = "issue"
    result = core("issue")
    require(result["status"] == "PASS" and result["candidateDigest"] == digest)
    STAGE = "apply"
    transfer("apply", digest)
    applied = inspect(digest, 5, 5, None, PROPOSED, proposed_links)
    STAGE = "retry"
    transfer("retry", digest)
    require(inspect(digest, 5, 5, None, PROPOSED, proposed_links) == applied)
    STAGE = "reconcile-apply"
    applied_receipt = core("reconcile-apply")
    require(applied_receipt["status"] == "PASS" and applied_receipt["appliedDigest"] == digest and applied_receipt["revision"] == 5)
    STAGE = "restore"
    transfer("restore", digest)
    restored = inspect(REVISION_3, 3, 5, digest, BASELINE, baseline_links)
    STAGE = "reconcile-restore"
    restored_receipt = core("reconcile-restore")
    require(restored_receipt["status"] == "PASS" and restored_receipt["appliedDigest"] == REVISION_3 and restored_receipt["revision"] == 3)
    print(json.dumps({"status": "PASS", "scope": APPROVAL, "candidateDigest": digest, "plugin": plugin,
                      "before": baseline, "applied": applied, "restored": restored, "exactRetry": True,
                      "applyReceipt": applied_receipt, "restoreReceipt": restored_receipt}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("scope", choices=[APPROVAL])
    parser.parse_args()
    try:
        run()
    except (KeyError, ValueError, RuntimeError, OSError, subprocess.TimeoutExpired) as error:
        print(json.dumps({"status": "BLOCKED", "stage": STAGE, "code": type(error).__name__}))
        raise SystemExit(1)
