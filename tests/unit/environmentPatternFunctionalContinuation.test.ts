import { describe, expect, it } from "vitest";
import { agenticCaseGraph } from "../fixtures/environment-pattern/agentic-case-graph.mjs";
import { interpolate } from "@/lib/swarmRuntime";
import { CaseProcessingRequest } from "@/axtn/workbenches/cases/caseProcessingContract";
import { validatePlan, toSemanticQuery } from "@/lib/biGenerateSemantic";
import { compileSemanticQuery } from "@/lib/semanticLayer";
import type { SemanticModel } from "@/lib/semanticLayer";
import { applyAccessPolicy } from "@/lib/semanticPolicy";

const caseId = "11111111-1111-4111-8111-111111111111";
const model: SemanticModel = {
  name: "synthetic_snapshot",
  source: { kind: "data_table", table: "synthetic_snapshot" },
  dimensions: [{ name: "stage", sql: "stage", type: "categorical" }],
  metrics: [{ name: "case_count", agg: "sum", sql: "case_count" }],
};

describe("fixed native pilot composition boundaries", () => {
  it("uses actual native Agent -> Tool -> Output, not custom sequencing", () => {
    const graph = agenticCaseGraph({
      caseId,
      expectedVersion: 3,
      transitionKey: "synthetic-effect",
    });
    expect(graph.nodes.map((node) => node.data.kind)).toEqual(["agent", "tool", "output"]);
    expect(graph.nodes[1].data.toolId).toBe("case_work");
    const request = JSON.parse(
      interpolate(graph.nodes[1].data.toolArgs.request, {
        proposal: '{"processing_stage":"VALIDATION_REVIEW"}',
      }),
    );
    expect(CaseProcessingRequest.parse(request)).toEqual({
      operation: "processing",
      caseId,
      expectedVersion: 3,
      transitionKey: "synthetic-effect",
      reasonCode: "PILOT_SYNTHETIC_AGENTIC_EFFECT",
      patch: { processing_stage: "VALIDATION_REVIEW" },
    });
  });

  it.each([
    '{"status":"CLOSED"}',
    '{"processing_stage":"VALIDATION_REVIEW","userId":"foreign"}',
    '{"processing_stage":"UNKNOWN"}',
    "null",
  ])("refuses an undeclared model effect %s", (proposal) => {
    const graph = agenticCaseGraph({
      caseId,
      expectedVersion: 3,
      transitionKey: "synthetic-effect",
    });
    const request = JSON.parse(interpolate(graph.nodes[1].data.toolArgs.request, { proposal }));
    expect(CaseProcessingRequest.safeParse(request).success).toBe(false);
  });

  it("compiles a declared bounded View intent and excludes arbitrary model SQL", () => {
    const plan = validatePlan(
      [
        {
          title: "Synthetic Case count",
          chartType: "table",
          metrics: ["case_count"],
          dimensions: ["stage"],
          sql: "SELECT * FROM auth.users",
        },
      ],
      model,
    );
    expect(plan.rejected).toEqual([]);
    const intent = toSemanticQuery(plan.widgets[0], model.name);
    expect(intent).not.toHaveProperty("sql");
    const compiled = compileSemanticQuery(model, intent);
    expect(compiled.sql).not.toContain("auth.users");
    expect(compiled.sql).toContain("SUM");
  });

  it("refuses prompt injection in a metric name rather than interpreting it", () => {
    const plan = validatePlan(
      [
        {
          title: "Synthetic adversarial data",
          chartType: "kpi",
          metrics: ["case_count; SELECT * FROM auth.users"],
        },
      ],
      model,
    );
    expect(plan.widgets).toEqual([]);
    expect(plan.rejected).toHaveLength(1);
  });

  it("a hidden field remains refused even when a planner names it", () => {
    expect(() =>
      applyAccessPolicy(
        model,
        { model: model.name, metrics: ["case_count"] },
        { rowFilters: null, maskedFields: ["case_count"] },
      ),
    ).toThrow(/masked|not allowed|hidden/i);
  });
});
