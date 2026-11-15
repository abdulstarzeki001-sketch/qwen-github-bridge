import unittest

from app.llm import _bounded_confidence
from app.main import bounded_int
from app.redaction import redact_http_message, redact_source_text
from app.scanners import validate_scope_target


class PR44HardeningTests(unittest.TestCase):
    def test_sensitive_http_json_redaction(self):
        raw = 'POST /api HTTP/1.1\nAuthorization: Bearer PRIVATE_TOKEN_0123456789\n\n{"api_key":"sensitivevalue123","nested":{"password":"mysecret123"}}'
        clean = redact_http_message(raw)
        for value in ("PRIVATE_TOKEN_0123456789", "sensitivevalue123", "mysecret123"):
            self.assertNotIn(value, clean)
        self.assertIn("<redacted:", clean)

    def test_source_redaction(self):
        token = "github_pat_" + "X" * 30
        self.assertNotIn(token, redact_source_text(token))

    def test_bounded_confidence(self):
        self.assertEqual(_bounded_confidence("invalid"), 0)
        self.assertEqual(_bounded_confidence("110"), 100)
        self.assertEqual(bounded_int("invalid"), 0)
        self.assertEqual(bounded_int("-10"), 0)

    def test_target_bounds(self):
        with self.assertRaises(ValueError):
            validate_scope_target("a" * 2049)
        with self.assertRaises(ValueError):
            validate_scope_target("example.com\x7f")


if __name__ == "__main__":
    unittest.main()
