import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/utils/swarmResume.functions.ts", "utf8");
const section = source.slice(
  source.indexOf("export const resumeApprovedSwarmRun"),
  source.indexOf("export const cancelParkedSwarmRun"),
);

describe("SupaCase filing after D09 resume", () => {
  it("keeps checkpoint resume/cancel behavior and retries filing on a completed run", () => {
    expect(section).toContain('.select("id, user_id, status, input_prompt, final_output")');
    expect(section).toContain("await loadCheckpoint(run.id, run.user_id)");
    expect(section).toContain('if (run.status === "cancelled")');
    expect(section).toContain("run.final_output");
    expect(source).toContain("ensureCaseForAcceptance");
    expect(source).toContain('if (!output?.includes("READY_FOR_FILING")) return null;');
  });
});
