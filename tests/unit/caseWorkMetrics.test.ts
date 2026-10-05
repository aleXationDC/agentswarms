import { describe, expect, it } from "vitest";
import { WorkState } from "@/axtn/workbenches/cases/workContract";
import { workMetrics } from "@/axtn/workbenches/cases/workMetrics";

const root = "11111111-1111-4111-8111-111111111111";
const child = "22222222-2222-4222-8222-222222222222";
const work = {
  sourceId: "kpi",
  subject: "KPI fixture",
  caseType: "DEVELOPMENT_BUILD",
  workContractRef: {
    kind: "contract",
    repository: "aXtn/aXtn-agentswarms",
    id: "tests/unit/caseWorkMetrics.test.ts",
  },
  scenarioClass: "regression",
  scenarioId: "kpi",
  processingMode: "DETERMINISTIC",
  executionChannel: "COPILOT_CLI",
  actorRef: "copilot",
};
const state = () =>
  WorkState.parse({
    cases: [
      {
        case_id: root,
        parent_case_id: null,
        subject: "Root",
        case_type: "DEVELOPMENT_CHANGE",
        status: "OPEN",
        priority: 3,
        work_identity: { ...work, scenarioClass: "real_work" },
        processing_mode: "SEMANTIC",
        execution_channel: "COPILOT_CLI",
        actor_ref: "copilot",
      },
      {
        case_id: child,
        parent_case_id: root,
        subject: "Child",
        case_type: "DEVELOPMENT_VERIFY",
        status: "CLOSED",
        priority: 3,
        work_identity: { ...work, scenarioClass: "synthetic_acceptance" },
        processing_mode: "DETERMINISTIC",
        execution_channel: "SWARM",
        actor_ref: "verifier",
      },
    ],
    events: [],
  });

describe("shared Case KPIs without producer or scenario exclusions", () => {
  it("treats an explicitly scoped non-Work parent as a view boundary, not global corruption", () => {
    const fixture = state();
    fixture.cases = [fixture.cases[1]];
    fixture.cases[0].view_root_reason = "PARENT_OUTSIDE_WORK_VIEW";
    delete fixture.cases[0].work_identity;
    fixture.cases[0].scenario_class = "synthetic_acceptance";
    fixture.cases[0].initial_processing_mode = "DETERMINISTIC";
    expect(workMetrics(fixture)).toMatchObject({ totalCases: 1, rootCount: 1, maxDepth: 0 });
    expect(workMetrics(fixture).segments[0].scenarioClass).toBe("synthetic_acceptance");
  });
  it("derives root hierarchy and measures every scenario/channel", () => {
    const metrics = workMetrics(state());
    expect(metrics.totalCases).toBe(2);
    expect(metrics.completedCases).toBe(1);
    expect(metrics.rootCount).toBe(1);
    expect(metrics.maxDepth).toBe(1);
    expect(metrics.lineage).toContainEqual({ caseId: child, rootCaseId: root, depth: 1 });
    expect(metrics.segments.map((segment) => segment.scenarioClass).sort()).toEqual([
      "real_work",
      "synthetic_acceptance",
    ]);
  });

  it("does not silently discard older Cases without work dimensions", () => {
    const fixture = state();
    delete fixture.cases[1].work_identity;
    delete fixture.cases[1].processing_mode;
    delete fixture.cases[1].execution_channel;
    expect(workMetrics(fixture).totalCases).toBe(2);
    expect(workMetrics(fixture).automationRatio).toBe(0);
    expect(
      workMetrics(fixture).segments.some((segment) => segment.scenarioClass === "UNSPECIFIED"),
    ).toBe(true);
  });

  it("measures durable Human, rework, blocking and integration events", () => {
    const fixture = state();
    fixture.events = [
      ["STARTED", "00:00:00"],
      ["BLOCKED", "00:00:10"],
      ["REOPENED", "00:00:30"],
      ["TAKEOVER", "00:00:40"],
      ["PR_CREATED", "00:00:45"],
      ["ACCEPTED", "00:00:55"],
      ["COMPLETED", "00:01:00"],
    ].map(([kind, time]) => ({
      caseId: child,
      action: `axtn_work.${kind}`,
      detail: { toMode: "HUMAN" },
      timestamp: `2026-10-03T${time}Z`,
    }));
    const metrics = workMetrics(fixture);
    expect(metrics.humanInterventions).toBe(2);
    expect(metrics.handovers).toBe(1);
    expect(metrics.reworkEvents).toBe(1);
    expect(metrics.durations.find((row) => row.caseId === child)).toMatchObject({
      completedDurationMs: 60000,
      blockedDurationMs: 20000,
      integrationDurationMs: 10000,
    });
  });

  it("fails explicitly for cycles, missing parents and malformed event time", () => {
    const cycle = state();
    cycle.cases[0].parent_case_id = child;
    expect(() => workMetrics(cycle)).toThrow("cycle");
    const missing = state();
    missing.cases = missing.cases.slice(1);
    expect(() => workMetrics(missing)).toThrow("missing");
    const invalid = state();
    invalid.events = [
      { caseId: root, action: "axtn_work.STARTED", detail: {}, timestamp: "invalid" },
    ];
    expect(() => workMetrics(invalid)).toThrow("timestamp");
  });
  it("measures primary mode rather than classifying a late release as automation", () => {
    const fixture = state();
    fixture.cases[1].work_identity = {
      ...fixture.cases[1].work_identity!,
      processingMode: "HUMAN",
    };
    fixture.events = [
      { caseId: child, action: "axtn_work.STARTED", detail: {}, timestamp: "2026-10-03T00:00:00Z" },
      {
        caseId: child,
        action: "axtn_work.TAKEOVER",
        detail: { fromMode: "HUMAN", toMode: "DETERMINISTIC" },
        timestamp: "2026-10-03T00:00:50Z",
      },
      {
        caseId: child,
        action: "axtn_work.COMPLETED",
        detail: {},
        timestamp: "2026-10-03T00:01:00Z",
      },
    ];
    const metrics = workMetrics(fixture);
    expect(metrics.primaryModes).toContainEqual({ caseId: child, processingMode: "HUMAN" });
    expect(metrics.automationRatio).toBe(0);
    expect(metrics.longestAutomaticCompletedChain).toBe(0);
  });
  it("counts independent accountable children, not an overlapping Parent or required predecessor", () => {
    const fixture = state();
    const sibling = "33333333-3333-4333-8333-333333333333";
    fixture.cases.push({ ...fixture.cases[1], case_id: sibling });
    fixture.events = [root, child, sibling].map((caseId) => ({
      caseId,
      action: "axtn_work.STARTED",
      detail: {},
      timestamp: "2026-10-03T00:00:00Z",
    }));
    expect(workMetrics(fixture).maxObservedParallelWork).toBe(2);
    fixture.cases[2].dependencies = [{ caseId: child, kind: "REQUIRES_COMPLETION" }];
    expect(workMetrics(fixture).maxObservedParallelWork).toBe(1);
    fixture.cases[2].dependencies = [{ caseId: child, kind: "INFORMS" }];
    expect(workMetrics(fixture).maxObservedParallelWork).toBe(2);
  });
});
