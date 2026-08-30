// Pseudonymisation — pure span-replacement + label-mapping parts (DMS-D1-0002
// §5/§6). The async orchestration (entity resolution + Privacy Vault calls)
// needs a Supabase client; this file covers the logic most likely to have an
// off-by-one bug, without any DB/network dependency.
import { describe, expect, it } from "vitest";

import { applyReplacements, mapPresidioLabelToEntityType } from "@/lib/privacy/pseudonymize.server";

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
