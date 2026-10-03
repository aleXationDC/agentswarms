import importlib.util
import json
import os
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("native_verify", "/opt/axtn/verify.py")
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)

CORRECT = """import math
def normalize_score(value, minimum=0, maximum=100):
    if any(isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x)
           for x in (value, minimum, maximum)) or minimum >= maximum:
        raise ValueError("invalid")
    return min(1, max(0, (value-minimum)/(maximum-minimum)))
"""

class NativeVerifierTests(unittest.TestCase):
    def setUp(self):
        verify.JOB_DEADLINE = time.monotonic() + 30

    def run_profile(self, code):
        with tempfile.TemporaryDirectory() as workspace:
            return verify.verify([{"path": "src/normalize_score.py", "content": code}],
                                 "python-normalization-v1", Path(workspace))

    def test_candidate_pass_and_broken_baseline_fail(self):
        self.assertTrue(self.run_profile(CORRECT)["pass"])
        self.assertFalse(self.run_profile("def normalize_score(*args): return 0\n")["pass"])

    def test_syntax_failure(self):
        result = self.run_profile("def invalid(\n")
        self.assertFalse(result["pass"])
        self.assertNotEqual(result["compileExitCode"], 0)

    def test_candidate_cannot_monkeypatch_parent_assertions(self):
        self.assertFalse(self.run_profile(
            "import unittest\nunittest.TestCase.assertAlmostEqual=lambda *a, **k: None\n"
            "def normalize_score(*args): return 0\n")["pass"])

    def test_stdout_overflow_and_infinite_process_are_bounded(self):
        for code, reason in [
            ("import sys;sys.stdout.write('x'*20000)", "OUTPUT_LIMIT"),
            ("while True: pass", "TIMEOUT"),
        ]:
            started = time.monotonic()
            status, _, actual = verify.command(["/usr/local/bin/python", "-I", "-c", code], "/tmp")
            self.assertNotEqual(status, 0)
            self.assertEqual(actual, reason)
            self.assertLess(time.monotonic() - started, 5)

    def test_candidate_receives_no_callbacks_credentials_or_proxy(self):
        _, output, reason = verify.command(
            ["/usr/local/bin/python", "-I", "-c",
             "import os,json;print(json.dumps(dict(os.environ)))"], "/tmp")
        self.assertIsNone(reason)
        env = json.loads(output)
        self.assertNotIn("NB_INPUTS", env)
        self.assertNotIn("AGENTSWARMS_TOKEN", env)
        self.assertNotIn("HTTPS_PROXY", env)
        self.assertNotIn("OPENAI_API_KEY", env)

    def test_paths_duplicates_and_input_identity_fail_closed(self):
        with tempfile.TemporaryDirectory() as workspace:
            for files in [
                [{"path": "../verify.py", "content": ""}],
                [{"path": "README.md", "content": ""}] * 2,
                [{"path": "README.md", "content": "x"*65537}],
            ]:
                with self.assertRaises(ValueError):
                    verify.write_workspace(Path(workspace), files)
        with patch.dict(os.environ, {"NB_INPUTS": json.dumps({"schema": "unknown"})}):
            with self.assertRaises(ValueError):
                verify.main()

    def test_documentation_contract_has_real_positive_and_negative_results(self):
        with tempfile.TemporaryDirectory() as workspace:
            root = Path(workspace)
            self.assertFalse(verify.verify([], "documentation-v1", root)["pass"])
            self.assertTrue(verify.verify([{"path": "README.md",
                "content": "## Purpose\n## Verification\n## Safety\n"}],
                "documentation-v1", root)["pass"])

if __name__ == "__main__":
    unittest.main()
