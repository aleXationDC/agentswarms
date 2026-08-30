// DMS-D1-0002R Phase C1/C3 — provider-safe boundary regression.
//
// swarmExecute.server.ts has no live-runtime unit tests of its own (it needs
// a Supabase client, an LLM provider and a tracer — see the source-text
// assertions in swarmPublish.test.ts / swarmSchedules.test.ts for the
// established pattern here). This file follows that same convention to pin
// the ONE invariant Phase A1 depends on: every agent/LLM-visible read path
// (ctx seeding, the "kind: input" node's write, and each step's recorded
// trace input) must go through `agentVisibleInput` — never `opts.input`
// directly — so a future edit cannot silently reintroduce the full raw
// envelope into what an external provider or a stored per-node trace step
// sees.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(import.meta.dirname, "../../src/utils/swarmExecute.server.ts"),
  "utf-8",
).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");

describe("swarmExecute.server.ts — agent-visible input boundary", () => {
  it("derives agentVisibleInput from providerSafeInput, falling back to the full input", () => {
    expect(SRC).toMatch(/const agentVisibleInput = opts\.providerSafeInput \?\? opts\.input;/);
  });

  it("seeds ctx.input and the resume fallback from agentVisibleInput, not opts.input", () => {
    expect(SRC).toMatch(/const ctx: Ctx = resumed[\s\S]{0,80}input: agentVisibleInput/);
    expect(SRC).toMatch(
      /let lastOutput = resumed \? resumed\.lastOutput : agentVisibleInput;/,
    );
  });

  it("records the recorded step trace input (C3) from agentVisibleInput, not opts.input", () => {
    expect(SRC).toMatch(
      /const stepInput = kind === "input" \? agentVisibleInput : gatherInputs/,
    );
  });

  it("the 'kind: input' node writes agentVisibleInput, never opts.input, into ctx", () => {
    expect(SRC).toMatch(/write\(agentVisibleInput\);/);
  });

  it("identity reconciliation, the approved filing plan and the approval card still read the FULL opts.input directly (never ctx)", () => {
    expect(SRC).toContain("applyAuthoritativeIdentity(out, opts.input)");
    expect(SRC).toContain("parseJsonObject(opts.input)");
    expect(SRC).toContain("runInput: opts.input");
  });
});

describe("dmsIntake.server.ts — providerSafeInput is actually supplied", () => {
  const DMS_SRC = readFileSync(
    resolve(import.meta.dirname, "../../src/lib/dmsIntake.server.ts"),
    "utf-8",
  ).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");

  it("both processIntake and analyzeDocumentProposal pass providerSafeInput: buildProviderSafeInput(envelope)", () => {
    const occurrences = DMS_SRC.match(/providerSafeInput: buildProviderSafeInput\(envelope\)/g);
    expect(occurrences?.length).toBe(2);
  });

  it("both call sites still pass the FULL envelope as input (identity/approval/archival)", () => {
    const occurrences = DMS_SRC.match(/input: JSON\.stringify\(envelope\)/g);
    expect(occurrences?.length).toBe(2);
  });

  it("analyzeDocumentProposal sets proposalOnly: true", () => {
    expect(DMS_SRC).toMatch(/analyzeDocumentProposal[\s\S]*?proposalOnly: true/);
  });
});

describe("swarmExecute.server.ts — proposalOnly stops before any Approval side effect (Phase D)", () => {
  it("checks opts.proposalOnly BEFORE createApprovalRequest is ever reached at the approval node", () => {
    const approvalNodeBlock = SRC.slice(SRC.indexOf('if (kind === "approval") {'));
    const proposalOnlyIdx = approvalNodeBlock.indexOf("opts.proposalOnly");
    const createApprovalIdx = approvalNodeBlock.indexOf("await createApprovalRequest(");
    expect(proposalOnlyIdx).toBeGreaterThan(-1);
    expect(createApprovalIdx).toBeGreaterThan(-1);
    expect(proposalOnlyIdx).toBeLessThan(createApprovalIdx);
  });

  it("the proposalOnly branch returns immediately via finish(\"proposal\", ...) without persisting a checkpoint", () => {
    expect(SRC).toMatch(/if \(opts\.proposalOnly\) \{[\s\S]{0,400}return await finish\("proposal"/);
  });
});
