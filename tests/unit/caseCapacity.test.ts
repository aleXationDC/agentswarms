import { beforeEach, describe, expect, it, vi } from "vitest";
import { CaseCapacityRequest } from "@/axtn/workbenches/cases/caseCapacityContract";
import { CaseRequest } from "@/axtn/workbenches/documents/documentWorkContract";
import { executeCaseWork } from "@/axtn/workbenches/cases/work.server";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));
const owner = "11111111-1111-4111-8111-111111111111";
const request = {
  operation: "capacity_consumption",
  consumptionId: "22222222-2222-4222-8222-222222222222",
  commitmentId: "33333333-3333-4333-8333-333333333333",
  caseId: owner,
  transitionKey: "explicit-hours",
  expectedVersion: 0,
  bookedOn: "2026-10-05",
  hours: 1.5,
  capabilityRef: "synthetic:review",
  purpose: "ASSURANCE",
};
describe("explicit native capacity", () => {
  beforeEach(() => rpc.mockReset().mockResolvedValue({ data: { hours: 1.5 }, error: null }));
  it("routes through the same Case endpoint with authenticated Human identity", async () => {
    expect(CaseRequest.parse(request)).toEqual(request);
    await executeCaseWork(owner, request, { kind: "user_session", id: owner });
    const { operation: _operation, ...payload } = request;
    expect(rpc).toHaveBeenCalledWith("axtn_case_capacity", {
      p_user_id: owner,
      p_operation: "capacity_consumption",
      p_payload: { ...payload, _principal: { kind: "user_session", id: owner } },
    });
  });
  it.each([-1, Infinity, NaN, 100001, 0.00001])("rejects invalid hours %s", (hours) => {
    expect(CaseCapacityRequest.safeParse({ ...request, hours }).success).toBe(false);
  });
  it.each(["ownerId", "credentialId", "privateAbsenceReason", "accepted", "durationHours"])(
    "rejects unrelated authority or private field %s",
    (field) => {
      expect(CaseCapacityRequest.safeParse({ ...request, [field]: owner }).success).toBe(false);
    },
  );
  it("allows explicit append-only correction, not a negative reversal", () => {
    expect(CaseCapacityRequest.safeParse({ ...request, hours: 0, supersedes: owner }).success).toBe(
      true,
    );
    expect(CaseCapacityRequest.safeParse({ ...request, bookedOn: "2026-02-30" }).success).toBe(
      false,
    );
  });
  it("keeps historical vs current scope and bounded paging explicit", () => {
    expect(CaseCapacityRequest.parse({ operation: "capacity_view" })).toEqual({
      operation: "capacity_view",
      scope: "CURRENT",
      offset: 0,
      limit: 50,
    });
    expect(CaseCapacityRequest.safeParse({ operation: "capacity_view", limit: 201 }).success).toBe(
      false,
    );
  });
  it("denies automation bookings and foreign human before RPC", async () => {
    await expect(executeCaseWork(owner, request)).rejects.toThrow("AUTHENTICATED_HUMAN_REQUIRED");
    await expect(
      executeCaseWork(owner, request, {
        kind: "user_session",
        id: request.consumptionId,
      }),
    ).rejects.toThrow("PRINCIPAL_DENIED");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("surfaces limits instead of a success-shaped fallback", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "CASE_CAPACITY_CONSUMPTION_LIMIT" } });
    await expect(
      executeCaseWork(owner, request, { kind: "user_session", id: owner }),
    ).rejects.toThrow("CONSUMPTION_LIMIT");
  });
});
