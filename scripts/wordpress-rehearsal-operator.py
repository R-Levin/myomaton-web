"""Approved fixed Core CLI custody. Tokens stay in this foreground process only.

No arbitrary remote command/code, token export, dynamic reload or debugger API.
Startup stages only a hash manifest; each later operation is explicitly requested.
"""
import copy
import datetime
import hashlib
import json
import pathlib
import re
import secrets
import shlex
import subprocess
import sys
import uuid

HOME = "/home/virtual/vps-bef564/5/53b4381d42"
OLD_ROOT = HOME + "/miopages-wp-principals-20261106T144226Z"
OLD_HASH = "6c7cb17cfd45b4fb48c63e17e1327455ed09981e0f1d03cde45b13b753644384"
PREVIEW_HASH = "6feef09c0b96b5ae89be4f577b7a4186abef3c2239f8bea4f522ae137d27cf91"
PREVIEW = "10692cea76d3afb3eb825d7eaabfa53fbf73c8b4f7e9abdf07dda86c38548bd3"
PROJECTION = "f71a65739ec0b18d75516b27584d4042446e9c4df8721f0d49b346cef5f1327e"
SITE = {"organizationId": "b3b46645-0364-4329-83c7-86a6ea9e56c4",
        "webPresenceId": "819d007a-595d-4374-a2f0-96b900d46559", "managedSiteId": "1d92a248-416f-4e22-baaf-d2f1fca70352"}
IDS = ["72bb2f38-28d7-4d3c-bea6-72540bf3d603", "c606cd74-b587-4248-8cba-3df6718fefec"]
REMOTE_OPERATIONS = frozenset(["authenticate", "approve", "verify-approval", "review", "enroll", "issue", "revoke"])


class Custody:
    def __init__(self, manifest, candidate, transport):
        if [p["id"] for p in manifest["principals"]] != IDS:
            raise ValueError("Exact existing operator IDs required")
        b = candidate["binding"]
        if (candidate["previewDigest"] != PREVIEW or b["proposalId"] != "b6beda24-564c-4e19-9de0-09861ec32f24" or b["revision"] != 1
                or b["digest"] != "fce4a96bd33a4d6ff2e7e50b380e735fe4d1e636a7dd98b2a57f2c40c335662c"
                or b["baseFingerprint"] != "8ffe7283ada7fa2da60ac9848dea557a9189a069183bd44ae72f175e27005bc1"):
            raise ValueError("Exact owner-approved candidate required")
        self.manifest, self.candidate = copy.deepcopy(manifest), copy.deepcopy(candidate)
        self._tokens = [secrets.token_hex(32), secrets.token_hex(32)]
        for p, token in zip(self.manifest["principals"], self._tokens):
            p["tokenSha256"] = hashlib.sha256(bytes.fromhex(token)).hexdigest()
        self._transport = transport
        self._authenticated = set()
        self._approval = self._projection = None
        self._approval_verified = self._review_committed = self._enrolled = self._revoked = False
        self.release_id, self.installation_id, self.credential_id = [str(uuid.uuid4()) for _ in range(3)]
        self._approval_request_id = str(uuid.uuid4())

    def status(self):
        return {"operatorIds": IDS, "authenticated": sorted(self._authenticated), "approvalId": self._approval,
                "approvalVerified": self._approval_verified, "reviewCommitted": self._review_committed,
                "enrolled": self._enrolled, "revoked": self._revoked, "privateReleaseId": self.release_id,
                "installationId": self.installation_id, "credentialId": self.credential_id}

    def _call(self, payload):
        if payload["operation"] not in REMOTE_OPERATIONS:
            raise ValueError("Fixed operation required")
        result = self._transport(payload)
        encoded = json.dumps(result)
        if any(t in encoded for t in self._tokens) or "PRIVATE KEY-----" in encoded:
            raise ValueError("Secret output refused")
        return result

    def perform(self, request):
        op = request["operation"]
        if op == "status" and set(request) == {"operation"}:
            return self.status()
        if op == "authenticate" and set(request) == {"operation", "principal"} and type(request["principal"]) is int and request["principal"] in (0, 1):
            i = request["principal"]
            result = self._call({"token": self._tokens[i], "operation": op, "input": {"principal": i}})
            expected = self.manifest["principals"][i]
            if (result.get("authenticated") is not True or result.get("operatorId") != IDS[i]
                    or result.get("separationVerified") is not True or result.get("c0AccessRefused") is not True
                    or result.get("grants") != [{"permission": g["permission"], "id": g["id"]} for g in expected["grants"]]):
                raise ValueError("Independent exact authentication required")
            self._authenticated.add(i)
            return result
        if self._authenticated != {0, 1}:
            raise ValueError("Both separate authentications required")
        if op == "approve" and set(request) == {"operation"}:
            i, core_op = 0, "approve"
            value = {"binding": self.candidate["binding"], "previewDigest": PREVIEW, "previewEvent": self.candidate["previewEvent"],
                     "requestId": self._approval_request_id,
                     "reference": "Owner reviewed actual HTML/JSON and explicitly approved exact b6beda24 revision1 / preview10692cea76d3afb3eb825d7eaabfa53fbf73c8b4f7e9abdf07dda86c38548bd3 solely for the nonpublic HTTPS rehearsal."}
        elif op == "verify-approval" and set(request) == {"operation"}:
            i, core_op, value = 0, op, {}
        elif op in ("review", "commit-review") and set(request) == {"operation"} and self._approval_verified:
            i, core_op = 1, "review"
            value = {"site": SITE, "proposalId": self.candidate["binding"]["proposalId"], "approvalId": self._approval}
            if op == "commit-review":
                if self._projection != PROJECTION:
                    raise ValueError("Inspect exact projection before commit")
                value["commit"] = {"releaseId": self.release_id, "projectionDigest": PROJECTION}
        elif op == "enroll" and set(request) == {"operation", "publicKeyBase64", "keyId"} and self._review_committed and not self._revoked:
            i, core_op = 1, op
            value = {**SITE, "installationId": self.installation_id, "credentialId": self.credential_id,
                     "origin": "https://miopages.org", "keyId": request["keyId"], "publicKeyBase64": request["publicKeyBase64"]}
        elif op in ("issue", "revoke") and set(request) == {"operation"} and self._enrolled and self._review_committed and not self._revoked:
            i, core_op = 1, op
            value = {"installationId": self.installation_id}
            if op == "issue":
                value["releaseId"] = self.release_id
        else:
            raise ValueError("Unsupported operation, extra fields or unmet gate")
        result = self._call({"token": self._tokens[i], "operation": core_op, "input": value})
        if op == "approve":
            if not re.fullmatch(r"[a-f0-9]{64}", result.get("approvalId", "")):
                raise ValueError("Durable approval result required")
            self._approval = result["approvalId"]
        elif op == "verify-approval":
            actual = result.get("approvalId", "")
            if (result.get("verified") is not True or not re.fullmatch(r"[a-f0-9]{64}", actual)
                    or (self._approval and actual != self._approval) or result.get("previewDigest") != PREVIEW):
                raise ValueError("Independent durable approval verification required")
            self._approval = actual
            self._approval_verified = True
        elif op in ("review", "commit-review"):
            if result.get("projectionDigest") != PROJECTION or result.get("pages") != self.candidate["prospectiveProjection"]["pages"]:
                raise ValueError("Changed exact projection")
            self._projection = PROJECTION
            if op == "commit-review":
                if result.get("releaseId") != self.release_id:
                    raise ValueError("Exact committed review required")
                self._review_committed = True
        elif op == "enroll":
            if result.get("enrolled") is not True:
                raise ValueError("Enrollment refused")
            self._enrolled = True
        elif op == "revoke":
            if result.get("revoked") is not True:
                raise ValueError("Revocation refused")
            self._revoked = True
        return result


def remote_dispatch_command(root):
    if not re.fullmatch(re.escape(HOME) + r"/miopages-wp-principals-[0-9TZ]+", root):
        raise ValueError("Protected fixed root required")
    return ("cd " + shlex.quote(HOME + "/miopages-wp-rehearsal") + ' && env -i HOME="$HOME" PATH="$PATH" NODE_ENV=production '
            + "WP_REHEARSAL_PRIVATE_ROOT=" + shlex.quote(root) + " node --import tsx scripts/wordpress-rehearsal-dispatch.ts")


def main():
    if sys.argv[1:] != ["--approved-continuation-0fcb7d0"]:
        raise ValueError("Explicit approved continuation required")
    ssh = ["ssh", "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=yes", "-o", "ConnectTimeout=10",
           "-i", str(pathlib.Path.home() / ".ssh/miopages_20i"), "-p", "39304", "runtime.miopages.com@ssh.iad.stackcp.com"]
    def remote(command, data=b""):
        r = subprocess.run(ssh + [command], input=data, capture_output=True, timeout=50)
        if r.returncode:
            raise RuntimeError("Protected command refused; inspect outcome before retry")
        return r.stdout
    old = remote("cat " + shlex.quote(OLD_ROOT + "/manifest.json"))
    candidate = remote("cat " + shlex.quote(OLD_ROOT + "/candidate-preview.json"))
    if hashlib.sha256(old).hexdigest() != OLD_HASH or hashlib.sha256(candidate).hexdigest() != PREVIEW_HASH:
        raise ValueError("Reviewed source checksums required")
    root = HOME + "/miopages-wp-principals-" + datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    def transport(payload):
        return json.loads(remote(remote_dispatch_command(root), json.dumps(payload).encode()))
    custody = Custody(json.loads(old), json.loads(candidate), transport)
    manifest = (json.dumps(custody.manifest, indent=2) + "\n").encode()
    # The only staged secret-related artifact is a hash-only manifest, mode0600.
    code = "import pathlib,os,sys;p=pathlib.Path(" + repr(root) + ");p.mkdir(mode=0o700);f=os.open(str(p/'manifest.json'),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600);os.write(f,sys.stdin.buffer.read());os.close(f)"
    remote("python3 -c " + shlex.quote(code), manifest)
    print(json.dumps({"status": "AWAITING_OPERATOR_REKEY", "manifest": root + "/manifest.json",
                      "sha256": hashlib.sha256(manifest).hexdigest(), **custody.status()}), flush=True)
    blocked = False
    for line in sys.stdin:
        try:
            request = json.loads(line)
            if (blocked and set(request) == {"operation", "reviewedCheckpoint", "acknowledgment"}
                    and request["operation"] == "resume-after-review"
                    and re.fullmatch(r"[a-f0-9]{40}", request["reviewedCheckpoint"])
                    and request["acknowledgment"] == "EXPLICIT-OPERATOR-REVIEW-COMPLETE"):
                # Local control only, never an automatic retry or a Core call.
                # Use only after independent inspection and an operator decision.
                blocked = False
                print(json.dumps({"status": "RESUMED_AFTER_EXPLICIT_REVIEW", "remoteOperationPerformed": False}), flush=True)
                continue
            if blocked and request != {"operation": "status"}:
                raise ValueError("Stopped after failure")
            print(json.dumps({"result": custody.perform(request)}), flush=True)
        except Exception:
            blocked = True  # Retain custody, but execute no more remote operations.
            print(json.dumps({"status": "BLOCKED", "requirement": "Stop and independently inspect. Tokens retained in memory; no automatic retry or credential change."}), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print(json.dumps({"status": "BLOCKED", "requirement": "Startup refused. No database operation attempted."}), flush=True)
        raise SystemExit(1)
