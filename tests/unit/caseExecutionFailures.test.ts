import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
import {
  caseFailureStatus,
  caseProviderFailure,
  caseProviderLine,
} from "@/axtn/workbenches/cases/caseExecution.server";
import { readChatStream } from "@/lib/chatStream";

describe("Case provider failures never expose foreign credential-bearing errors", () => {
  it.each([
    [401, true, "PERSONAL_CONNECTION_REAUTH_REQUIRED"],
    [401, false, "SYSTEM_INTEGRATION_REAUTH_REQUIRED"],
    [402, true, "PERSONAL_PLAN_LIMIT_REACHED"],
    [429, false, "SYSTEM_INTEGRATION_QUOTA_REACHED"],
    [403, true, "MODEL_ACCESS_DENIED"],
    [404, false, "PROVIDER_CAPABILITY_UNSUPPORTED"],
    [500, false, "PROVIDER_UNAVAILABLE"],
  ])("projects HTTP %s using the actual execution class", (status, personal, code) => {
    const error = new Error(`Vendor error [${status}]: SYNTHETIC_FOREIGN_SECRET`);
    expect(caseProviderFailure(error, personal)).toBe(code);
    expect(() =>
      caseProviderLine(
        `data: ${JSON.stringify({
          error: { status, message: error.message },
        })}`,
        personal,
      ),
    ).toThrow(code);
  });
  it("normalizes malformed or unrecognized frames instead of returning provider bodies", () => {
    for (const data of [
      "SYNTHETIC_FOREIGN_SECRET",
      "null",
      '{"debug":"SYNTHETIC_FOREIGN_SECRET"}',
      '{"choices":"SYNTHETIC_FOREIGN_SECRET"}',
    ]) {
      expect(() => caseProviderLine(`data: ${data}`, true)).toThrow("PROVIDER_UNAVAILABLE");
    }
    expect(caseProviderLine("event: vendor_debug", true)).toBe("");
    expect(caseProviderLine(": SYNTHETIC_FOREIGN_SECRET", true)).toBe("");
  });
  it("keeps native assistant content and measured usage but strips vendor debug metadata", () => {
    const projected = caseProviderLine(
      `data: ${JSON.stringify({
        choices: [
          {
            index: 0,
            delta: { content: "safe result", debug: "SYNTHETIC_FOREIGN_SECRET" },
            debug: "SYNTHETIC_FOREIGN_SECRET",
          },
        ],
        usage: {
          prompt_tokens: 12,
          completion_tokens: 5,
          cost: 0.25,
          debug: "SYNTHETIC_FOREIGN_SECRET",
        },
        debug: "SYNTHETIC_FOREIGN_SECRET",
      })}`,
      true,
    );
    expect(projected).not.toContain("SYNTHETIC_FOREIGN_SECRET");
    expect(JSON.parse(projected.slice(5))).toEqual({
      choices: [{ index: 0, delta: { content: "safe result" } }],
      usage: { prompt_tokens: 12, completion_tokens: 5, cost: 0.25 },
    });
  });
  it("transports a typed terminal failure after partial output and does not return partial success", async () => {
    const cancelled = vi.fn();
    const frame =
      'data: {"choices":[{"delta":{"content":"partial"}}]}\n\n' +
      'event: error\ndata: {"error":"PERSONAL_PLAN_LIMIT_REACHED"}\n\n';
    let sent = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (!sent) {
          controller.enqueue(new TextEncoder().encode(frame));
          sent = true;
        }
      },
      cancel: cancelled,
    });
    await expect(
      readChatStream(body, {
        error: (failure) => {
          throw new Error((failure as { error: string }).error);
        },
      }),
    ).rejects.toThrow("PERSONAL_PLAN_LIMIT_REACHED");
    expect(cancelled).toHaveBeenCalledOnce();
  });
  it("leaves legacy telemetry/error handling unchanged unless the native caller opts in", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            'event: error\ndata: {"error":"ignored"}\n\n' +
              'data: {"choices":[{"delta":{"content":"legacy"}}]}\n\n',
          ),
        );
        controller.close();
      },
    });
    expect(await readChatStream(body)).toBe("legacy");
    expect(caseFailureStatus("PERSONAL_CONNECTION_REAUTH_REQUIRED")).toBe(401);
    expect(caseFailureStatus("SYSTEM_INTEGRATION_QUOTA_REACHED")).toBe(402);
    expect(caseFailureStatus("MODEL_ACCESS_DENIED")).toBe(403);
    expect(caseFailureStatus("CASE_EXECUTION_READBACK_RECOVERY_REQUIRED")).toBe(409);
  });
});
