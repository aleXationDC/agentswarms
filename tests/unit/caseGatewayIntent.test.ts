import { describe, expect, it } from "vitest";
import { nodeGatewayIntent } from "@/axtn/workbenches/cases/caseExecution.server";

const snapshot = {
  nodes: [
    { id: "a", data: { routeThroughGateway: true } },
    { id: "b", data: { routeThroughGateway: false } },
    { id: "c", data: {} },
  ],
};

describe("per-agent gateway intent comes from the persisted run snapshot", () => {
  it("is true only for the opted-in agent", () => {
    expect(nodeGatewayIntent(snapshot, "a")).toBe(true);
    expect(nodeGatewayIntent(snapshot, "b")).toBe(false);
    expect(nodeGatewayIntent(snapshot, "c")).toBe(false);
  });
  it("defaults to false for missing, unknown or malformed snapshots", () => {
    expect(nodeGatewayIntent(snapshot, "unknown")).toBe(false);
    expect(nodeGatewayIntent(null, "a")).toBe(false);
    expect(nodeGatewayIntent({ nodes: "x" }, "a")).toBe(false);
    expect(nodeGatewayIntent({ nodes: [{ id: "a", data: { routeThroughGateway: "true" } }] }, "a")).toBe(false);
  });
});
