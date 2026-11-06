import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("loopback", Path(__file__).parents[1] / "scripts/public-runtime-loopback.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class LoopbackTests(unittest.TestCase):
    def test_only_exact_loopback_and_owned_listener_pass(self):
        m.check_binding('LISTEN 0 511 127.0.0.1:8081 0.0.0.0:* users:(("node",pid=123,fd=4))', {123: {}})
        for address in ('0.0.0.0:8081', '*:8081', '[::]:8081', '127.0.0.1:8080'):
            with self.assertRaises(m.Gate):
                m.check_binding('LISTEN 0 511 ' + address + ' *:* users:(("node",pid=123,fd=4))', {123: {}})
        with self.assertRaises(m.Gate):
            m.check_binding('LISTEN 0 511 127.0.0.1:8081 *:* users:(("node",pid=456,fd=4))', {123: {}})

    def test_differences_are_exact_positions_without_response_strings(self):
        first = {"status": 200, "links": ["/service"], "content": [["text", "old"]]}
        second = {"status": 200, "links": ["/service"], "content": [["text", "credential-shaped-sensitive-value"]]}
        result = m.differences(first, second)
        self.assertEqual(result[0]["field"], "content")
        self.assertEqual(result[0]["positions"][0]["index"], 0)
        self.assertNotIn("sensitive", str(result))
        self.assertEqual(m.differences(first, first), [])

    def test_resource_boundary_values_refuse_at_the_required_limits(self):
        self.assertIsNone(m.resource_failure(m.MAX_RSS, m.MIN_AVAILABLE, 0))
        self.assertEqual(m.resource_failure(m.MAX_RSS + 1, m.MIN_AVAILABLE, 0), "RSS_LIMIT")
        self.assertEqual(m.resource_failure(0, m.MIN_AVAILABLE - 1, 0), "MEMORY_FLOOR")
        self.assertEqual(m.resource_failure(0, m.MIN_AVAILABLE, 115), "DEADLINE")

    def test_foreign_or_absent_session_is_never_signaled(self):
        with patch.object(m, "group_members", return_value={}), patch.object(m.os, "killpg") as kill:
            m.terminate_group(123, m.signal.SIGKILL)
            kill.assert_not_called()


if __name__ == "__main__":
    unittest.main()
