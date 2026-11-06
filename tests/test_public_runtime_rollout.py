import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("rollout", Path(__file__).parents[1] / "scripts/public-runtime-rollout.py")
rollout = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rollout)


class RolloutTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
