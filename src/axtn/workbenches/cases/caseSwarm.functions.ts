import { createServerFn } from "@tanstack/react-start";
import { CaseSwarmStart } from "./caseSwarmContract";

/** Transport to the existing native executor, not a new orchestration layer. */
export const startCaseSwarm = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CaseSwarmStart.parse(input))
  .handler(async ({ data }) => {
    const { startCaseSwarm } = await import("./caseSwarm.server");
    return startCaseSwarm(data);
  });
