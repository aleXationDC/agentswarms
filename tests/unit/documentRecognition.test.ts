import { describe, expect, it } from "vitest";
import { pseudonymizeDocumentText } from "@/lib/privacy/pseudonymize.server";

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

  it.each([
    ["PERSON", "person"],
    ["EMAIL_ADDRESS", "email"],
    ["LOCATION", "address"],
    ["PHONE_NUMBER", "phone"],
    ["IBAN_CODE", "iban"],
    ["CREDIT_CARD", "payment_card"],
    ["DE_TAX_ID", "tax_id"],
    ["DE_ID_CARD", "id_document"],
    ["UNKNOWN", "pii"],
  ])(
    "normalizes actual invocation-scoped %s tokens without retaining namespaces",
    (label, type) => {
      const spans = [{ start: 0, end: 3, label, score: 0 }];
      const first = pseudonymizeDocumentText("aaa", spans).pseudonymizedText;
      const second = pseudonymizeDocumentText("bbb", spans).pseudonymizedText;
      expect(first).not.toBe(second);
      expect(normalizeRecognitionText(first)).toBe(`[${type}_x]`);
      expect(normalizeRecognitionText(first)).toBe(normalizeRecognitionText(second));
    },
  );

  it("matches legacy characteristic conditions against actual fresh pseudonyms across invocations", () => {
    const pattern = {
      pattern_id: "provider-safe-token-fixture",
      name: "Provider-safe fixture only",
      active: true,
      conditions: [{ value: "Invoice for [PERSON_01]", operator: "contains" as const }],
      suggestions: { document_family: "fixture" },
    };
    for (const text of ["Invoice for aaa", "Invoice for bbb"]) {
      const safe = pseudonymizeDocumentText(text, [
        { start: 12, end: 15, label: "PERSON", score: 0.1 },
      ]);
      expect(recognizeProviderSafeDocument(safe.pseudonymizedText, [pattern]).matched).toBe(true);
    }
  });

  it("does not normalize malformed or unrelated namespace-shaped original text as valid tokens", () => {
    for (const input of [
      "[OTHER_aaaaaaaaaaaaaaaaaaaaaaaa_1]",
      "[PERSON_aaaaaaaaaaaaaaaaaaaaaaa_1]",
      "[PERSON_aaaaaaaaaaaaaaaaaaaaaaaa_0]",
      "[PERSON_aaaaaaaaaaaaaaaaaaaaaaaa_123456]",
      "PERSON_aaaaaaaaaaaaaaaaaaaaaaaa_1",
    ]) {
      expect(normalizeRecognitionText(input)).toBe(input.toLowerCase());
    }
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
