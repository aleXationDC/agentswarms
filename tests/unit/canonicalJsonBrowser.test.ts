import { createHash, webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalJson as browserBytes } from "@/utils/provenance/canonicalJson";
import { canonicalJson as serverBytes, resultDigest } from "@/utils/provenance/canonical";

describe("shared snapshot/provenance serialization", () => {
  it("retains exact existing server bytes, key ordering and meaningful array order", () => {
    for (const value of [
      null,
      "intent",
      0,
      undefined,
      { z: { b: false, a: ["first", "second"] }, a: 1, absent: undefined },
    ])
      expect(browserBytes(value)).toBe(serverBytes(value));
    expect(browserBytes({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
    expect(browserBytes(["first", "second"])).not.toBe(browserBytes(["second", "first"]));
    expect(resultDigest(["value"], [{ value: 7 }])).toBe(resultDigest(["value"], [[7]]));
  });
  it("produces the same real Web Crypto and native Node SHA-256 fingerprint", async () => {
    const bytes = browserBytes({
      configuration: { provider: "openai", tools: [] },
      memory: { stm_enabled: false },
    });
    const digest = await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(bytes));
    const browserHash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    expect(browserHash).toBe(createHash("sha256").update(bytes).digest("hex"));
  });
});
