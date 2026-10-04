import hashlib
import io
import json
import tempfile
import threading
import unittest
from http.client import HTTPConnection
from pathlib import Path
from unittest.mock import patch

import server


PDF = b"%PDF-1.4\nsynthetic fixture only"
HASH = hashlib.sha256(PDF).hexdigest()


class ExtractionTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.calls = []

    def run_tool(self, command, deadline):
        self.calls.append((command, deadline))
        if command[0] == "pdfinfo":
            return b"Pages: 2\n"
        if command[0] == "pdftoppm":
            for index in (1, 2):
                (Path(command[-1]).parent / f"page-{index}.png").write_bytes(b"fixture")
            return b""
        return f"Fixture page {Path(command[1]).stem}".encode()

    def test_original_hash_and_numeric_page_order(self):
        with patch.object(server, "_run", self.run_tool):
            result = server.extract_pdf(PDF, HASH)
        self.assertEqual(result["original_sha256"], HASH)
        self.assertEqual(result["page_count"], 2)
        self.assertEqual(result["text"], "Fixture page page-1\n\nFixture page page-2")
        self.assertEqual(len(set(deadline for _, deadline in self.calls)), 1)
        self.assertEqual(self.calls[-1][0][-4:], ["-l", "eng+deu", "--psm", "3"])
        self.assertFalse(Path(self.calls[0][0][-1]).exists())

    def test_unbound_or_wrong_hash_never_reaches_tools(self):
        with patch.object(server, "_run") as tool:
            for digest in ("", "A" * 64, "a" * 64, None):
                with self.subTest(digest=digest):
                    with self.assertRaises(server.OCRFailure):
                        server.extract_pdf(PDF, digest)
            tool.assert_not_called()

    def test_invalid_pdf_is_not_sent_to_tools(self):
        body = b"not PDF"
        with patch.object(server, "_run") as tool:
            with self.assertRaisesRegex(server.OCRFailure, "invalid_pdf"):
                server.extract_pdf(body, hashlib.sha256(body).hexdigest())
            tool.assert_not_called()

    def test_page_limit_fails_instead_of_truncating(self):
        with patch.object(server, "_run", return_value=b"Pages: 21\n") as tool:
            with self.assertRaisesRegex(server.OCRFailure, "pdf_page_limit"):
                server.extract_pdf(PDF, HASH)
            self.assertEqual(tool.call_count, 1)

    def test_empty_missing_or_invalid_page_metadata_fails(self):
        for metadata in (b"Pages: 0\n", b"No page count", b"\xff"):
            with self.subTest(metadata=metadata):
                with patch.object(server, "_run", return_value=metadata):
                    with self.assertRaises(server.OCRFailure):
                        server.extract_pdf(PDF, HASH)

    def test_incomplete_render_cannot_claim_full_extraction(self):
        with patch.object(server, "_run", return_value=b"Pages: 2\n"):
            with self.assertRaisesRegex(server.OCRFailure, "pdf_render_incomplete"):
                server.extract_pdf(PDF, HASH)

    def test_empty_or_invalid_utf8_page_does_not_pass(self):
        for text in (b"", b"\xff"):
            def tool(command, deadline):
                if command[0] == "tesseract":
                    return text
                return self.run_tool(command, deadline)
            with self.subTest(text=text):
                with patch.object(server, "_run", tool):
                    with self.assertRaises(server.OCRFailure):
                        server.extract_pdf(PDF, HASH)

    def test_whole_request_deadline_not_per_page_reset(self):
        with patch.object(server.time, "monotonic", return_value=10):
            with patch.object(server.subprocess, "run") as tool:
                with self.assertRaisesRegex(server.OCRFailure, "ocr_deadline_exceeded"):
                    server._run(["tesseract"], 9)
                tool.assert_not_called()

    def test_tool_failure_never_echoes_raw_process_output(self):
        process = server.subprocess.CompletedProcess(
            ["pdfinfo"], 1, b"LEAKAGE_MARKER", b"LEAKAGE_MARKER"
        )
        with patch.object(server.subprocess, "run", return_value=process):
            with self.assertRaisesRegex(server.OCRFailure, "^ocr_tool_failed$"):
                server._run(["pdfinfo"], server.time.monotonic() + 10)


class TransportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http = server.ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.worker = threading.Thread(target=cls.http.serve_forever)
        cls.worker.start()

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.worker.join()

    def request(self, path="/ocr", body=PDF, digest=HASH, content_type="application/pdf"):
        client = HTTPConnection("127.0.0.1", self.http.server_port, timeout=5)
        self.addCleanup(client.close)
        client.request("POST", path, body=body, headers={
            "Content-Type": content_type, "X-aXtn-Original-SHA256": digest,
            "X-aXtn-Source-Id": "fixture:source",
            "X-aXtn-Source-Name": "fixture.pdf",
        })
        response = client.getresponse()
        return response.status, json.load(io.BytesIO(response.read()))

    def test_content_type_hash_and_path_denials(self):
        with patch.object(server, "extract_pdf") as extract:
            self.assertEqual(self.request(content_type="text/plain")[0], 415)
            self.assertEqual(self.request(digest="")[0], 400)
            self.assertEqual(self.request(path="/another")[0], 404)
            extract.assert_not_called()

    def test_hash_mismatch_returns_failure_without_echoing_content(self):
        status, body = self.request(digest="a" * 64)
        self.assertEqual(status, 422)
        self.assertEqual(body, {"error": "original_sha256_mismatch"})

    def test_ambiguous_oversized_or_chunked_body_is_rejected_before_extraction(self):
        cases = [
            ([("Content-Length", "999999999")], 413),
            ([("Content-Length", "9" * 5000)], 400),
            ([("Content-Length", "10"), ("Content-Length", "20")], 400),
            ([("Transfer-Encoding", "chunked")], 400),
        ]
        with patch.object(server, "extract_pdf") as extract:
            for headers, expected_status in cases:
                with self.subTest(headers=headers):
                    client = HTTPConnection("127.0.0.1", self.http.server_port, timeout=5)
                    try:
                        client.putrequest("POST", "/ocr")
                        for name, value in headers:
                            client.putheader(name, value)
                        client.endheaders()
                        response = client.getresponse()
                        self.assertEqual(response.status, expected_status)
                        response.read()
                    finally:
                        client.close()
            extract.assert_not_called()

    def test_missing_source_metadata_does_not_invent_provider_identity(self):
        client = HTTPConnection("127.0.0.1", self.http.server_port, timeout=5)
        self.addCleanup(client.close)
        client.request("POST", "/ocr", body=PDF, headers={
            "Content-Type": "application/pdf", "X-aXtn-Original-SHA256": HASH,
        })
        response = client.getresponse()
        self.assertEqual(response.status, 400)
        self.assertEqual(json.loads(response.read()), {"error": "source_transport_metadata_required"})

    def test_success_hash_is_actual_result_and_source_metadata_remains_transport_only(self):
        result = {"schema_version": "local-ocr-result-v1", "text": "fixture", "original_sha256": HASH}
        with patch.object(server, "extract_pdf", return_value=result) as extract:
            self.assertEqual(self.request(), (200, {
                **result, "source_id": "fixture:source", "source_name": "fixture.pdf",
                "source_mime": "application/pdf",
            }))
            extract.assert_called_once_with(PDF, HASH)

    def test_capacity_limit_never_starts_another_extraction(self):
        self.assertTrue(server.SLOTS.acquire(blocking=False))
        self.assertTrue(server.SLOTS.acquire(blocking=False))
        try:
            with patch.object(server, "extract_pdf") as extract:
                self.assertEqual(self.request()[0], 429)
                extract.assert_not_called()
        finally:
            server.SLOTS.release()
            server.SLOTS.release()

    def test_failures_release_capacity(self):
        with patch.object(server, "extract_pdf", side_effect=server.OCRFailure("ocr_tool_failed")):
            self.assertEqual(self.request(), (422, {"error": "ocr_tool_failed"}))
        acquired = 0
        try:
            for _ in range(2):
                self.assertTrue(server.SLOTS.acquire(timeout=2))
                acquired += 1
        finally:
            for _ in range(acquired):
                server.SLOTS.release()


if __name__ == "__main__":
    unittest.main()
