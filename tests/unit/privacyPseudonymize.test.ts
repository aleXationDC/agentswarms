// Pseudonymisation — pure span-replacement + label-mapping parts (DMS-D1-0002
// §5/§6). The async orchestration (entity resolution + Privacy Vault calls)
// needs a Supabase client; this file covers the logic most likely to have an
// off-by-one bug, without any DB/network dependency.
import { describe, expect, it } from "vitest";

import {
  applyReplacements,
  mapPresidioLabelToEntityType,
  normalizeOverlappingFindings,
} from "@/lib/privacy/pseudonymize.server";

describe("mapPresidioLabelToEntityType", () => {
  it("maps known Presidio labels to their entity domain", () => {
    expect(mapPresidioLabelToEntityType("PERSON")).toBe("person");
    expect(mapPresidioLabelToEntityType("EMAIL_ADDRESS")).toBe("email");
    expect(mapPresidioLabelToEntityType("IBAN_CODE")).toBe("iban");
    expect(mapPresidioLabelToEntityType("DE_PASSPORT")).toBe("id_document");
  });

  it("falls back to 'other' for unknown labels", () => {
    expect(mapPresidioLabelToEntityType("SOMETHING_NEW")).toBe("other");
  });
});

describe("applyReplacements", () => {
  it("substitutes a single span", () => {
    const out = applyReplacements("Hello Max, bye.", [{ start: 6, end: 9, token: "PERSON-1" }]);
    expect(out).toBe("Hello PERSON-1, bye.");
  });

  it("substitutes multiple non-overlapping spans regardless of input order", () => {
    const text = "Max wrote to Erika about the invoice.";
    const spans = [
      { start: 0, end: 3, token: "PERSON-A" },
      { start: 13, end: 18, token: "PERSON-B" },
    ];
    const out = applyReplacements(text, spans);
    expect(out).toBe("PERSON-A wrote to PERSON-B about the invoice.");
  });

  it("keeps earlier offsets valid when replacement text has a different length", () => {
    const text = "AA short BB longer-token-name CC";
    const spans = [
      { start: 0, end: 2, token: "X" },
      { start: 9, end: 11, token: "VERY-LONG-REPLACEMENT-TOKEN" },
      { start: 30, end: 32, token: "Z" },
    ];
    const out = applyReplacements(text, spans);
    expect(out).toBe("X short VERY-LONG-REPLACEMENT-TOKEN longer-token-name Z");
  });

  it("throws on an out-of-range span rather than silently truncating", () => {
    expect(() => applyReplacements("short", [{ start: 0, end: 100, token: "X" }])).toThrow();
  });

  it("throws on an inverted span", () => {
    expect(() => applyReplacements("short", [{ start: 4, end: 1, token: "X" }])).toThrow();
  });
});

describe("normalizeOverlappingFindings", () => {
  it("keeps disjoint findings untouched", () => {
    const findings = [
      { label: "PERSON", score: 0.6, start: 0, end: 3 },
      { label: "EMAIL_ADDRESS", score: 0.9, start: 10, end: 20 },
    ];
    expect(normalizeOverlappingFindings(findings)).toEqual(findings);
  });

  it("resolves an overlap in favour of the higher-confidence finding", () => {
    const findings = [
      { label: "LOCATION", score: 0.5, start: 5, end: 15 },
      { label: "PERSON", score: 0.9, start: 8, end: 12 },
    ];
    const result = normalizeOverlappingFindings(findings);
    expect(result).toEqual([{ label: "PERSON", score: 0.9, start: 8, end: 12 }]);
  });

  it("breaks a tied score by the longer span", () => {
    const findings = [
      { label: "LOCATION", score: 0.7, start: 0, end: 20 },
      { label: "PERSON", score: 0.7, start: 5, end: 10 },
    ];
    const result = normalizeOverlappingFindings(findings);
    expect(result).toEqual([{ label: "LOCATION", score: 0.7, start: 0, end: 20 }]);
  });

  it("is deterministic regardless of input array order", () => {
    const a = { label: "PERSON", score: 0.8, start: 0, end: 10 };
    const b = { label: "LOCATION", score: 0.5, start: 5, end: 8 };
    const forward = normalizeOverlappingFindings([a, b]);
    const reversed = normalizeOverlappingFindings([b, a]);
    expect(forward).toEqual(reversed);
    expect(forward).toEqual([a]);
  });

  it("drops a degenerate (inverted or zero-length) span", () => {
    const findings = [
      { label: "PERSON", score: 0.8, start: 5, end: 5 },
      { label: "EMAIL_ADDRESS", score: 0.6, start: 0, end: 3 },
    ];
    expect(normalizeOverlappingFindings(findings)).toEqual([
      { label: "EMAIL_ADDRESS", score: 0.6, start: 0, end: 3 },
    ]);
  });

  it("never lets the normalized set contain any overlapping pair, on a fuzz of random spans", () => {
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const findings = Array.from({ length: 40 }, (_, i) => {
      const start = Math.floor(rand() * 100);
      const end = start + 1 + Math.floor(rand() * 10);
      return { label: `L${i % 5}`, score: Math.round(rand() * 100) / 100, start, end };
    });
    const result = normalizeOverlappingFindings(findings);
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const overlaps = result[i].start < result[j].end && result[j].start < result[i].end;
        expect(overlaps).toBe(false);
      }
    }
  });
});
