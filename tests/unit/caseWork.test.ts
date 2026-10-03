import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkRequest } from "@/axtn/workbenches/cases/workContract";
import { executeCaseWork } from "@/axtn/workbenches/cases/work.server";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));

const work = {
  sourceId: "implementation:development-swarm-v1",
  subject: "Development Swarm implementation",
  caseType: "DEVELOPMENT_CHANGE",
  workContractRef: {
    kind: "contract",
    repository: "aXtn/aXtn-agentswarms",
    id: "handoffs/requests/AXTN-DEVELOPMENT-SWARM-IMPLEMENTATION-0001.md",
    revision: "1".repeat(40),
  },
  scenarioClass: "real_work",
  scenarioId: "implementation-v1",
  processingMode: "SEMANTIC",
  executionChannel: "COPILOT_CLI",
  actorRef: "copilot",
};

describe("trusted-owner headless Case work", () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: { case_id: "case-1" }, error: null });
  });

  it("takes its owner only from server context", async () => {
    await expect(executeCaseWork("trusted-owner", { operation: "ensure", work })).resolves.toEqual({
      case_id: "case-1",
    });
    expect(rpc).toHaveBeenCalledWith(
      "axtn_case_work",
      expect.objectContaining({ p_user_id: "trusted-owner", p_operation: "ensure" }),
    );
  });

  it.each(["userId", "scopeUserId", "access_token", "owner"])(
    "rejects graph-provided %s",
    async (key) => {
      await expect(
        executeCaseWork("trusted-owner", { operation: "ensure", work, [key]: "untrusted" }),
      ).rejects.toThrow();
      expect(rpc).not.toHaveBeenCalled();
    },
  );

  it("rejects an owner inside the work contract too", () => {
    expect(
      WorkRequest.safeParse({ operation: "ensure", work: { ...work, userId: "untrusted" } })
        .success,
    ).toBe(false);
  });

  it("rejects invalid repository and reference revision contracts", () => {
    for (const ref of [
      { ...work.workContractRef, repository: "foreign/repo" },
      { ...work.workContractRef, revision: "latest" },
    ]) {
      expect(
        WorkRequest.safeParse({ operation: "ensure", work: { ...work, workContractRef: ref } })
          .success,
      ).toBe(false);
    }
  });

  it("does not allow the execution endpoint to assert independent Acceptance", async () => {
    await expect(
      executeCaseWork("trusted-owner", {
        operation: "transition",
        transition: {
          caseId: "11111111-1111-4111-8111-111111111111",
          transitionKey: "self-accept",
          eventType: "ACCEPTED",
          reasonCode: "PASS",
          actorRef: "someone-else",
        },
      }),
    ).rejects.toThrow("Independent Acceptance");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("propagates transaction failures, never a success-shaped fallback", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Work identity conflict" } });
    await expect(executeCaseWork("trusted-owner", { operation: "list" })).rejects.toThrow(
      "Work identity conflict",
    );
  });

  it.each(["processingMode", "executionChannel"])(
    "does not let a machine forge Human %s",
    async (field) => {
      await expect(
        executeCaseWork("trusted-owner", {
          operation: "ensure",
          work: { ...work, [field]: "HUMAN" },
        }),
      ).rejects.toThrow("authenticated user session");
      expect(rpc).not.toHaveBeenCalled();
    },
  );

  it("overrides a caller's Human actor label with actual authenticated identity", async () => {
    await executeCaseWork(
      "trusted-owner",
      {
        operation: "ensure",
        work: {
          ...work,
          processingMode: "HUMAN",
          executionChannel: "HUMAN",
          actorRef: "invented-user",
        },
      },
      { kind: "user_session", id: "actual-auth-user" },
    );
    expect(rpc).toHaveBeenCalledWith(
      "axtn_case_work",
      expect.objectContaining({
        p_payload: expect.objectContaining({
          actorRef: "actual-auth-user",
          _principal: { kind: "user_session", id: "actual-auth-user" },
        }),
      }),
    );
  });

  it("rejects credential URLs, traversal, and malformed typed external identities", () => {
    for (const reference of [
      {
        kind: "evidence",
        repository: "aXtn/aXtn-host",
        id: "https://user:password@example.invalid",
      },
      { kind: "contract", repository: "aXtn/aXtn-host", id: "../credentials" },
      { kind: "pull_request", repository: "aXtn/aXtn-host", id: "merge-main" },
      { kind: "run", repository: "aXtn/aXtn-host", id: "not-a-run" },
    ]) {
      expect(
        WorkRequest.safeParse({ operation: "ensure", work: { ...work, references: [reference] } })
          .success,
      ).toBe(false);
    }
  });

  it("requires native approval identity, never an approved flag or fake actor", () => {
    expect(
      WorkRequest.safeParse({
        operation: "accept",
        caseId: "11111111-1111-4111-8111-111111111111",
        approvalId: "22222222-2222-4222-8222-222222222222",
        candidateSHA: "a".repeat(40),
        transitionKey: "approval",
        approved: true,
        actorRef: "independent-reviewer",
      }).success,
    ).toBe(false);
  });

  it("accepts directed dependency contracts, not an arbitrary relation name", () => {
    const input = {
      operation: "dependencies",
      caseId: "11111111-1111-4111-8111-111111111111",
      transitionKey: "dependencies",
      actorRef: "copilot",
      dependencies: [
        { caseId: "22222222-2222-4222-8222-222222222222", kind: "REQUIRES_CANDIDATE" },
      ],
    };
    expect(WorkRequest.safeParse(input).success).toBe(true);
    expect(
      WorkRequest.safeParse({
        ...input,
        dependencies: [{ ...input.dependencies[0], kind: "uncontrolled" }],
      }).success,
    ).toBe(false);
  });
});
