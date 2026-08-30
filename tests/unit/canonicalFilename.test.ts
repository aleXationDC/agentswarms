// Unit tests for Portable Canonical Filename Profile (DMS-D1-0003-REVIEW §7.6, §12).
import { describe, it, expect } from "vitest";
import {
  buildCanonicalFilename,
  sanitizeCanonicalStem,
  transliterateToAscii,
} from "@/lib/canonicalFilename";

describe("Portable Canonical Filename Profile", () => {
  it("transliterates German umlauts and eszett to ASCII", () => {
    expect(transliterateToAscii("Mietvertrag Dorfstraße 22a")).toBe("Mietvertrag Dorfstrasse 22a");
    expect(transliterateToAscii("Überweisung für Ärzte & Öl")).toBe("Ueberweisung fuer Aerzte & Oel");
  });

  it("produces canonical filename with no spaces, allowed chars only, and single dot before extension", () => {
    const res = buildCanonicalFilename({
      originalFilename: "2026-05-04 Mietvertrag Dorfstraße 22a unterschrieben.pdf",
      documentDate: "2026-05-04",
      documentDateSource: "explicit_document",
    });

    expect(res.canonicalFilename).toBe("2026-05-04_Mietvertrag_Dorfstrasse-22a_unterschrieben.pdf");
    expect(res.canonicalFilename).not.toMatch(/\s/);
    expect(res.canonicalFilename.split(".")).toHaveLength(2);
    expect(res.canonicalFilename.endsWith(".pdf")).toBe(true);
  });

  it("encodes version/decimal punctuation in stem without internal dots", () => {
    const res = buildCanonicalFilename({
      originalFilename: "ToS Claude Code 1.3.pdf",
      documentDate: "2026-04-01",
      documentDateSource: "explicit_document",
    });

    expect(res.canonicalFilename).toBe("2026-04-01_ToS_Claude-Code_v1-3.pdf");
    expect(res.canonicalFilename.split(".")).toHaveLength(2);
  });

  it("collapses repeated separators and strips filesystem-sensitive characters", () => {
    const res = buildCanonicalFilename({
      originalFilename: "Rechnung / Service (Telekom): 2026.08.31 *final*???.PDF",
      documentDate: "2026-08-31",
      documentDateSource: "explicit_document",
    });

    // Basename contains only [A-Za-z0-9_-], extension normalized to lowercase .pdf
    const basename = res.canonicalFilename.slice(0, res.canonicalFilename.lastIndexOf("."));
    expect(basename).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(res.canonicalFilename.endsWith(".pdf")).toBe(true);
    expect(res.canonicalFilename.split(".")).toHaveLength(2);
  });

  it("preserves original filename separately while building canonical filename", () => {
    const original = "2026-04-01_ToS Claude Code 1.3.pdf";
    const res = buildCanonicalFilename({
      originalFilename: original,
      documentDate: "2026-04-01",
      documentDateSource: "explicit_document",
    });

    expect(res.originalFilename).toBe(original);
    expect(res.canonicalFilename).toBe("2026-04-01_ToS_Claude-Code_v1-3.pdf");
    expect(res.wouldRename).toBe(true);
  });
});
