import { describe, expect, it } from "vitest";
import { pseudonymizeDocumentText } from "@/lib/privacy/pseudonymize.server";

import {
  normalizeRecognitionText,
  recognizeProviderSafeDocument,
  type DocumentRecognitionPattern,
} from "@/axtn/workbenches/documents/documentRecognition";

describe("deterministic document recognition", () => {
  it("normalizes whitespace and ephemeral pseudonym tokens", () => {
    expect(normalizeRecognitionText("Invoice\nPERSON_01  EMAIL_02")).toBe(
      "invoice person_x email_x",
    );
  });

  describe("bounded active recognition manifest without new rules or authority", () => {
    const pattern: DocumentRecognitionPattern = {
      pattern_id: "bounded-fixture",
      name: "Bounded fixture",
      active: true,
      conditions: [{ value: "invoice", operator: "contains" }],
      suggestions: { document_family: "fixture" },
    };
    const fuzzy = (value: string): DocumentRecognitionPattern => ({
      ...pattern,
      conditions: [{ value, operator: "contains", match_mode: "fuzzy", max_deviation_percent: 1 }],
    });

    it("retains bounded exact/fuzzy positive and negative conditions with ordered AND/OR semantics", () => {
      expect(recognizeProviderSafeDocument("invoice", [fuzzy("invoicf")])).toMatchObject({
        matched: false,
      });
      expect(
        recognizeProviderSafeDocument("invoice", [
          {
            ...fuzzy("invoicf"),
            match_settings: { default_mode: "fuzzy", max_deviation_percent: 20 },
            conditions: [
              { value: "invoicf", operator: "contains", match_mode: "fuzzy" },
              { value: "receipt", operator: "not_contains", connector: "AND" },
            ],
          },
        ]),
      ).toMatchObject({ matched: true });
      expect(recognizeProviderSafeDocument("invoice", [pattern]).matched).toBe(true);
    });

    it("accepts the exact two-million-cell fuzzy boundary and rejects one cell beyond it", () => {
      const text = "a".repeat(1_000);
      expect(recognizeProviderSafeDocument(text, [fuzzy("a".repeat(2_000))]).matched).toBe(false);
      expect(() => recognizeProviderSafeDocument(text, [fuzzy("a".repeat(2_001))])).toThrow(
        "WORK_BUDGET",
      );
    });

    it("aggregates work across all active rules before an early ordered match can hide overruns", () => {
      const text = "a".repeat(1_000);
      const match = { ...pattern, conditions: [{ value: "a", operator: "contains" as const }] };
      expect(() =>
        recognizeProviderSafeDocument(text, [
          match,
          fuzzy("a".repeat(1_000)),
          fuzzy("a".repeat(1_001)),
        ]),
      ).toThrow("WORK_BUDGET");
    });

    it("bounds exact scanning independently from the fuzzy cell budget", () => {
      const text = "a".repeat(1_000_000);
      expect(() =>
        recognizeProviderSafeDocument(
          text,
          Array.from({ length: 50 }, () => pattern),
        ),
      ).toThrow("WORK_BUDGET");
    });

    it("bounds input text, rule count, per-rule conditions and total manifest conditions", () => {
      expect(() => recognizeProviderSafeDocument("a".repeat(1_000_001), [])).toThrow("TEXT_LIMIT");
      expect(() =>
        recognizeProviderSafeDocument(
          "",
          Array.from({ length: 101 }, () => pattern),
        ),
      ).toThrow("PATTERN_LIMIT");
      const conditions = Array.from({ length: 32 }, () => pattern.conditions[0]);
      expect(() =>
        recognizeProviderSafeDocument("invoice", [
          { ...pattern, conditions: [...conditions, conditions[0]] },
        ]),
      ).toThrow("CONDITION_LIMIT");
      expect(() =>
        recognizeProviderSafeDocument(
          "invoice",
          Array.from({ length: 32 }, () => ({
            ...pattern,
            conditions,
          })),
        ),
      ).toThrow("CONDITION_LIMIT");
    });

    it.each([
      null,
      { ...pattern, active: "true" },
      { ...pattern, conditions: null },
      { ...pattern, match_settings: { default_mode: "semantic" } },
      { ...pattern, match_settings: { max_deviation_percent: NaN } },
      ...[
        { value: "" },
        { value: " " },
        { value: "a".repeat(4_097) },
        { operator: "free_classifier" },
        { connector: "XOR" },
        { match_mode: "semantic" },
        { max_deviation_percent: NaN },
        { max_deviation_percent: Infinity },
        { max_deviation_percent: -1 },
        { max_deviation_percent: 101 },
      ].map((change) => ({ ...pattern, conditions: [{ ...pattern.conditions[0], ...change }] })),
    ])("rejects a malformed active manifest even after an earlier valid match", (invalid) => {
      expect(() =>
        Reflect.apply(recognizeProviderSafeDocument, undefined, ["invoice", [pattern, invalid]]),
      ).toThrow("DOCUMENT_RECOGNITION_");
    });

    it("retains disabled rules without evaluating their condition bodies or consuming comparison budget", () => {
      const disabled = { ...fuzzy("a".repeat(4_000)), active: false };
      expect(recognizeProviderSafeDocument("invoice", [disabled, pattern]).matched).toBe(true);
    });
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
