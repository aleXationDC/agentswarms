import { describe, expect, it } from "vitest";
import {
  DevelopmentVerification,
  credentiallessDevelopmentEnv,
} from "@/utils/notebookRuntime/developmentContract";
import { developmentRuntimeImage } from "@/utils/notebookRuntime/developmentImage.server";

const request = {
  schema: "axtn.development.verify/v1",
  repository: "aXtn/development-swarm-acceptance",
  effectKey: "task:attempt:verify",
  taskId: "task",
  attemptId: "attempt",
  caseId: "e9d954a7-8c37-48c9-988d-5942f21bbb19",
  baseSHA: "a".repeat(40),
  candidateSHA: "b".repeat(40),
  profile: "python-normalization-v1",
  baseline: [],
  candidate: [{ path: "src/normalize_score.py", content: "pass\n" }],
};

describe("native Development Runtime contract", () => {
  it("accepts a bounded exact immutable request", () => {
    expect(DevelopmentVerification.parse(request)).toEqual(request);
  });
  it.each([
    { userId: "injected" },
    { token: "injected" },
    { repository: "aXtn/aXtn-host" },
    { candidateSHA: "main" },
    { caseId: "foreign" },
    { profile: "arbitrary-command" },
  ])("denies owner, credential and profile injections", (change) => {
    expect(() => DevelopmentVerification.parse({ ...request, ...change })).toThrow();
  });
  it.each(["../verify.py", "/tmp/verify.py", "src/../../verify.py", ".github/workflows/build.yml"])(
    "rejects unapproved file path %s",
    (path) => {
      expect(() =>
        DevelopmentVerification.parse({
          ...request,
          candidate: [{ path, content: "" }],
        }),
      ).toThrow();
    },
  );
  it("rejects duplicate and oversized files and UTF-8 overflow", () => {
    const file = request.candidate[0];
    expect(() => DevelopmentVerification.parse({ ...request, candidate: [file, file] })).toThrow();
    expect(() =>
      DevelopmentVerification.parse({
        ...request,
        candidate: [{ ...file, content: "é".repeat(32769) }],
      }),
    ).toThrow();
    expect(() =>
      DevelopmentVerification.parse({
        ...request,
        candidate: Array.from({ length: 21 }, (_, i) => ({ path: `src/f${i}.py`, content: "" })),
      }),
    ).toThrow();
  });
  it("projects only credentialless, callback-free bounded sandbox environment", () => {
    const env = credentiallessDevelopmentEnv("session", DevelopmentVerification.parse(request));
    expect(Object.keys(env).sort()).toEqual([
      "NB_INPUTS",
      "NB_MODE",
      "NB_SESSION_ID",
      "PYTHONDONTWRITEBYTECODE",
      "PYTHONUNBUFFERED",
    ]);
    expect(env.NB_MODE).toBe("development_verify");
    expect(env).not.toHaveProperty("AGENTSWARMS_TOKEN");
    expect(env).not.toHaveProperty("HTTPS_PROXY");
  });
  it("requires an exact server-side installed image identifier", () => {
    expect(
      developmentRuntimeImage({ AXTN_DEVELOPMENT_RUNTIME_IMAGE: `sha256:${"c".repeat(64)}` }),
    ).toBe(`sha256:${"c".repeat(64)}`);
    for (const image of ["latest", "runtime:latest", "", undefined]) {
      expect(() => developmentRuntimeImage({ AXTN_DEVELOPMENT_RUNTIME_IMAGE: image })).toThrow();
    }
  });
});
