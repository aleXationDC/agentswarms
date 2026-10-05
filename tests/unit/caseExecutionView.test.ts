import { beforeEach, describe, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  allowed: true,
  reads: [] as string[],
  error: null as { message: string } | null,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: async (_name: string, args: { p_payload: { sharedOnly: boolean } }) => {
      if (args.p_payload.sharedOnly !== false) throw new Error("CASE_ASSIGNMENT_VIEW_REQUIRED");
      return {
        data: {
          scope: "AUTHORIZED_CASES",
          total: fixture.allowed ? 1 : 0,
          offset: 0,
          limit: 1,
          cases: fixture.allowed
            ? [
                {
                  case_id: "99111111-1111-4111-8111-111111111111",
                  subject: "Synthetic Case",
                  case_access_mode: "RESPONSIBLE",
                },
              ]
            : [],
        },
        error: null,
      };
    },
    from: (table: string) => {
      fixture.reads.push(table);
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        order: () => query,
        limit: () => query,
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve(
            resolve({
              data:
                table === "swarm_runs"
                  ? [
                      {
                        id: "99222222-2222-4222-8222-222222222222",
                        case_attempt_id: "synthetic-attempt",
                        status: "error",
                        case_execution_binding: null,
                        prompt: "SYNTHETIC_PRIVATE_PROMPT",
                        output_summary: "SYNTHETIC_PRIVATE_RESULT",
                      },
                    ]
                  : [
                      {
                        resource_id: "99222222-2222-4222-8222-222222222222",
                        detail: {
                          reasonCode: "PERSONAL_PLAN_LIMIT_REACHED",
                          private: "SYNTHETIC_PRIVATE_EVIDENCE",
                        },
                      },
                    ],
              count: 23,
              error: fixture.error,
            }),
          ),
      };
      return query;
    },
  },
}));
import { readCaseExecutionView } from "@/axtn/workbenches/cases/caseExecution.server";
const owner = "99333333-3333-4333-8333-333333333333";
const read = () =>
  readCaseExecutionView(owner, "99111111-1111-4111-8111-111111111111", {
    kind: "user_session",
    id: owner,
  });
describe("native Case execution minimized readback", () => {
  beforeEach(() => {
    fixture.allowed = true;
    fixture.reads = [];
    fixture.error = null;
  });
  it("reauthorizes Case access before reading any run or audit", async () => {
    fixture.allowed = false;
    await expect(read()).rejects.toThrow("CASE_ACCESS_DENIED");
    expect(fixture.reads).toEqual([]);
  });
  it("shows real bounded count, run/Attempt and typed failure without private evidence", async () => {
    const view = await read();
    expect(view.total).toBe(23);
    expect(view.limit).toBe(20);
    expect(view.runs[0]).toMatchObject({
      attemptId: "synthetic-attempt",
      failureCode: "PERSONAL_PLAN_LIMIT_REACHED",
    });
    expect(JSON.stringify(view)).not.toContain("SYNTHETIC_PRIVATE");
  });
  it("does not display an empty-success view on native storage failure", async () => {
    fixture.error = { message: "synthetic database unavailable" };
    await expect(read()).rejects.toThrow("CASE_EXECUTION_RUN_READ_FAILED");
  });
});
