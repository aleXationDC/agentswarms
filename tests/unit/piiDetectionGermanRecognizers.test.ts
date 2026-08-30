// DMS-D1-0002R Phase A2/A5 (recognizer coverage). MIN_ENTITIES claims
// DE_TAX_ID/DE_TAX_NUMBER/DE_ID_CARD/DE_PASSPORT coverage, but the stock
// Presidio image never had custom recognizers for them — this file proves
// that claim is now real: the ad_hoc_recognizers Presidio actually receives
// exist, and their regexes actually match realistic German document numbers,
// without needing a live Presidio instance.
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GERMAN_AD_HOC_RECOGNIZERS,
  MIN_ENTITIES,
  detectPii,
} from "@/lib/privacy/piiDetection.server";

const ORIGINAL_URL = process.env.PRESIDIO_ANALYZER_URL;
afterEach(() => {
  if (ORIGINAL_URL === undefined) delete process.env.PRESIDIO_ANALYZER_URL;
  else process.env.PRESIDIO_ANALYZER_URL = ORIGINAL_URL;
  vi.unstubAllGlobals();
});

describe("GERMAN_AD_HOC_RECOGNIZERS", () => {
  it("declares exactly the German labels MIN_ENTITIES requires", () => {
    const germanLabels = ["DE_TAX_ID", "DE_TAX_NUMBER", "DE_ID_CARD", "DE_PASSPORT"];
    const declared = GERMAN_AD_HOC_RECOGNIZERS.map((r) => r.supported_entity);
    for (const label of germanLabels) {
      expect(MIN_ENTITIES).toContain(label);
      expect(declared).toContain(label);
    }
  });

  it.each([
    ["DE_TAX_ID", "12345678901"],
    ["DE_TAX_NUMBER", "12/345/67890"],
    ["DE_ID_CARD", "L01X00T47"],
    ["DE_PASSPORT", "C12345678"],
  ])("%s's regex actually matches a realistic example value", (entity, example) => {
    const recognizer = GERMAN_AD_HOC_RECOGNIZERS.find((r) => r.supported_entity === entity);
    expect(recognizer).toBeDefined();
    const matchesSomePattern = recognizer!.patterns.some((p) => new RegExp(p.regex).test(example));
    expect(matchesSomePattern).toBe(true);
  });

  it("every pattern's score clears the sensitivity policy's MIN_SCORE threshold", () => {
    for (const r of GERMAN_AD_HOC_RECOGNIZERS) {
      for (const p of r.patterns) {
        expect(p.score).toBeGreaterThanOrEqual(0.4);
      }
    }
  });
});

describe("detectPii — ad_hoc_recognizers wiring", () => {
  it("sends the German ad-hoc recognizers on every request", async () => {
    process.env.PRESIDIO_ANALYZER_URL = "http://presidio-analyzer:3000";
    let sentBody: unknown;
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      sentBody = JSON.parse(init.body as string);
      return {
        ok: true,
        json: async () => [],
      } as Response;
    });

    const result = await detectPii("some text");
    expect(result.ok).toBe(true);
    expect(sentBody).toMatchObject({ ad_hoc_recognizers: GERMAN_AD_HOC_RECOGNIZERS });
  });

  it("parses an ad-hoc recognizer's match the same as a built-in one", async () => {
    process.env.PRESIDIO_ANALYZER_URL = "http://presidio-analyzer:3000";
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      json: async () => [{ entity_type: "DE_TAX_NUMBER", score: 0.6, start: 5, end: 17 }],
    }));

    const result = await detectPii("Meine Steuernummer: 12/345/67890");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.findings).toEqual([
        { label: "DE_TAX_NUMBER", score: 0.6, start: 5, end: 17 },
      ]);
    }
  });
});
