// DMS-D1-0002 §9: no LLM may interpret an explicit approval boolean.
//
// Before this fix, EVERY condition node — including the Document Intake
// swarm's "Approved?" gate right before Ablagebot — asked an LLM to judge a
// prompt like "Is reviewed_proposal_approved equal to yes?" against the
// upstream text. That is a coin-flip dressed up as a security gate: a model
// misreading the approval summary can send a rejected document straight to
// Ablagebot, or block an approved one.
//
// `evaluateBooleanEqualsCondition` (conditionMode: "boolean_equals") replaces
// the model call with a direct, byte-for-byte (trimmed/case-folded) read of a
// named context variable — no prompt, no judge, no ambiguity.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { evaluateBooleanEqualsCondition, type SwarmNodeData } from "@/lib/swarmRuntime";

const node = (data: Partial<SwarmNodeData>) => ({ data: data as SwarmNodeData });

describe("evaluateBooleanEqualsCondition", () => {
  it("returns YES when the referenced variable equals the expected value", () => {
    const n = node({ inputs: ["reviewed_proposal_approved"] });
    expect(evaluateBooleanEqualsCondition(n, { reviewed_proposal_approved: "yes" })).toBe("YES");
  });

  it("returns NO when the referenced variable does not equal the expected value", () => {
    const n = node({ inputs: ["reviewed_proposal_approved"] });
    expect(evaluateBooleanEqualsCondition(n, { reviewed_proposal_approved: "no" })).toBe("NO");
  });

  it("is case- and whitespace-insensitive", () => {
    const n = node({ inputs: ["reviewed_proposal_approved"] });
    expect(evaluateBooleanEqualsCondition(n, { reviewed_proposal_approved: "  YES  " })).toBe(
      "YES",
    );
  });

  it("never treats free text mentioning 'yes' as approval — it reads the flag, not prose", () => {
    // Exactly the failure mode this replaces: an LLM asked "is X equal to
    // yes?" against a summary that happens to contain the word "yes"
    // somewhere in unrelated text could answer YES. The deterministic reader
    // only ever looks at the exact flag value.
    const n = node({ inputs: ["reviewed_proposal_approved"] });
    expect(
      evaluateBooleanEqualsCondition(n, {
        reviewed_proposal_approved: "no",
        reviewed_proposal: "yes, the tenant confirmed everything, yes.",
      }),
    ).toBe("NO");
  });

  it("supports a custom expected value via conditionEqualsValue", () => {
    const n = node({ inputs: ["status"], conditionEqualsValue: "approved" });
    expect(evaluateBooleanEqualsCondition(n, { status: "approved" })).toBe("YES");
    expect(evaluateBooleanEqualsCondition(n, { status: "yes" })).toBe("NO");
  });

  it("fails closed (null, not a guess) when no input variable is configured", () => {
    const n = node({});
    expect(evaluateBooleanEqualsCondition(n, {})).toBeNull();
  });

  it("fails closed (null, not a guess) when the referenced variable is missing from context", () => {
    const n = node({ inputs: ["reviewed_proposal_approved"] });
    expect(evaluateBooleanEqualsCondition(n, {})).toBeNull();
  });
});

describe("both swarm executors route boolean_equals through the deterministic evaluator, not an LLM", () => {
  const clientRuntime = readFileSync(resolve("src/lib/swarmRuntime.ts"), "utf8");
  const executor = readFileSync(resolve("src/utils/swarmExecute.server.ts"), "utf8");

  it("client runtime checks conditionMode before calling the model", () => {
    const i = clientRuntime.indexOf('node.data.kind === "condition"');
    expect(i, "the client condition branch moved").toBeGreaterThan(0);
    const branch = clientRuntime.slice(i, i + 1500);
    expect(branch).toContain('conditionMode === "boolean_equals"');
    expect(branch).toContain("evaluateBooleanEqualsCondition(node, ctx)");
  });

  it("headless executor checks conditionMode before calling the model", () => {
    const i = executor.indexOf('kind === "condition"');
    expect(i, "the headless condition branch moved").toBeGreaterThan(0);
    const branch = executor.slice(i, i + 1500);
    expect(branch).toContain('conditionMode === "boolean_equals"');
    expect(branch).toContain("evaluateBooleanEqualsCondition(node, ctx)");
  });

  it("does not special-case the Document Intake node label/id in the executor", () => {
    // The fix must be a generic node capability, not a hardcoded check for
    // "Approved?" or "approval-check" — that would silently miss every other
    // approval-gated swarm.
    expect(executor).not.toMatch(/node\.id\s*===\s*["']approval-check["']/);
    expect(executor).not.toMatch(/label\s*===\s*["']Approved\?["']/);
  });
});

describe("the shipped Document Intake swarm uses the deterministic gate", () => {
  const swarmJson = JSON.parse(
    readFileSync(resolve("ops/document-intake-v0.1.swarm.json"), "utf8"),
  ) as { nodes: { id: string; data?: Record<string, unknown> }[] };

  it("has the approval-check node in boolean_equals mode", () => {
    const check = swarmJson.nodes.find((n) => n.id === "approval-check");
    expect(check, "approval-check node is gone — re-anchor this test").toBeTruthy();
    expect(check!.data?.conditionMode).toBe("boolean_equals");
    expect(check!.data?.inputs).toEqual(expect.arrayContaining(["reviewed_proposal_approved"]));
  });
});
