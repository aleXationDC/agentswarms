// Entity resolution — pure key-derivation part only (DMS-D1-0002 §6). The
// dataset read/write paths need a Supabase client and are exercised via the
// native-dataset conventions already covered by documentRegistry tests; this
// file covers the part that must never silently link two different values.
import { describe, expect, it } from "vitest";

import { deriveEntityKey, normalizeEntityValue } from "@/lib/privacy/entityResolution.server";

describe("normalizeEntityValue", () => {
  it("trims, lowercases and collapses whitespace", () => {
    expect(normalizeEntityValue("  Max   Mustermann  ")).toBe("max mustermann");
  });
});

describe("deriveEntityKey", () => {
  it("is deterministic for the same (type, normalised value)", async () => {
    const a = await deriveEntityKey("person", normalizeEntityValue("Max Mustermann"));
    const b = await deriveEntityKey("person", normalizeEntityValue("  max   mustermann "));
    expect(a).toBe(b);
  });

  it("never collapses two different values into the same key", async () => {
    const a = await deriveEntityKey("person", normalizeEntityValue("Max Mustermann"));
    const b = await deriveEntityKey("person", normalizeEntityValue("Erika Mustermann"));
    expect(a).not.toBe(b);
  });

  it("keeps the same normalised value distinct across entity types", async () => {
    const a = await deriveEntityKey("person", "test-value");
    const b = await deriveEntityKey("email", "test-value");
    expect(a).not.toBe(b);
  });

  it("never leaks the clear value into the derived key", async () => {
    const key = await deriveEntityKey("person", "Max Mustermann");
    expect(key).not.toContain("Max");
    expect(key.toLowerCase()).not.toContain("mustermann");
  });
});
