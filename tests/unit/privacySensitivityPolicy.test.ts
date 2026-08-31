// Sensitivity policy (DMS-D1-0002 §5). Pure logic — no network/DB.
import { describe, expect, it } from "vitest";

import { classifySensitivity, hasNoAiMarker } from "@/lib/privacy/sensitivityPolicy";

describe("hasNoAiMarker", () => {
  it("detects NO AI: prefix case-insensitively", () => {
    expect(hasNoAiMarker("NO AI: invoice.pdf")).toBe(true);
    expect(hasNoAiMarker("no ai: tax_return.pdf")).toBe(true);
    expect(hasNoAiMarker("No Ai: confidential.pdf")).toBe(true);
    expect(hasNoAiMarker("NO AI - contract.pdf")).toBe(true);
    expect(hasNoAiMarker("[NO AI] secret.docx")).toBe(true);
    expect(hasNoAiMarker("NO AI")).toBe(true);
  });

  it("returns false for regular filenames without marker", () => {
    expect(hasNoAiMarker("invoice_2025.pdf")).toBe(false);
    expect(hasNoAiMarker("normal_document.docx")).toBe(false);
    expect(hasNoAiMarker(null)).toBe(false);
    expect(hasNoAiMarker(undefined)).toBe(false);
    expect(hasNoAiMarker("")).toBe(false);
  });
});

describe("classifySensitivity", () => {
  it("classifies isNoAi as restricted with no external processing", () => {
    const d = classifySensitivity({ findings: [], isNoAi: true });
    expect(d.tier).toBe("restricted");
    expect(d.externalProcessingAllowed).toBe(false);
    expect(d.requiresPseudonymization).toBe(false);
    expect(d.reason).toContain("NO AI:");
  });
  it("classifies empty findings as standard, external processing allowed", () => {
    const d = classifySensitivity({ findings: [] });
    expect(d.tier).toBe("standard");
    expect(d.externalProcessingAllowed).toBe(true);
    expect(d.requiresPseudonymization).toBe(false);
  });

  it("classifies ordinary personal data as personal, pseudonymisation required", () => {
    const d = classifySensitivity({ findings: [{ label: "PERSON", score: 0.9 }] });
    expect(d.tier).toBe("personal");
    expect(d.externalProcessingAllowed).toBe(true);
    expect(d.requiresPseudonymization).toBe(true);
  });

  it("classifies financial identifiers as confidential", () => {
    const d = classifySensitivity({ findings: [{ label: "IBAN_CODE", score: 0.95 }] });
    expect(d.tier).toBe("confidential");
    expect(d.externalProcessingAllowed).toBe(true);
    expect(d.requiresPseudonymization).toBe(true);
  });

  it("confidential wins over personal when both are present", () => {
    const d = classifySensitivity({
      findings: [
        { label: "PERSON", score: 0.9 },
        { label: "CREDIT_CARD", score: 0.8 },
      ],
    });
    expect(d.tier).toBe("confidential");
  });

  it("classifies identity documents as restricted, no external processing", () => {
    const d = classifySensitivity({ findings: [{ label: "DE_PASSPORT", score: 0.9 }] });
    expect(d.tier).toBe("restricted");
    expect(d.externalProcessingAllowed).toBe(false);
  });

  it("restricted wins over confidential and personal", () => {
    const d = classifySensitivity({
      findings: [
        { label: "PERSON", score: 0.9 },
        { label: "IBAN_CODE", score: 0.9 },
        { label: "DE_ID_CARD", score: 0.9 },
      ],
    });
    expect(d.tier).toBe("restricted");
    expect(d.externalProcessingAllowed).toBe(false);
  });

  it("fails closed to restricted when content is unreadable/unknown", () => {
    const d = classifySensitivity({ findings: [], contentUnknown: true });
    expect(d.tier).toBe("restricted");
    expect(d.externalProcessingAllowed).toBe(false);
  });

  it("fails closed to restricted when the sanitizer errored/timed out", () => {
    const d = classifySensitivity({ findings: [], sanitizerFailed: true });
    expect(d.tier).toBe("restricted");
    expect(d.externalProcessingAllowed).toBe(false);
  });

  it("fails closed even when findings look benign, if sanitizerFailed is set", () => {
    const d = classifySensitivity({ findings: [], sanitizerFailed: true, contentUnknown: false });
    expect(d.tier).toBe("restricted");
  });

  it("ignores low-confidence findings below the score threshold", () => {
    const d = classifySensitivity({ findings: [{ label: "PERSON", score: 0.1 }] });
    expect(d.tier).toBe("standard");
  });

  it("explicit restricted-category flag wins regardless of findings", () => {
    const d = classifySensitivity({ findings: [], containsRestrictedCategory: true });
    expect(d.tier).toBe("restricted");
    expect(d.externalProcessingAllowed).toBe(false);
  });
});
