// Native composition only. The caller binds an owned Case and its read version;
// the model proposes a patch, not an identity, revision, credential or operation.
export function agenticCaseGraph({ caseId, expectedVersion, transitionKey }) {
  const request = JSON.stringify({
    operation: "processing",
    caseId,
    expectedVersion,
    transitionKey,
    patch: "__PROPOSED_PATCH__",
    reasonCode: "PILOT_SYNTHETIC_AGENTIC_EFFECT",
  }).replace('"__PROPOSED_PATCH__"', "{{proposal}}");
  return {
    nodes: [
      {
        id: "propose",
        position: { x: 0, y: 0 },
        data: {
          kind: "agent",
          label: "Propose a bounded synthetic processing effect",
          provider: "openai",
          model: "gpt-4.1-mini",
          temperature: 0,
          enabledTools: [],
          outputVar: "proposal",
          systemPrompt:
            "Choose the processing-stage patch for this fixed synthetic request. " +
            "Allowed choices: ACTIVE or VALIDATION_REVIEW. " +
            'Return ONLY the JSON patch {"processing_stage":"<chosen stage>"}. ' +
            "No identities, commands, credentials, extra keys or markdown.",
        },
      },
      {
        id: "enforce",
        position: { x: 320, y: 0 },
        data: {
          kind: "tool",
          label: "Native Case schema, principal, scope and version enforcement",
          toolId: "case_work",
          toolArgs: { request },
          outputVar: "readback",
        },
      },
      {
        id: "result",
        position: { x: 640, y: 0 },
        data: { kind: "output", label: "Native persisted readback" },
      },
    ],
    edges: [
      { id: "proposal-enforcement", source: "propose", target: "enforce" },
      { id: "enforcement-readback", source: "enforce", target: "result" },
    ],
  };
}
