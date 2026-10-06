import { describe, expect, it } from "vitest";
import { classifySwarmUsage } from "@/lib/swarmUsage";

const input = (id: string) => ({ id, data: { kind: "input" } });
const output = (id: string) => ({ id, data: { kind: "output" } });

describe("published Swarm usage classification", () => {
  it("uses published parent references to identify reusable sub-swarms", () => {
    const rows = [
      {
        id: "parent",
        name: "Document Management",
        nodes: [],
        edges: [],
        published_at: "now",
        published_nodes: [
          input("input"),
          { id: "privacy", data: { kind: "subswarm", subSwarmId: "privacy-id" } },
          output("output"),
        ],
        published_edges: [
          { id: "a", source: "input", target: "privacy" },
          { id: "b", source: "privacy", target: "output" },
        ],
      },
      {
        id: "privacy-id",
        name: "Privacy",
        nodes: [],
        edges: [],
        published_at: "now",
        published_nodes: [input("pi"), output("po")],
        published_edges: [{ id: "edge", source: "pi", target: "po" }],
      },
    ];
    const usage = classifySwarmUsage(rows);
    expect(usage.get("parent")).toMatchObject({ category: "workflow" });
    expect(usage.get("privacy-id")).toMatchObject({
      category: "component",
      referencedBy: ["Document Management"],
    });
  });

  it("keeps unreferenced helpers and drafts visible without inferring a test identity", () => {
    const rows = [
      {
        id: "helper",
        name: "Regression Candidate",
        nodes: [input("hi"), output("ho")],
        edges: [{ id: "x", source: "hi", target: "ho" }],
        published_at: "now",
        published_nodes: [input("hi"), output("ho")],
        published_edges: [{ id: "x", source: "hi", target: "ho" }],
      },
      {
        id: "draft",
        name: "Untitled",
        nodes: [input("i"), output("o")],
        edges: [{ id: "e", source: "i", target: "o" }],
        published_at: null,
      },
    ];
    const usage = classifySwarmUsage(rows);
    expect(usage.get("helper")?.category).toBe("workflow");
    expect(usage.get("draft")?.category).toBe("draft");
    expect(usage.size).toBe(rows.length);
  });

  it("does not count a disconnected sub-swarm node as an active dependency", () => {
    const usage = classifySwarmUsage([
      {
        id: "parent",
        name: "Parent",
        nodes: [],
        edges: [],
        published_at: "now",
        published_nodes: [
          input("input"),
          { id: "unused", data: { kind: "subswarm", subSwarmId: "child" } },
          output("output"),
        ],
        published_edges: [{ id: "e", source: "input", target: "output" }],
      },
      {
        id: "child",
        name: "Child",
        nodes: [],
        edges: [],
        published_at: "now",
        published_nodes: [input("i"), output("o")],
        published_edges: [{ id: "e", source: "i", target: "o" }],
      },
    ]);
    expect(usage.get("child")).toMatchObject({ category: "workflow", referencedBy: [] });
  });
});
