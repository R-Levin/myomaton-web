import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location(
    "wordpress_http_baseline", Path(__file__).resolve().parent.parent / "scripts/wordpress-http-baseline.py"
)
baseline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(baseline)


class ProtectedBaselineTests(unittest.TestCase):
    def receipt(self):
        return {"status": "PASS", "origin": "https://miopages.org",
                "authenticatedHttpBaseline": {"httpStatus": 200, "bytes": 123, "bodySha256": "a" * 64},
                "consecutiveResponses": 2, "verifiedTls": True, "hostedWrites": 0, "credentialsStored": False}

    def test_secret_only_on_utf8_stdin_and_unknown_fields_not_saved(self):
        secret = "synthetic-π-%-password"
        receipt = self.receipt()
        receipt["unexpectedSecret"] = secret
        calls = []

        def relay(args, **kwargs):
            calls.append(args)
            self.assertNotIn(secret, " ".join(args))
            self.assertIn("/usr/php84/usr/bin/php", args[-1])
            self.assertIn("StrictHostKeyChecking=yes", args)
            self.assertEqual(json.loads(kwargs["input"]), {"user": "test-user", "password": secret})
            return subprocess.CompletedProcess(args, 0, json.dumps(receipt).encode(), b"")

        evidence = baseline.capture_baseline("test-user", secret, relay)
        self.assertEqual(len(calls), 1)
        self.assertNotIn(secret, json.dumps(evidence))
        self.assertNotIn("unexpectedSecret", evidence)

    def test_missing_credential_refuses_without_any_ssh_call(self):
        def relay(*args, **kwargs):
            self.fail("Missing credentials must not start SSH")

        for user, password in [("", "secret"), ("user", ""), ("invalid:user", "secret")]:
            with self.assertRaises(ValueError):
                baseline.capture_baseline(user, password, relay)

    def test_failed_relay_is_not_retried_and_raw_stderr_is_not_exposed(self):
        calls = []

        def relay(args, **kwargs):
            calls.append(args)
            return subprocess.CompletedProcess(args, 1, b"", b"secret-password private-response")

        with self.assertRaises(RuntimeError) as failure:
            baseline.capture_baseline("user", "secret-password", relay)
        self.assertEqual(len(calls), 1)
        self.assertNotIn("secret-password", str(failure.exception))
        self.assertNotIn("private-response", str(failure.exception))

    def test_receipt_refuses_wrong_origin_tls_writes_or_credential_storage(self):
        for field, value in [("status", "BLOCKED"), ("origin", "http://miopages.org"),
                             ("verifiedTls", False), ("hostedWrites", 1), ("credentialsStored", True),
                             ("consecutiveResponses", 1)]:
            receipt = self.receipt()
            receipt[field] = value
            with self.subTest(field=field):
                with self.assertRaises(RuntimeError):
                    baseline.capture_baseline("user", "secret", lambda *args, **kwargs:
                        subprocess.CompletedProcess(args, 0, json.dumps(receipt).encode(), b""))

    def test_receipt_refuses_failed_status_invalid_hash_or_unbounded_body(self):
        for field, value in [("httpStatus", 401), ("bodySha256", "private-response"), ("bytes", 0), ("bytes", 8388609)]:
            receipt = self.receipt()
            receipt["authenticatedHttpBaseline"][field] = value
            with self.subTest(field=field):
                with self.assertRaises(RuntimeError):
                    baseline.capture_baseline("user", "secret", lambda *args, **kwargs:
                        subprocess.CompletedProcess(args, 0, json.dumps(receipt).encode(), b""))


if __name__ == "__main__":
    unittest.main()
