import { beforeEach, describe, expect, it, vi } from "vitest";
import { DevelopmentVerification } from "@/utils/notebookRuntime/developmentContract";

const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("@/utils/tools/registry.server", () => ({ runMcpCallTool: call }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
import { assertDevelopmentSnapshots } from "@/utils/notebookRuntime/developmentSource.server";

const request = DevelopmentVerification.parse({
  schema: "axtn.development.verify/v1",
  repository: "aXtn/development-swarm-acceptance",
  effectKey: "task:attempt:verify",
  taskId: "task",
  attemptId: "attempt",
  caseId: "e9d954a7-8c37-48c9-988d-5942f21bbb19",
  baseSHA: "a".repeat(40),
  candidateSHA: "b".repeat(40),
  profile: "documentation-v1",
  baseline: [{ path: "README.md", content: "baseline\n" }],
  candidate: [{ path: "README.md", content: "candidate\n" }],
});
const result = (value: unknown) => JSON.stringify({ result: { structuredContent: value } });
beforeEach(() => {
  call.mockReset();
  call.mockImplementation(async (_ctx, args) => {
    const baseline = args.arguments.ref === request.baseSHA;
    return args.tool_name === "repository_tree"
      ? result({
          sha: args.arguments.ref,
          truncated: false,
          tree: [{ path: "README.md", type: "blob", mode: "100644" }],
        })
      : result({
          content: Buffer.from(baseline ? "baseline\n" : "candidate\n").toString("base64"),
          encoding: "base64",
          size: baseline ? 9 : 10,
        });
  });
});
describe("native immutable Git snapshot authority", () => {
  it("binds both complete snapshots through the existing owner-scoped native broker", async () => {
    await assertDevelopmentSnapshots("owner", request);
    expect(call).toHaveBeenCalledTimes(4);
    for (const [ctx, args, allow] of call.mock.calls) {
      expect(ctx.userId).toBe("owner");
      expect(ctx.scopeUserId).toBe("owner");
      expect(args.arguments.owner).toBe("aXtn");
      expect(args.arguments.repository).toBe("development-swarm-acceptance");
      expect(allow).toEqual(["aXtn Development Gitea"]);
    }
  });
  it("rejects falsely SHA-labelled caller content", async () => {
    await expect(
      assertDevelopmentSnapshots("owner", {
        ...request,
        candidate: [{ path: "README.md", content: "forged\n" }],
      }),
    ).rejects.toThrow("differs");
  });
  it.each([{ error: { code: 401 } }, { result: { isError: true } }, { result: { content: [] } }])(
    "fails closed on HTTP-success protocol errors or missing data",
    async (wire) => {
      call.mockResolvedValueOnce(JSON.stringify(wire));
      await expect(assertDevelopmentSnapshots("owner", request)).rejects.toThrow();
    },
  );
  it.each([
    { sha: "c".repeat(40), tree: [] },
    { sha: request.baseSHA, truncated: true, tree: [] },
    { sha: request.baseSHA, tree: [{ path: "README.md", type: "blob", mode: "120000" }] },
  ])("rejects revision drift, truncation and symlinks", async (tree) => {
    call.mockResolvedValueOnce(result(tree));
    await expect(assertDevelopmentSnapshots("owner", request)).rejects.toThrow();
  });
  it("rejects partial file and invalid UTF-8 data", async () => {
    call.mockResolvedValueOnce(
      result({ sha: request.baseSHA, tree: [{ path: "README.md", type: "blob", mode: "100644" }] }),
    );
    call.mockResolvedValueOnce(
      result({ content: Buffer.from([255]).toString("base64"), size: 1, encoding: "base64" }),
    );
    await expect(assertDevelopmentSnapshots("owner", request)).rejects.toThrow("UTF-8");
  });
});
