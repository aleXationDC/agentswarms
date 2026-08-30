// Server-side extraction for the DMS native intake boundary (DMS-D1-0002 §4).
//
// Fixtures are synthetic and contain no real personal data (repo-wide rule,
// DMS-D1-0002 §13) — see tests/unit/fixtures/synthetic-dms-fixture.*.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { extractDocumentText } from "@/lib/fileParsers.server";

const fixture = (name: string) => readFileSync(resolve("tests/unit/fixtures", name));

describe("extractDocumentText", () => {
  it("extracts the PDF text layer", async () => {
    const bytes = new Uint8Array(fixture("synthetic-dms-fixture.pdf"));
    const result = await extractDocumentText({
      bytes,
      mimeType: "application/pdf",
      filename: "synthetic-dms-fixture.pdf",
    });
    expect(result.status).toBe("ok");
    expect(result.text).toContain("Synthetic DMS-D1-0002 fixture");
    expect(result.error).toBeNull();
  });

  it("extracts DOCX text", async () => {
    const bytes = new Uint8Array(fixture("synthetic-dms-fixture.docx"));
    const result = await extractDocumentText({
      bytes,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      filename: "synthetic-dms-fixture.docx",
    });
    expect(result.status).toBe("ok");
    expect(result.text).toContain("Synthetic DMS-D1-0002 fixture");
  });

  it("extracts plain text / markdown / csv verbatim", async () => {
    const bytes = new TextEncoder().encode("Hello, synthetic fixture. No real PII here.");
    const result = await extractDocumentText({
      bytes,
      mimeType: "text/plain",
      filename: "note.txt",
    });
    expect(result.status).toBe("ok");
    expect(result.text).toBe("Hello, synthetic fixture. No real PII here.");
  });

  it("never OCRs or fabricates content for unsupported/binary types", async () => {
    const bytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]); // fake .exe magic bytes
    const result = await extractDocumentText({
      bytes,
      mimeType: "application/x-msdownload",
      filename: "not-a-document.exe",
    });
    expect(result.status).toBe("unsupported_content_type");
    expect(result.text).toBeNull();
    expect(result.error).toMatch(/D1 does not extract/);
  });

  it("fails closed (extraction_failed) rather than fabricating text on a corrupt PDF", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.4 not actually a valid pdf body");
    const result = await extractDocumentText({
      bytes,
      mimeType: "application/pdf",
      filename: "corrupt.pdf",
    });
    expect(result.status).toBe("extraction_failed");
    expect(result.text).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it("fails closed (extraction_failed) rather than fabricating text on a corrupt DOCX", async () => {
    const bytes = new TextEncoder().encode("not a zip file at all");
    const result = await extractDocumentText({
      bytes,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      filename: "corrupt.docx",
    });
    expect(result.status).toBe("extraction_failed");
    expect(result.text).toBeNull();
  });

  it("reports empty rather than ok for a zero-byte text file", async () => {
    const result = await extractDocumentText({
      bytes: new Uint8Array(0),
      mimeType: "text/plain",
      filename: "empty.txt",
    });
    expect(result.status).toBe("empty");
    expect(result.text).toBeNull();
  });
});
