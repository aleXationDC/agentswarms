"""Pinned native assertions outside the untrusted candidate subprocess."""
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import selectors
import signal
import subprocess
import sys
import tempfile
import time
import unittest

MAX_INPUT = 131072
MAX_FILES = 20
MAX_FILE = 65536
MAX_OUTPUT = 16384
TIMEOUT = 3
JOB_DEADLINE = time.monotonic() + 30
PATH = re.compile(r"(?:src/[A-Za-z0-9_-]+\.py|tests/[A-Za-z0-9_-]+\.py|docs/[A-Za-z0-9_-]+\.md|README\.md)")
CHILD_ENV = {"PATH": "/usr/local/bin:/usr/bin:/bin", "PYTHONDONTWRITEBYTECODE": "1",
             "PYTHONUNBUFFERED": "1", "HOME": "/tmp"}

def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()

def command(args, cwd, stdin=b""):
    if time.monotonic() >= JOB_DEADLINE:
        return -1, "", "JOB_TIMEOUT"
    process = subprocess.Popen(args, cwd=cwd, env=CHILD_ENV, stdin=subprocess.PIPE,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
    process.stdin.write(stdin)
    process.stdin.close()
    selector = selectors.DefaultSelector()
    selector.register(process.stdout, selectors.EVENT_READ)
    selector.register(process.stderr, selectors.EVENT_READ)
    output = bytearray()
    deadline = min(time.monotonic() + TIMEOUT, JOB_DEADLINE)
    reason = None
    try:
        while selector.get_map():
            if time.monotonic() >= deadline:
                reason = "TIMEOUT"
                break
            for key, _ in selector.select(0.05):
                chunk = os.read(key.fd, 4096)
                if not chunk:
                    selector.unregister(key.fileobj)
                    continue
                if len(output) + len(chunk) > MAX_OUTPUT:
                    reason = "OUTPUT_LIMIT"
                    break
                output.extend(chunk)
            if reason:
                break
        if reason:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        code = process.wait(timeout=1)
        return code, bytes(output).decode("utf-8", errors="replace"), reason
    finally:
        if process.poll() is None:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait(timeout=1)
        selector.close()
        process.stdout.close()
        process.stderr.close()

def write_workspace(directory, files):
    if not isinstance(files, list) or len(files) > MAX_FILES:
        raise ValueError("FILE_COUNT")
    seen = set()
    for file in files:
        if set(file) != {"path", "content"} or not PATH.fullmatch(file["path"]):
            raise ValueError("FILE_PATH")
        if file["path"] in seen or not isinstance(file["content"], str):
            raise ValueError("FILE_IDENTITY")
        seen.add(file["path"])
        if len(file["content"].encode()) > MAX_FILE:
            raise ValueError("FILE_SIZE")
        target = directory / file["path"]
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(file["content"], encoding="utf-8")

class ScoreContract(unittest.TestCase):
    directory = None

    def invoke(self, args):
        code, output, reason = command(
            [sys.executable, "-I", str(Path(__file__).with_name("invoke.py")),
             str(self.directory / "src/normalize_score.py")],
            self.directory, json.dumps({"args": args}).encode())
        self.assertIsNone(reason, reason)
        self.assertEqual(code, 0, "Candidate subprocess failed")
        result = json.loads(output)
        self.assertIsInstance(result, dict)
        return result

    def test_range_and_clamping(self):
        for args, expected in [
            ([0], 0), ([50], .5), ([100], 1), ([-10], 0), ([110], 1),
            ([0, -10, 10], .5), ([5, 0, 10], .5), ([1, 1, 2], 0),
            ([2, 1, 2], 1), ([1.25, 1, 2], .25), ([.1, 0, 1], .1),
        ]:
            with self.subTest(args=args):
                result = self.invoke(args)
                self.assertIs(result.get("ok"), True)
                self.assertNotIsInstance(result.get("value"), bool)
                self.assertTrue(math.isfinite(result["value"]))
                self.assertAlmostEqual(result["value"], expected)

    def test_invalid_inputs(self):
        for args in [[True], ["50"], [None], [50, 100, 0], [1, 1, 1],
                     [float("nan")], [float("inf")], [0, 0, float("inf")]]:
            with self.subTest(args=args):
                result = self.invoke(args)
                self.assertIs(result.get("ok"), False)
                self.assertIn(result.get("errorType"), ["ValueError", "TypeError"])

def verify(files, profile, directory):
    write_workspace(directory, files)
    code, output, reason = command([sys.executable, "-I", "-m", "compileall", "-q", str(directory)], directory)
    if code or reason:
        return {"pass": False, "compileExitCode": code, "reason": reason or "COMPILE_FAILED",
                "outputHash": hashlib.sha256(output.encode()).hexdigest()}
    if profile == "documentation-v1":
        readme = directory / "README.md"
        text = readme.read_text() if readme.exists() else ""
        passed = all(section in text for section in ["## Purpose", "## Verification", "## Safety"])
        return {"pass": passed, "compileExitCode": 0, "testsRun": 3,
                "failures": 0 if passed else 1, "contract": "documentation-v1"}
    ScoreContract.directory = directory
    stream = io.StringIO()
    result = unittest.TextTestRunner(stream=stream).run(
        unittest.defaultTestLoader.loadTestsFromTestCase(ScoreContract))
    return {"pass": result.wasSuccessful(), "compileExitCode": 0, "testsRun": result.testsRun,
            "failures": len(result.failures), "errors": len(result.errors),
            "outputHash": hashlib.sha256(stream.getvalue().encode()).hexdigest(),
            "contract": "python-normalization-v1"}

def main():
    raw = os.environ.get("NB_INPUTS", "")
    if len(raw.encode()) > MAX_INPUT:
        raise ValueError("INPUT_SIZE")
    request = json.loads(raw)
    required = {"schema", "repository", "effectKey", "taskId", "attemptId", "caseId", "baseSHA",
                "candidateSHA", "profile", "baseline", "candidate"}
    if set(request) != required or request["schema"] != "axtn.development.verify/v1":
        raise ValueError("INPUT_SCHEMA")
    if request["repository"] != "aXtn/development-swarm-acceptance":
        raise ValueError("REPOSITORY")
    if request["profile"] not in ["python-normalization-v1", "documentation-v1"]:
        raise ValueError("PROFILE")
    for field in ["baseSHA", "candidateSHA"]:
        if not re.fullmatch("[a-f0-9]{40}", request[field]):
            raise ValueError("REVISION")
    with tempfile.TemporaryDirectory(prefix="axtn-verify-") as workspace:
        base = Path(workspace) / "baseline"; base.mkdir()
        candidate = Path(workspace) / "candidate"; candidate.mkdir()
        baseline_result = verify(request["baseline"], request["profile"], base)
        candidate_result = verify(request["candidate"], request["profile"], candidate)
    return {
        "schema": request["schema"], "effectKey": request["effectKey"],
        "taskId": request["taskId"], "attemptId": request["attemptId"],
        "baseSHA": request["baseSHA"], "candidateSHA": request["candidateSHA"],
        "inputHash": digest(request), "harnessHash": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "baseline": baseline_result, "candidate": candidate_result,
        "gateVerdict": "PASS" if candidate_result["pass"] else "FAIL",
    }

if __name__ == "__main__":
    try:
        envelope = main()
    except (ValueError, TypeError, KeyError) as error:
        print(json.dumps({"schema": "axtn.development.verify/v1", "gateVerdict": "FAIL",
                          "errorType": type(error).__name__}))
        sys.exit(2)
    print(json.dumps(envelope, separators=(",", ":"), allow_nan=False))
