import { describe, expect, it, vi } from "vitest";
import { pseudonymizeDocumentText } from "@/lib/privacy/pseudonymize.server";
const finding = (start: number, end: number, label = "PERSON", score = 0.1) => ({
  start,
  end,
  label,
  score,
});

describe("bounded offline finding projection without privacy authority", () => {
  it("does not turn an empty finding list into an eligibility or coverage assertion", () => {
    expect(pseudonymizeDocumentText("unverified", [])).toEqual({
      pseudonymizedText: "unverified",
      pseudonymCount: 0,
      pseudonymTypes: [],
    });
  });
  it("covers the union of every overlapping finding, irrespective of score or order", () => {
    const text = "prefix ABCDEFGHI suffix";
    const spans = [finding(7, 12, "PERSON", 0.9), finding(10, 16, "LOCATION", 0.01)];
    for (const input of [spans, [...spans].reverse()]) {
      const result = pseudonymizeDocumentText(text, input);
      expect(result.pseudonymizedText).toMatch(/^prefix \[PII_[a-f0-9]{24}_1\] suffix$/);
      expect(result.pseudonymizedText).not.toContain("FGHI");
      expect(result.pseudonymTypes).toEqual(["PII"]);
    }
  });
  it("covers chained overlaps completely rather than selecting a winning recognizer", () => {
    expect(
      pseudonymizeDocumentText("abcdefghij", [finding(0, 3), finding(2, 7), finding(6, 10)])
        .pseudonymizedText,
    ).toMatch(/^\[PERSON_[a-f0-9]{24}_1\]$/);
  });
  it("preserves exactly the non-covered code points across 500 bounded overlap permutations", () => {
    let seed = 17;
    const number = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed;
    };
    const points = Array.from("abcdefghijklmnopqrstuvwxyz😀ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    const text = points.join("");
    for (let sample = 0; sample < 500; sample++) {
      const spans = Array.from({ length: number() % 30 }, () => {
        const start = number() % points.length;
        return finding(
          start,
          start + 1 + (number() % (points.length - start)),
          number() % 2 ? "PERSON" : "UNKNOWN",
          (number() % 101) / 100,
        );
      });
      const covered = points.map((_, index) =>
        spans.some((span) => span.start <= index && index < span.end),
      );
      const result = pseudonymizeDocumentText(text, spans);
      const visible = result.pseudonymizedText.replace(/\[(?:PERSON|PII)_[a-f0-9]{24}_\d+\]/g, "");
      expect(visible).toBe(points.filter((_, index) => !covered[index]).join(""));
    }
  });
  it("preserves distinct adjacent spans while never leaving the shared boundary", () => {
    const result = pseudonymizeDocumentText("AliceBob", [finding(0, 5), finding(5, 8)]);
    expect(result.pseudonymCount).toBe(2);
    expect(result.pseudonymizedText).toMatch(
      /^\[PERSON_[a-f0-9]{24}_1\]\[PERSON_[a-f0-9]{24}_2\]$/,
    );
  });
  it("uses Python/Presidio code-point offsets with astral text and combining characters", () => {
    const result = pseudonymizeDocumentText("😀 A😀B e\u0301 end", [
      finding(2, 5),
      finding(6, 8, "LOCATION"),
    ]);
    expect(result.pseudonymizedText).toMatch(
      /^😀 \[PERSON_[a-f0-9]{24}_1\] \[ADDRESS_[a-f0-9]{24}_2\] end$/,
    );
  });
  it("reuses exact sightings within one invocation but never a cross-document namespace", () => {
    const spans = [finding(0, 5), finding(6, 11)];
    const first = pseudonymizeDocumentText("Alice Alice", spans);
    const second = pseudonymizeDocumentText("Alice Alice", spans);
    expect(first.pseudonymCount).toBe(1);
    expect(first.pseudonymizedText.split(" ")[0]).toBe(first.pseudonymizedText.split(" ")[1]);
    expect(second.pseudonymizedText).not.toBe(first.pseudonymizedText);
    expect(first).not.toHaveProperty("mapping");
    expect(JSON.stringify(first)).not.toContain("Alice");
  });
  it("unknown labels and zero-score findings still get fully removed", () => {
    expect(pseudonymizeDocumentText("secret", [finding(0, 6, "UNKNOWN", 0)])).toMatchObject({
      pseudonymCount: 1,
      pseudonymTypes: ["PII"],
    });
  });
  it("redacts whitespace findings too rather than silently skipping them", () => {
    expect(pseudonymizeDocumentText(" ", [finding(0, 1)]).pseudonymizedText).toMatch(
      /^\[PERSON_[a-f0-9]{24}_1\]$/,
    );
  });
  it.each([
    [finding(0, 0)],
    [finding(4, 3)],
    [finding(-1, 2)],
    [finding(0, 7)],
    [finding(0.5, 2)],
    [finding(0, 2, "PERSON", NaN)],
    [finding(0, 2, "PERSON", 2)],
    [{ ...finding(0, 2), rawValue: "forbidden" }],
    [finding(0, 2), null],
    null,
    {},
  ])("fails the entire request on malformed findings without partial redaction %j", (input) => {
    expect(() => pseudonymizeDocumentText("secret", input)).toThrow();
  });
  it("refuses text/finding resource overruns", () => {
    expect(() => pseudonymizeDocumentText("a".repeat(1_000_001), [])).toThrow("TEXT_LIMIT");
    expect(() =>
      pseudonymizeDocumentText(
        "a",
        Array.from({ length: 10_001 }, () => finding(0, 1)),
      ),
    ).toThrow();
  });
  it("refuses lone surrogate offsets instead of claiming Python-compatible coverage", () => {
    expect(() => pseudonymizeDocumentText("\ud800", [finding(0, 1)])).toThrow("INVALID_UNICODE");
  });
  it("retains caller inputs without logging or persisting raw data", () => {
    const input = Object.freeze([Object.freeze(finding(0, 6))]);
    const log = vi.spyOn(console, "log");
    const error = vi.spyOn(console, "error");
    try {
      pseudonymizeDocumentText("secret", input);
      expect(log).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
      error.mockRestore();
    }
  });
});
