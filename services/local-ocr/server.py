#!/usr/bin/env python3
"""Offline bounded PDF extraction; no persistent data or privacy authorization."""

import hashlib
import json
import os
import re
import socket
import subprocess
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

MAX_BYTES = 20 * 1024 * 1024
MAX_PAGES = 20
MAX_TEXT_CHARS = 1_000_000
TIMEOUT_SECONDS = 120
SLOTS = threading.BoundedSemaphore(2)


class OCRFailure(Exception):
    """A safe transport error that contains no document or process output."""


def _run(command, deadline):
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise OCRFailure("ocr_deadline_exceeded")
    try:
        result = subprocess.run(
            command, capture_output=True, timeout=remaining, check=False
        )
    except subprocess.TimeoutExpired as error:
        raise OCRFailure("ocr_deadline_exceeded") from error
    except OSError as error:
        raise OCRFailure("ocr_tool_unavailable") from error
    if result.returncode != 0:
        raise OCRFailure("ocr_tool_failed")
    return result.stdout


def extract_pdf(body, expected_sha256):
    if not isinstance(body, bytes) or not body or len(body) > MAX_BYTES:
        raise OCRFailure("invalid_payload_size")
    if not isinstance(expected_sha256, str) or not re.fullmatch(r"[a-f0-9]{64}", expected_sha256):
        raise OCRFailure("original_sha256_required")
    actual_hash = hashlib.sha256(body).hexdigest()
    if actual_hash != expected_sha256:
        raise OCRFailure("original_sha256_mismatch")
    if not body.startswith(b"%PDF-"):
        raise OCRFailure("invalid_pdf")
    deadline = time.monotonic() + TIMEOUT_SECONDS
    with tempfile.TemporaryDirectory(prefix="axtn-ocr-") as directory:
        root = Path(directory)
        pdf = root / "input.pdf"
        pdf.write_bytes(body)
        try:
            info = _run(["pdfinfo", str(pdf)], deadline).decode("utf-8")
        except UnicodeDecodeError as error:
            raise OCRFailure("invalid_pdf_metadata") from error
        pages_match = re.search(r"^Pages:\s+([0-9]+)\s*$", info, re.MULTILINE)
        if not pages_match:
            raise OCRFailure("pdf_page_count_required")
        page_count = int(pages_match.group(1))
        if page_count < 1 or page_count > MAX_PAGES:
            raise OCRFailure("pdf_page_limit")
        prefix = root / "page"
        _run(
            [
                "pdftoppm", "-f", "1", "-l", str(page_count), "-r", "120",
                "-scale-to", "1800", "-png", str(pdf), str(prefix),
            ],
            deadline,
        )
        page_files = list(root.glob("page-*.png"))
        if len(page_files) != page_count:
            raise OCRFailure("pdf_render_incomplete")
        indexed = {}
        for page in page_files:
            match = re.fullmatch(r"page-([0-9]+)\.png", page.name)
            if not match:
                raise OCRFailure("pdf_render_incomplete")
            index = int(match.group(1))
            if index in indexed or index < 1 or index > page_count:
                raise OCRFailure("pdf_render_incomplete")
            indexed[index] = page
        text = []
        chars = 0
        for index in range(1, page_count + 1):
            raw = _run(
                ["tesseract", str(indexed[index]), "stdout", "-l", "eng+deu", "--psm", "3"],
                deadline,
            )
            try:
                page_text = raw.decode("utf-8").strip()
            except UnicodeDecodeError as error:
                raise OCRFailure("ocr_invalid_text") from error
            chars += len(page_text) + (2 if text else 0)
            if chars > MAX_TEXT_CHARS:
                raise OCRFailure("ocr_text_limit")
            if not page_text:
                raise OCRFailure("ocr_page_empty")
            text.append(page_text)
        return {
            "schema_version": "local-ocr-result-v1",
            "text": "\n\n".join(text),
            "extraction_method": "local_ocr",
            "original_sha256": actual_hash,
            "page_count": page_count,
        }


class Handler(BaseHTTPRequestHandler):
    server_version = "aXtnLocalOCR/1"

    def setup(self):
        super().setup()
        self.connection.settimeout(15)

    def do_GET(self):  # noqa: N802
        if self.path != "/health":
            self._json(404, {"error": "not_found"})
            return
        self._json(200, {"status": "ok", "service": "local-ocr"})

    def do_POST(self):  # noqa: N802
        self.close_connection = True
        if self.path != "/ocr":
            self._json(404, {"error": "not_found"})
            return
        if self.headers.get("Transfer-Encoding"):
            self._json(400, {"error": "unsupported_transfer_encoding"})
            return
        lengths = self.headers.get_all("Content-Length") or []
        if len(lengths) != 1 or not re.fullmatch(r"[0-9]{1,9}", lengths[0]):
            self._json(400, {"error": "content_length_required"})
            return
        length = int(lengths[0])
        if length <= 0 or length > MAX_BYTES:
            self._json(413, {"error": "invalid_payload_size"})
            return
        if self.headers.get("Content-Type", "").split(";")[0].strip().lower() != "application/pdf":
            self._json(415, {"error": "application_pdf_required"})
            return
        hashes = self.headers.get_all("X-aXtn-Original-SHA256") or []
        if len(hashes) != 1 or not re.fullmatch(r"[a-f0-9]{64}", hashes[0]):
            self._json(400, {"error": "original_sha256_required"})
            return
        metadata = {}
        for header, field in [
            ("X-aXtn-Source-Id", "source_id"),
            ("X-aXtn-Source-Name", "source_name"),
        ]:
            values = self.headers.get_all(header) or []
            if (
                len(values) != 1 or not values[0].strip() or len(values[0]) > 500
                or any(ord(char) < 32 or ord(char) == 127 for char in values[0])
            ):
                self._json(400, {"error": "source_transport_metadata_required"})
                return
            metadata[field] = values[0]
        metadata["source_mime"] = "application/pdf"
        if not SLOTS.acquire(blocking=False):
            self._json(429, {"error": "ocr_capacity_exceeded"})
            return
        try:
            body = self.rfile.read(length)
            if len(body) != length:
                raise OCRFailure("incomplete_payload")
            self._json(200, {**extract_pdf(body, hashes[0]), **metadata})
        except (socket.timeout, TimeoutError):
            self._json(408, {"error": "payload_read_timeout"})
        except OCRFailure as error:
            self._json(422, {"error": str(error)})
        finally:
            SLOTS.release()

    def _json(self, status, payload):
        encoded = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, *_args):
        return


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("PORT", "8092"))), Handler).serve_forever()
