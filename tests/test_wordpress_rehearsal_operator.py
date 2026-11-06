import contextlib
import copy
import hashlib
import importlib.util
import io
import json
import pathlib
import subprocess
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("rehearsal_operator", pathlib.Path(__file__).parents[1] / "scripts/wordpress-rehearsal-operator.py")
holder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(holder)


def inputs():
    permissions = [["inspect-site-proposal", "preview-site-proposal", "approve-site-proposal"],
                   ["prepare-site-proposal", "inspect-site-proposal", "preview-site-proposal", "review-private-stage", "enroll", "issue", "revoke"]]
    manifest = {"version": 1, "principals": [{"id": holder.IDS[i], "reference": str(i), "tokenSha256": str(i) * 64,
                 "grants": [{"id": f"grant-{i}-{n}", "permission": p} for n, p in enumerate(permissions[i])]} for i in (0, 1)]}
    candidate = {"binding": {"proposalId": "b6beda24-564c-4e19-9de0-09861ec32f24", "revision": 1,
                 "digest": "fce4a96bd33a4d6ff2e7e50b380e735fe4d1e636a7dd98b2a57f2c40c335662c",
                 "baseFingerprint": "8ffe7283ada7fa2da60ac9848dea557a9189a069183bd44ae72f175e27005bc1",
                 "scope": {k: holder.SITE[k] for k in ("webPresenceId", "managedSiteId")}},
                 "previewDigest": holder.PREVIEW, "previewEvent": "e2d0f346e4060bef9f0c83e3e10268cc3d91ac452c71bc735da8a9c6cb7a3190",
                 "prospectiveProjection": {"pages": [{"path": "/", "title": "Synthetic test"}]}}
    return manifest, candidate


class HolderTests(unittest.TestCase):
    def fixture(self):
        manifest, candidate = inputs()
        calls = []
        def transport(payload):
            calls.append(copy.deepcopy(payload))
            op = payload["operation"]
            if op == "authenticate":
                i = payload["input"]["principal"]
                return {"authenticated": True, "operatorId": holder.IDS[i], "separationVerified": True, "c0AccessRefused": True,
                        "grants": [{"permission": g["permission"], "id": g["id"]} for g in manifest["principals"][i]["grants"]]}
            if op == "approve":
                return {"approvalId": "a" * 64}
            if op == "verify-approval":
                return {"verified": True, "approvalId": "a" * 64, "previewDigest": holder.PREVIEW}
            if op == "review":
                return {"projectionDigest": holder.PROJECTION, "pages": candidate["prospectiveProjection"]["pages"],
                        "releaseId": payload["input"].get("commit", {}).get("releaseId")}
            return {"enrolled": True} if op == "enroll" else {"revoked": True} if op == "revoke" else {"issued": True}
        custody = holder.Custody(manifest, candidate, transport)
        return custody, calls

    def auth(self, c):
        for i in (0, 1):
            c.perform({"operation": "authenticate", "principal": i})

    def approved(self, c):
        self.auth(c)
        c.perform({"operation": "approve"})
        c.perform({"operation": "verify-approval"})

    def test_tokens_memory_only_and_hashes_preserve_identities_grants(self):
        old, candidate = inputs()
        with patch("builtins.open", side_effect=AssertionError("No raw-token files")):
            c = holder.Custody(old, candidate, lambda _: {})
        self.assertNotEqual(c._tokens[0], c._tokens[1])
        for i in (0, 1):
            self.assertEqual(len(bytes.fromhex(c._tokens[i])), 32)
            self.assertEqual(c.manifest["principals"][i]["tokenSha256"], hashlib.sha256(bytes.fromhex(c._tokens[i])).hexdigest())
            self.assertEqual(c.manifest["principals"][i]["grants"], old["principals"][i]["grants"])
            self.assertEqual(c.manifest["principals"][i]["id"], old["principals"][i]["id"])
        self.assertFalse(any(t in json.dumps(c.status()) + json.dumps(c.manifest) for t in c._tokens))

    def test_exact_owner_approval_then_independent_verification_before_review(self):
        c, calls = self.fixture()
        with self.assertRaises(ValueError): c.perform({"operation": "approve"})
        self.auth(c)
        c.perform({"operation": "approve"})
        self.assertEqual(calls[-1]["token"], c._tokens[0])
        self.assertEqual(calls[-1]["input"]["previewDigest"], holder.PREVIEW)
        self.assertEqual(calls[-1]["input"]["binding"], c.candidate["binding"])
        with self.assertRaises(ValueError): c.perform({"operation": "review"})
        c.perform({"operation": "verify-approval"})
        with self.assertRaises(ValueError): c.perform({"operation": "commit-review"})
        c.perform({"operation": "review"})
        self.assertEqual(calls[-1]["token"], c._tokens[1])
        self.assertNotIn("commit", calls[-1]["input"])
        c.perform({"operation": "commit-review"})
        self.assertEqual(calls[-1]["input"]["commit"], {"releaseId": c.release_id, "projectionDigest": holder.PROJECTION})

    def test_fixed_enrollment_issuance_revocation_and_no_post_revocation_issue(self):
        c, calls = self.fixture(); self.approved(c)
        with self.assertRaises(ValueError): c.perform({"operation": "issue"})
        c.perform({"operation": "review"}); c.perform({"operation": "commit-review"})
        c.perform({"operation": "enroll", "publicKeyBase64": "test", "keyId": "initial"})
        enrollment = calls[-1]["input"]
        self.assertEqual(enrollment["origin"], "https://miopages.org")
        self.assertEqual(enrollment["managedSiteId"], holder.SITE["managedSiteId"])
        c.perform({"operation": "issue"})
        self.assertEqual(calls[-1]["input"], {"installationId": c.installation_id, "releaseId": c.release_id})
        self.assertEqual(calls[-1]["token"], c._tokens[1])
        c.perform({"operation": "revoke"})
        with self.assertRaises(ValueError): c.perform({"operation": "issue"})

    def test_no_general_code_tokens_paths_or_candidate_override_interface(self):
        c, calls = self.fixture(); self.auth(c)
        for request in [{"operation": op} for op in ("exec", "eval", "publish", "read-signer", "export", "rotate", "prepare")] + [
            {"operation": "approve", "principal": 1}, {"operation": "approve", "input": {}},
            {"operation": "issue", "signingKeyFile": "/other"}, {"operation": "authenticate", "principal": True}]:
            before = len(calls)
            with self.assertRaises(ValueError): c.perform(request)
            self.assertEqual(len(calls), before)
        command = holder.remote_dispatch_command(holder.HOME + "/miopages-wp-principals-20261106T170000Z")
        self.assertIn("scripts/wordpress-rehearsal-dispatch.ts", command)
        self.assertNotIn(" -e ", command)
        self.assertFalse(any(t in command for t in c._tokens))
        with self.assertRaises(ValueError): holder.remote_dispatch_command(holder.HOME + "/x;other")

    def test_wrong_authentication_projection_and_secret_echo_refuse(self):
        c, _ = self.fixture()
        c._transport = lambda _: {"authenticated": True, "operatorId": holder.IDS[1]}
        with self.assertRaises(ValueError): c.perform({"operation": "authenticate", "principal": 0})
        c, _ = self.fixture(); self.approved(c)
        c._transport = lambda _: {"projectionDigest": "f" * 64, "pages": []}
        with self.assertRaises(ValueError): c.perform({"operation": "review"})
        self.assertFalse(c.status()["reviewCommitted"])
        c._transport = lambda _: {"leak": c._tokens[0]}
        with self.assertRaises(ValueError): c.perform({"operation": "authenticate", "principal": 0})

    def test_main_failure_freezes_remote_operations_and_keeps_sanitized_status(self):
        m, p = inputs(); mb = json.dumps(m).encode(); pb = json.dumps(p).encode(); calls = []
        def run(args, **kw):
            calls.append((args, kw))
            response = mb if len(calls) == 1 else pb if len(calls) == 2 else b""
            return subprocess.CompletedProcess(args, 1 if len(calls) == 4 else 0, response, b"do-not-print-error")
        lines = io.StringIO('{"operation":"authenticate","principal":0}\n{"operation":"approve"}\n{"operation":"status"}\n')
        output = io.StringIO()
        with patch.object(holder, "OLD_HASH", hashlib.sha256(mb).hexdigest()), patch.object(holder, "PREVIEW_HASH", hashlib.sha256(pb).hexdigest()), \
                patch.object(holder.subprocess, "run", side_effect=run), patch.object(holder.sys, "argv", ["holder", "--approved-continuation-0fcb7d0"]), \
                patch.object(holder.sys, "stdin", lines), contextlib.redirect_stdout(output):
            holder.main()
        self.assertEqual(len(calls), 4)  # Three startup reads/stage calls; one refused auth, no approval/retry.
        self.assertIn('"status": "BLOCKED"', output.getvalue())
        self.assertNotIn("do-not-print-error", output.getvalue())
        for args, _ in calls: self.assertNotIn("token", " ".join(args))

    def test_approval_can_be_reconciled_read_only_without_replaying_uncertain_write(self):
        c, calls = self.fixture(); self.auth(c)
        c.perform({"operation": "verify-approval"})
        self.assertEqual(c.status()["approvalId"], "a" * 64)
        self.assertTrue(c.status()["approvalVerified"])
        self.assertEqual(calls[-1]["operation"], "verify-approval")
        self.assertFalse(any(p["operation"] == "approve" for p in calls))

    def test_explicit_resume_is_local_only_and_never_a_retry(self):
        m, p = inputs(); mb = json.dumps(m).encode(); pb = json.dumps(p).encode(); calls = []
        def run(args, **kw):
            calls.append(args)
            response = mb if len(calls) == 1 else pb if len(calls) == 2 else b""
            return subprocess.CompletedProcess(args, 1 if len(calls) == 4 else 0, response, b"")
        lines = io.StringIO('{"operation":"authenticate","principal":0}\n' + json.dumps({"operation": "resume-after-review",
            "reviewedCheckpoint": "a" * 40, "acknowledgment": "EXPLICIT-OPERATOR-REVIEW-COMPLETE"}) + '\n{"operation":"status"}\n')
        output = io.StringIO()
        with patch.object(holder, "OLD_HASH", hashlib.sha256(mb).hexdigest()), patch.object(holder, "PREVIEW_HASH", hashlib.sha256(pb).hexdigest()), \
                patch.object(holder.subprocess, "run", side_effect=run), patch.object(holder.sys, "argv", ["holder", "--approved-continuation-0fcb7d0"]), \
                patch.object(holder.sys, "stdin", lines), contextlib.redirect_stdout(output):
            holder.main()
        self.assertEqual(len(calls), 4)
        self.assertIn('"remoteOperationPerformed": false', output.getvalue())


if __name__ == "__main__":
    unittest.main()
