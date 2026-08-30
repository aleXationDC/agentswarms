// DMS-D1-0002R Phase E — Archive Knowledge indexing must only ever happen
// after an actual human approval, never at intake time and never on reject.
// swarmResume.functions.ts has no isolated unit-test harness of its own (it
// needs a live Supabase client + swarm-run row); this follows the same
// source-text-assertion convention used for swarmExecute.server.ts elsewhere
// in this suite (swarmPublish.test.ts, swarmSchedules.test.ts) to pin the
// gating invariant itself.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RESUME_SRC = readFileSync(
  resolve(import.meta.dirname, "../../src/utils/swarmResume.functions.ts"),
  "utf-8",
).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");

const DMS_SRC = readFileSync(
  resolve(import.meta.dirname, "../../src/lib/dmsIntake.server.ts"),
  "utf-8",
).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");

describe("Archive Knowledge write gating (Phase E)", () => {
  it("gates the only indexArchiveDocument call site on an actual approved decision", () => {
    expect(RESUME_SRC).toMatch(
      /if \(approval\.status === "approved" && documentId\) \{[\s\S]{0,2000}indexArchiveDocument/,
    );
  });

  it("never calls indexArchiveDocument from the intake boundary itself", () => {
    expect(DMS_SRC).not.toContain("indexArchiveDocument");
  });

  it("reads the pseudonymised text back from the run's persisted input_prompt, not a re-derivation", () => {
    expect(RESUME_SRC).toContain('.select("input_prompt")');
    expect(RESUME_SRC).toMatch(/envelope\.text/);
  });
});
