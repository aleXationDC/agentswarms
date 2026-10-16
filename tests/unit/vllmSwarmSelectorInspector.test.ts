// aXtn vLLM Swarm Selector: the node inspector reads the native llm_gateway
// integration like AgentForm, and a gateway opt-in needs no direct connection.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync("src/components/swarms/NodeInspector.tsx", "utf8");

describe("NodeInspector gateway opt-in (aXtn vLLM Swarm Selector)", () => {
  it("reads only the native llm_gateway integration, never its config", () => {
    expect(src).toContain('r.type === "llm_gateway" && r.is_active');
    expect(src).toContain('select("provider, type, is_active, name")');
    expect(src).not.toMatch(/select\("provider, type, is_active, (name, )?config"\)/);
  });

  it("keeps vllm a direct llm_provider choice, separate from the gateway", () => {
    expect(src).toContain('{ value: "vllm", label: "vLLM (self-hosted)" }');
    expect(src).not.toMatch(/value: "(llmhub|llm_gateway)"/);
  });

  it("offers the opt-in only against a connected gateway, but always lets it be switched off", () => {
    expect(src).toContain(
      "disabled={!gatewayConnected.connected && data.routeThroughGateway !== true}",
    );
  });

  it("does not require a direct provider connection when opted in via a connected gateway", () => {
    expect(src).toContain("data.routeThroughGateway === true && gatewayConnected.connected");
    expect(src).toMatch(/viaGateway \|\| connectedProviders\.has\(p\.value\)/);
  });

  it("passes the flag to the model catalogue so discovery uses the same route", () => {
    expect(src).toContain("routeThroughGateway={data.routeThroughGateway === true}");
  });
});
