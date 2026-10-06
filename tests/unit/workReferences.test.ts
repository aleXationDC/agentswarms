import { describe, expect, it } from "vitest";
import { WorkCase, WorkReference, type WorkState } from "@/axtn/workbenches/cases/workContract";
import { workReferences } from "@/axtn/workbenches/cases/workReferences";

const record = WorkCase.parse({
  case_id: "a8753929-d860-4391-a551-4f0d1d90b8f0",
  parent_case_id: null,
  subject: "Native work",
  case_type: "DEVELOPMENT_CHANGE",
  status: "OPEN",
  priority: 3,
  references: [],
});
const ref = WorkReference.parse({
  kind: "evidence",
  repository: "aXtn/aXtn-agentswarms",
  id: "retained-result",
  revision: "a".repeat(40),
});
const event = (caseId: string, request: unknown): WorkState["events"][number] => ({
  caseId,
  action: "axtn_work.RESULT",
  timestamp: "2026-10-06T00:00:00Z",
  detail: { request },
});

describe("visible authoritative native Work evidence", () => {
  it("projects durable audit request and result references when inline references are empty", () => {
    expect(
      workReferences(record, [event(record.case_id, { references: [ref], resultRef: ref })]),
    ).toEqual({ references: [ref], errors: [] });
  });
  it("preserves old/new revisions, deduplicates identical references and excludes other Cases", () => {
    const older = { ...ref, revision: "b".repeat(40) };
    expect(
      workReferences({ ...record, references: [older] }, [
        event(record.case_id, { references: [older, ref] }),
        event("b8753929-d860-4391-a551-4f0d1d90b8f0", {
          references: [{ ...ref, id: "other-case" }],
        }),
      ]).references,
    ).toEqual([older, ref]);
  });
  it("surfaces malformed persisted references instead of claiming empty/success", () => {
    const result = workReferences(record, [event(record.case_id, { references: ["malformed"] })]);
    expect(result.references).toEqual([]);
    expect(result.errors).toHaveLength(1);
  });
});
