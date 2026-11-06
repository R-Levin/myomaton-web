import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("rollout", Path(__file__).parents[1] / "scripts/public-runtime-rollout.py")
rollout = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rollout)


class RolloutTests(unittest.TestCase):
    def test_failure_reporting_keeps_safe_invariant_and_never_arbitrary_secret_text(self):
        self.assertEqual(rollout.diagnostic(AssertionError("Public app content changed"))["code"], "PUBLIC_CONTENT_MISMATCH")
        result = rollout.diagnostic(RuntimeError("postgresql://user:secret@host/db"))
        self.assertNotIn("secret", json.dumps(result))
        self.assertEqual(result["code"], "ROLLOUT_VALIDATION_FAILED")

    def test_failed_http_stability_check_retains_both_observations(self):
        first = {"status": 200, "sha256": "first", "content": [], "links": []}
        second = {**first, "sha256": "second"}
        with tempfile.TemporaryDirectory() as directory:
            receipt = Path(directory) / "observations.json"
            with patch.object(rollout, "HOSTS", ("example.test",)), patch.object(rollout, "response", side_effect=[first, second]):
                with self.assertRaisesRegex(AssertionError, "Unstable public baseline"):
                    rollout.http_snapshot({"example.test": ["/"]}, receipt)
            saved = json.loads(receipt.read_text())
            self.assertEqual(saved["example.test"]["/"], {"first": first, "second": second})

    def content(self, text):
        parser = rollout.Content()
        parser.feed(text)
        return parser.tokens

    def test_framework_build_locators_do_not_mask_app_or_seo_changes(self):
        old = '<html><head><title>Site</title><link rel="stylesheet" href="/_next/old.css"><script src="/_next/old.js"></script><script type="application/ld+json">{"name":"Site"}</script></head><body><a href="/service">Service</a></body></html>'
        self.assertEqual(self.content(old), self.content(old.replace('/_next/old', '/_next/new')))
        self.assertNotEqual(self.content(old), self.content(old.replace('>Service<', '>Different<')))
        self.assertNotEqual(self.content(old), self.content(old.replace('href="/service"', 'href="/foreign"')))
        self.assertNotEqual(self.content(old), self.content(old.replace('{"name":"Site"}', '{"name":"Other"}')))

    def test_content_mismatch_and_rollback_raw_mismatch_refuse(self):
        before = {"host": {"/": {"status": 200, "sha256": "old", "content": ["same"], "links": []}}}
        after = json.loads(json.dumps(before))
        after["host"]["/"]["sha256"] = "new"
        rollout.compare_http(before, after)
        with self.assertRaises(AssertionError):
            rollout.compare_http(before, after, exact=True)
        after["host"]["/"]["content"] = ["changed"]
        with self.assertRaises(AssertionError):
            rollout.compare_http(before, after)

    def test_archive_integrity_completeness_and_escape_checks(self):
        body = b"approved"
        digest = rollout.hashlib.sha256(body).hexdigest()
        manifest = {"files": {"package.json": {"sha256": digest, "mode": 0o644}}, "symlinks": {}}
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / "test.tar"
            def write(name="package.json", data=body):
                with tarfile.open(archive, "w") as tar:
                    info = tarfile.TarInfo(name)
                    info.mode, info.size = 0o644, len(data)
                    tar.addfile(info, io.BytesIO(data))
            write()
            rollout.verify_archive(archive, manifest)
            write(data=b"tampered")
            with self.assertRaises(AssertionError):
                rollout.verify_archive(archive, manifest)
            write(name="../package.json")
            with self.assertRaises(AssertionError):
                rollout.verify_archive(archive, manifest)
            with tarfile.open(archive, "w"):
                pass
            with self.assertRaises(AssertionError):
                rollout.verify_archive(archive, manifest)

    def test_escaping_link_refuses(self):
        manifest = {"files": {}, "symlinks": {"escape": "../outside"}}
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / "test.tar"
            with tarfile.open(archive, "w") as tar:
                info = tarfile.TarInfo("escape")
                info.type, info.linkname = tarfile.SYMTYPE, "../outside"
                tar.addfile(info)
            with self.assertRaises(AssertionError):
                rollout.verify_archive(archive, manifest)

    def test_pax_long_directory_is_verified_with_its_original_attributes(self):
        name = "public_html/" + "long-package-name/" * 12 + "directory"
        manifest = {name: {"kind": "directory", "mode": 0o755, "uid": 123, "gid": 456}}
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / "test.tar"
            with tarfile.open(archive, "w", format=tarfile.PAX_FORMAT) as tar:
                info = tarfile.TarInfo(name + "/")
                info.type, info.mode, info.uid, info.gid = tarfile.DIRTYPE, 0o755, 123, 456
                tar.addfile(info)
            rollout.verify_archive(archive, manifest, True)
            manifest[name]["uid"] = 999
            with self.assertRaises(AssertionError):
                rollout.verify_archive(archive, manifest, True)


if __name__ == "__main__":
    unittest.main()
