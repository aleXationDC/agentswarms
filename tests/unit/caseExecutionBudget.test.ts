import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { CaseExecutionBinding } from "@/axtn/workbenches/cases/caseExecution.server";

const fixture = vi.hoisted(() => ({
  reads: [] as { table: string; filters: Record<string, unknown> }[],
  rows: [] as Record<string, unknown>[],
  groupCap: 10,
  keyCap: 100,
  groupSpend: 12,
  unpriced: 0,
  rpcError: null as { message: string } | null,
  insertError: null as { message: string } | null,
  groupAlert: vi.fn(),
  userAlert: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => {
  class Query {
    filters: Record<string, unknown> = {};
    constructor(private table: string) {}
    select() {
      return this;
    }
    gte() {
      return this;
    }
    is() {
      return this;
    }
    or() {
      return this;
    }
    eq(key: string, value: unknown) {
      this.filters[key] = value;
      return this;
    }
    async maybeSingle() {
      fixture.reads.push({ table: this.table, filters: this.filters });
      return {
        data:
          this.table === "budget_limits"
            ? {
                monthly_cap_usd:
                  this.filters.scope_type === "group" ? fixture.groupCap : fixture.keyCap,
                is_active: true,
              }
            : { monthly_cap_usd: 10 },
        error: null,
      };
    }
    async insert(row: Record<string, unknown>) {
      fixture.rows.push(row);
      return { error: fixture.insertError };
    }
    then(resolve: (value: { data: never[]; count: number; error: null }) => unknown) {
      return Promise.resolve(resolve({ data: [], count: 0, error: null }));
    }
  }
  return {
    supabaseAdmin: {
      from: (table: string) => new Query(table),
      rpc: vi.fn(async (name: string) => ({
        data:
          name === "axtn_case_group_spend"
            ? { spend: fixture.groupSpend, unpriced: fixture.unpriced }
            : 15,
        error: fixture.rpcError,
      })),
    },
  };
});
vi.mock("@/lib/email/budgetAlertTrigger.server", () => ({
  checkAndNotifyBudget: fixture.userAlert,
  checkAndNotifyGroupBudgets: fixture.groupAlert,
}));
const { getCaseBudgetDecision } = await import("@/utils/budgetGuard.server");
const { recordGatewayCall } = await import("@/utils/observability/recordGatewayUsage.server");
const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

const owner = "77111111-1111-4111-8111-111111111111";
const payer = "77222222-2222-4222-8222-222222222222";
const group = "77333333-3333-4333-8333-333333333333";
const run = "77444444-4444-4444-8444-444444444444";
const binding: CaseExecutionBinding = {
  case_id: "77555555-5555-4555-8555-555555555555",
  attempt_id: run,
  assignment_version: 1,
  semantic_route_version: 1,
  execution_class: "SYSTEM_INTEGRATION",
  execution_principal_type: "SYSTEM",
  execution_principal_user_id: null,
  data_scope_user_id: owner,
  policy_user_id: owner,
  responsible_group_id: group,
  budget_subject_group_id: group,
  budget_subject_user_id: null,
  provider_id: "openai",
  model_id: "fixture-model",
  route_provider_id: null,
  route_model_id: null,
  routing_reason: "CASE_SYSTEM_POLICY",
  bound_at: "2026-10-05T20:00:00Z",
  node_routes: {},
};

describe("native Case budget subject is not data custody or caller membership", () => {
  beforeEach(() => {
    vi.stubEnv("ENFORCE_BUDGET_CAP", "true");
    vi.stubEnv("BUDGET_FAIL_CLOSED", "true");
    fixture.reads.length = 0;
    fixture.rows.length = 0;
    fixture.groupCap = 10;
    fixture.keyCap = 100;
    fixture.groupSpend = 12;
    fixture.unpriced = 0;
    fixture.rpcError = null;
    fixture.insertError = null;
    vi.clearAllMocks();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("blocks at the responsible-group cap without consulting operator or other groups", async () => {
    expect(await getCaseBudgetDecision(binding)).toEqual({
      over: true,
      scope: "group",
      spend: 12,
      cap: 10,
    });
    expect(fixture.reads).toEqual([
      {
        table: "budget_limits",
        filters: { scope_type: "group", scope_id: group },
      },
    ]);
  });
  it("retains the API-key ceiling independently of the company payer", async () => {
    fixture.groupCap = 100;
    fixture.keyCap = 10;
    expect(await getCaseBudgetDecision(binding, { type: "swarm_api_key", id: run })).toEqual({
      over: true,
      scope: "credential",
      spend: 15,
      cap: 10,
    });
  });
  it("checks personal execution against the actual person, not the custodian", async () => {
    expect(
      await getCaseBudgetDecision({
        ...binding,
        budget_subject_group_id: null,
        budget_subject_user_id: payer,
        policy_user_id: payer,
        execution_class: "PERSONAL_CONNECTION",
        execution_principal_type: "USER",
        execution_principal_user_id: payer,
      }),
    ).toMatchObject({ over: true, scope: "user", spend: 15 });
    expect(fixture.reads[0]).toEqual({ table: "budget_settings", filters: { user_id: payer } });
  });
  it("does no budget query when native enforcement is off", async () => {
    vi.stubEnv("ENFORCE_BUDGET_CAP", "false");
    expect(await getCaseBudgetDecision(binding)).toMatchObject({ over: false });
    expect(fixture.reads).toEqual([]);
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });
  it("does not mistake unknown or unpriced company spend for zero under fail-closed", async () => {
    fixture.rpcError = { message: "statement timeout" };
    expect(await getCaseBudgetDecision(binding)).toMatchObject({ over: true, scope: "group" });
    fixture.rpcError = null;
    fixture.groupSpend = 0;
    fixture.unpriced = 1;
    expect(await getCaseBudgetDecision(binding)).toMatchObject({ over: true, scope: "group" });
    vi.stubEnv("BUDGET_FAIL_CLOSED", "false");
    expect(await getCaseBudgetDecision(binding)).toMatchObject({ over: false });
  });
  it("keeps trace custody private while attributing the tool-round cost to its payer", async () => {
    await recordGatewayCall({
      userId: owner,
      surface: "Chat: tool-round",
      model: "fixture-model",
      provider: "openai",
      providerCostUsd: 2,
      tokensIn: 3,
      tokensOut: 4,
      caseBudget: { runId: run, userId: payer, groupId: null },
    });
    expect(fixture.rows[0]).toMatchObject({
      user_id: owner,
      cost_usd: 2,
      budget_subject_user_id: payer,
      budget_subject_group_id: null,
      budget_execution_run_id: run,
    });
    expect(fixture.userAlert).toHaveBeenCalledWith(payer);
  });
  it("notifies only the funded group, including an operator outside that group", async () => {
    await recordGatewayCall({
      userId: owner,
      surface: "Chat: tool-round",
      model: "fixture-model",
      caseBudget: { runId: run, userId: null, groupId: group },
    });
    expect(fixture.userAlert).not.toHaveBeenCalled();
    expect(fixture.groupAlert).toHaveBeenCalledWith(owner, group);
  });
  it("surfaces Case evidence write failure instead of returning successful accounting", async () => {
    fixture.insertError = { message: "write unavailable" };
    await expect(
      recordGatewayCall({
        userId: owner,
        surface: "Chat: tool-round",
        model: "fixture-model",
        caseBudget: { runId: run, userId: payer, groupId: null },
      }),
    ).rejects.toThrow("CASE_EXECUTION_EVIDENCE_WRITE_FAILED");
  });
});
