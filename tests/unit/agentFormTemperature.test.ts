// Agent editor must keep an explicit temperature of 0; only null/undefined use the 0.7 default.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync("src/components/agents/AgentForm.tsx", "utf8");

describe("AgentForm temperature initialisation", () => {
  it("uses nullish coalescing so 0 survives open/save", () => {
    expect(src).toContain("useState(agent?.temperature ?? 0.7)");
    expect(src).not.toMatch(/agent\?\.temperature \|\|/);
  });

  it("matches the initialiser semantics for 0, a non-null value and a new agent", () => {
    const init = (t: number | null | undefined) => t ?? 0.7;
    expect(init(0)).toBe(0);
    expect(init(0.3)).toBe(0.3);
    expect(init(undefined)).toBe(0.7);
    expect(init(null)).toBe(0.7);
  });
});
