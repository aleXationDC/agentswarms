"""Executable synthetic OCR/restart test; never attaches to production networks."""

import base64
import hashlib
import json
import subprocess
import time


NAME = "axtn-dms-ocr-recovery-test"
IMAGE = "axtn-dms-local-ocr:recovery-test"


def docker(*arguments, input_text=None):
    result = subprocess.run(
        ["docker", *arguments], input=input_text, text=True, capture_output=True, check=True
    )
    return result.stdout.strip()


def fixture_pdf(page_count=1):
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        f"<< /Type /Pages /Kids [{' '.join(f'{5 + index * 2} 0 R' for index in range(page_count))}] /Count {page_count} >>".encode(),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Producer (aXtn synthetic OCR fixture) >>",
    ]
    for _ in range(page_count):
        content_id = len(objects) + 2
        objects.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents {content_id} 0 R >>".encode()
        )
        stream = b"BT /F1 28 Tf 60 700 Td (DMS FIXTURE INVOICE 12345) Tj ET"
        objects.append(
            f"<< /Length {len(stream)} >>\nstream\n".encode() + stream + b"\nendstream"
        )
    output = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, value in enumerate(objects, 1):
        offsets.append(len(output))
        output.extend(f"{index} 0 obj\n".encode() + value + b"\nendobj\n")
    xref = len(output)
    output.extend(f"xref\n0 {len(offsets)}\n0000000000 65535 f \n".encode())
    for offset in offsets[1:]:
        output.extend(f"{offset:010} 00000 n \n".encode())
    output.extend(
        f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    )
    return bytes(output)


HTTP = """
import base64,json,sys,urllib.request,urllib.error
payload=json.load(sys.stdin)
body=base64.b64decode(payload["body"]) if "body" in payload else None
request=urllib.request.Request(
 "http://127.0.0.1:8092"+payload["path"],data=body,
 headers=payload.get("headers",{}),method="POST" if body is not None else "GET")
try:
 response=urllib.request.urlopen(request,timeout=130)
except urllib.error.HTTPError as error:
 response=error
print(json.dumps({"status":response.status,"body":json.load(response)}))
"""


def request(body=None, digest=None):
    payload = {"path": "/health" if body is None else "/ocr"}
    if body is not None:
        payload["body"] = base64.b64encode(body).decode()
        payload["headers"] = {
            "Content-Type": "application/pdf",
            "X-aXtn-Original-SHA256": digest or hashlib.sha256(body).hexdigest(),
            "X-aXtn-Source-Id": "fixture:offline-document",
            "X-aXtn-Source-Name": "synthetic-fixture.pdf",
        }
    return json.loads(docker("exec", "-i", NAME, "python", "-c", HTTP,
                             input_text=json.dumps(payload)))


def wait_healthy():
    for _ in range(30):
        result = subprocess.run(
            ["docker", "exec", NAME, "python", "-c",
             "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8092/health',timeout=2)"],
            capture_output=True, check=False,
        )
        if result.returncode == 0:
            assert request()["body"] == {"status": "ok", "service": "local-ocr"}
            return
        time.sleep(1)
    raise RuntimeError("Isolated OCR service did not become responsive")


names = docker("ps", "-a", "--format", "{{.Names}}").splitlines()
assert NAME not in names, "Never reuse or remove a preexisting test container"
created = False
try:
    docker(
        "create", "--name", NAME, "--network", "none", "--read-only",
        "--security-opt", "no-new-privileges:true", "--cap-drop", "ALL",
        "--pids-limit", "128", "--memory", "1g", "--cpus", "2",
        "--tmpfs", "/tmp:size=268435456,mode=1777", IMAGE,
    )
    created = True
    docker("start", NAME)
    wait_healthy()
    inspection = json.loads(docker("inspect", NAME))[0]
    config = inspection["HostConfig"]
    assert config["NetworkMode"] == "none" and config["ReadonlyRootfs"]
    assert not config["PortBindings"] and not config["Binds"]
    assert "ALL" in config["CapDrop"] and config["PidsLimit"] == 128
    assert config["Memory"] == 1024 * 1024 * 1024
    assert config["NanoCpus"] == 2_000_000_000
    languages = docker("exec", NAME, "tesseract", "--list-langs")
    assert "deu" in languages.splitlines() and "eng" in languages.splitlines()
    document = fixture_pdf()
    first = request(document)
    assert first["status"] == 200, first
    result = first["body"]
    assert result["original_sha256"] == hashlib.sha256(document).hexdigest()
    assert result["schema_version"] == "local-ocr-result-v1"
    assert result["page_count"] == 1 and result["extraction_method"] == "local_ocr"
    assert result["source_id"] == "fixture:offline-document"
    assert result["source_name"] == "synthetic-fixture.pdf"
    assert result["source_mime"] == "application/pdf"
    assert "INVOICE" in result["text"].upper() and "12345" in result["text"]
    assert request(document, "a" * 64) == {
        "status": 422, "body": {"error": "original_sha256_mismatch"}
    }
    assert request(fixture_pdf(21)) == {
        "status": 422, "body": {"error": "pdf_page_limit"}
    }
    assert request(b"not PDF") == {"status": 422, "body": {"error": "invalid_pdf"}}
    assert request(b"%PDF-1.4\ninvalid synthetic PDF") == {
        "status": 422, "body": {"error": "ocr_tool_failed"}
    }
    check_temporary = (
        "from pathlib import Path; "
        "assert not list(Path('/tmp').glob('axtn-ocr-*')), 'Raw temporary files retained'"
    )
    docker("exec", NAME, "python", "-c", check_temporary)
    docker("restart", NAME)
    wait_healthy()
    assert request(document) == first
    docker("exec", NAME, "python", "-c", check_temporary)
    logs = docker("logs", NAME)
    assert "DMS FIXTURE" not in logs and "INVOICE" not in logs and "12345" not in logs
    print(
        "PASS: actual offline eng/deu OCR, computed original hash, no silent PDF truncation, "
        "safe invalid/mismatch failures, exact restart readback, no raw files/logs retained; "
        "network none, read-only, no mounts/ports and bounded resources."
    )
finally:
    if created:
        docker("rm", "--force", NAME)
