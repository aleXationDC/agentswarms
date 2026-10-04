import { describe, expect, it } from "vitest";

import {
  normalizeRecognitionText,
  recognizeProviderSafeDocument,
} from "@/axtn/workbenches/documents/documentRecognition";

describe("deterministic document recognition", () => {
  it("normalizes whitespace and ephemeral pseudonym tokens", () => {
    expect(normalizeRecognitionText("Invoice\nPERSON_01  EMAIL_02")).toBe(
      "invoice person_x email_x",
    );
  });

  it("matches a characteristic block on provider-safe content only", () => {
    const result = recognizeProviderSafeDocument(
      "Page 1\nInvoice\nInvoice number V8XOYQFR\nPERSON_01\nEMAIL_01",
    );
    expect(result).toMatchObject({
      matched: true,
      matchMode: "exact",
      matchPercent: 100,
      recognizedFacts: {
        document_family: "Invoice",
        document_type: "Invoice",
        primary_domain: "Finance",
      },
    });
    expect(result.appliedFields).toContain("document_type");
  });

  it("fails closed when the characteristic block is absent", () => {
    expect(recognizeProviderSafeDocument("A generic provider-safe letter")).toMatchObject({
      matched: false,
      recognizedFacts: {},
      appliedFields: [],
    });
  });

  it("evaluates ordered AND/OR conditions without raw-text persistence", () => {
    const result = recognizeProviderSafeDocument("invoice number provider safe", [
      {
        pattern_id: "bounded",
        name: "Bounded invoice",
        active: true,
        conditions: [
          { value: "invoice number", operator: "contains" },
          { value: "secret", operator: "not_contains", connector: "AND" },
        ],
        suggestions: { document_type: "Invoice" },
      },
    ]);
    expect(result.matched).toBe(true);
    expect(result.recognizedFacts).toEqual({ document_type: "Invoice" });
    expect(result.conditionResults).toHaveLength(2);
  });
});
