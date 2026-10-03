"""Credentialless candidate subprocess; assertions remain in the parent."""
import contextlib
import importlib.util
import json
from pathlib import Path
import sys

request = json.loads(sys.stdin.read(4096))
try:
    with contextlib.redirect_stdout(sys.stderr):
        spec = importlib.util.spec_from_file_location("candidate", Path(sys.argv[1]))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        value = module.normalize_score(*request["args"])
    result = {"ok": True, "value": value}
except Exception as error:
    result = {"ok": False, "errorType": type(error).__name__}
print(json.dumps(result, allow_nan=False))
