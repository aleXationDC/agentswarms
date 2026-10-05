import type { WorkState } from "./workContract";

export function workMetrics(state: WorkState) {
  const byId = new Map(state.cases.map((row) => [row.case_id, row]));
  if (byId.size !== state.cases.length) throw new Error("Duplicate Case identity");
  const lineage = state.cases.map((row) => {
    let current = row;
    let depth = 0;
    const visited = new Set([row.case_id]);
    while (current.parent_case_id) {
      if (visited.has(current.parent_case_id)) throw new Error("Case hierarchy cycle");
      visited.add(current.parent_case_id);
      const parent = byId.get(current.parent_case_id);
      if (!parent) {
        if (current.view_root_reason === "PARENT_OUTSIDE_WORK_VIEW") break;
        throw new Error("Case hierarchy has a missing owned parent");
      }
      current = parent;
      depth++;
    }
    return { caseId: row.case_id, rootCaseId: current.case_id, depth };
  });
  const segments = new Map<
    string,
    {
      executionChannel: string;
      processingMode: string;
      scenarioClass: string;
      actorRef: string;
      cases: number;
      completed: number;
    }
  >();
  for (const row of state.cases) {
    const dimensions = {
      executionChannel: row.execution_channel ?? "UNSPECIFIED",
      processingMode: row.processing_mode ?? "UNSPECIFIED",
      scenarioClass:
        row.work_identity?.scenarioClass ??
        (typeof row.scenario_class === "string" ? row.scenario_class : "UNSPECIFIED"),
      actorRef: row.actor_ref ?? "UNSPECIFIED",
    };
    const key = JSON.stringify(dimensions);
    const segment = segments.get(key) ?? { ...dimensions, cases: 0, completed: 0 };
    segment.cases++;
    if (row.status === "CLOSED") segment.completed++;
    segments.set(key, segment);
  }
  const events = state.events
    .map((event) => {
      const timestamp = Date.parse(event.timestamp);
      if (!Number.isFinite(timestamp)) throw new Error("Invalid Case event timestamp");
      return { ...event, timestamp, kind: event.action.replace(/^axtn_work\./, "") };
    })
    .sort((a, b) => a.timestamp - b.timestamp);
  const durations = state.cases.map((row) => {
    const trail = events.filter((event) => event.caseId === row.case_id);
    const start = trail.find((event) => event.kind === "STARTED");
    const completion = trail.filter((event) => event.kind === "COMPLETED").at(-1);
    const firstPR = trail.find((event) => event.kind === "PR_CREATED");
    const integration = trail
      .filter((event) => ["ACCEPTED", "MERGED", "DEPLOYED_VERIFIED"].includes(event.kind))
      .at(-1);
    let blockedAt: number | null = null;
    let blockedMs = 0;
    for (const event of trail) {
      if (event.kind === "BLOCKED" && blockedAt === null) blockedAt = event.timestamp;
      else if (
        blockedAt !== null &&
        ["STARTED", "REOPENED", "COMPLETED", "ABANDONED"].includes(event.kind)
      ) {
        blockedMs += event.timestamp - blockedAt;
        blockedAt = null;
      }
    }
    return {
      caseId: row.case_id,
      completedDurationMs: start && completion ? completion.timestamp - start.timestamp : null,
      integrationDurationMs:
        firstPR && integration ? integration.timestamp - firstPR.timestamp : null,
      blockedDurationMs: blockedMs,
      blockedSince: blockedAt === null ? null : new Date(blockedAt).toISOString(),
    };
  });
  const completed = state.cases.filter((row) => row.status === "CLOSED");
  const primaryModes = new Map<string, string>();
  for (const row of state.cases) {
    const trail = events.filter((event) => event.caseId === row.case_id);
    let mode =
      row.work_identity?.processingMode ??
      row.initial_processing_mode ??
      row.processing_mode ??
      "UNSPECIFIED";
    let activeSince: number | null = null;
    const durations = new Map<string, number>();
    for (const event of trail) {
      if (activeSince !== null) {
        durations.set(mode, (durations.get(mode) ?? 0) + event.timestamp - activeSince);
        activeSince = event.timestamp;
      }
      if (event.kind === "STARTED" && activeSince === null) activeSince = event.timestamp;
      if (event.kind === "TAKEOVER" && typeof event.detail.toMode === "string") {
        mode = event.detail.toMode;
      }
      if (["BLOCKED", "COMPLETED", "ABANDONED"].includes(event.kind)) activeSince = null;
    }
    primaryModes.set(
      row.case_id,
      [...durations].sort((a, b) => b[1] - a[1])[0]?.[0] ?? row.processing_mode ?? "UNSPECIFIED",
    );
  }
  const completedChildren = completed.filter((row) => row.parent_case_id);
  const automatic = completed.filter((row) =>
    ["SEMANTIC", "DETERMINISTIC"].includes(primaryModes.get(row.case_id) ?? ""),
  );
  const automaticIds = new Set(
    automatic
      .filter(
        (row) =>
          !events.some(
            (event) =>
              event.caseId === row.case_id &&
              (event.detail.toMode === "HUMAN" ||
                event.detail.fromMode === "HUMAN" ||
                event.detail.processingMode === "HUMAN" ||
                event.kind === "ACCEPTED"),
          ),
      )
      .map((row) => row.case_id),
  );
  const automaticDepth = state.cases.map((row) => {
    let current = row;
    let length = 0;
    while (automaticIds.has(current.case_id)) {
      length++;
      const parent = current.parent_case_id ? byId.get(current.parent_case_id) : undefined;
      if (!parent) break;
      current = parent;
    }
    return length;
  });
  const attempts = state.cases.map((row) => {
    const identifiers = new Set(
      events
        .filter((event) => event.caseId === row.case_id)
        .map((event) => {
          const request = event.detail.request;
          return request &&
            typeof request === "object" &&
            "attemptId" in request &&
            typeof request.attemptId === "string"
            ? request.attemptId
            : null;
        })
        .filter((value): value is string => value !== null),
    );
    return {
      caseId: row.case_id,
      recordedAttempts: identifiers.size,
      repeatedAttempts: Math.max(0, identifiers.size - 1),
    };
  });
  const activeIntervals: Array<{ caseId: string; start: number; end: number }> = [];
  for (const row of state.cases) {
    let started: number | null = null;
    for (const event of events.filter((event) => event.caseId === row.case_id)) {
      if (event.kind === "STARTED" && started === null) started = event.timestamp;
      else if (started !== null && ["BLOCKED", "COMPLETED", "ABANDONED"].includes(event.kind)) {
        activeIntervals.push({ caseId: row.case_id, start: started, end: event.timestamp });
        started = null;
      }
    }
    if (started !== null)
      activeIntervals.push({ caseId: row.case_id, start: started, end: Infinity });
  }
  let maxObservedParallelWork = 0;
  const reaches = (source: string, target: string, visited = new Set<string>()): boolean => {
    if (source === target) return true;
    if (visited.has(source)) return false;
    visited.add(source);
    const row = byId.get(source);
    if (!row) throw new Error("Owned dependency is missing");
    const predecessors = [
      ...(row.dependencies
        ?.filter((dependency) => dependency.kind !== "INFORMS")
        .map((dependency) => dependency.caseId) ??
        row.required_dependencies ??
        []),
    ];
    return predecessors.some((id) => reaches(id, target, visited));
  };
  const isAncestor = (source: string, target: string): boolean => {
    let row = byId.get(source);
    while (row?.parent_case_id) {
      if (row.parent_case_id === target) return true;
      row = byId.get(row.parent_case_id);
    }
    return false;
  };
  const points = activeIntervals
    .flatMap((interval) => [interval.start, interval.end])
    .filter(Number.isFinite);
  for (const point of points) {
    const active = activeIntervals.filter(
      (interval) => interval.start <= point && interval.end > point,
    );
    const ids = [...new Set(active.map((row) => row.caseId))].filter(
      (id) => byId.get(id)?.parent_case_id,
    );
    const matches = new Map<string, string>();
    // Dilworth's width excludes hierarchy/dependency overlap without a greedy undercount.
    const augment = (source: string, visited: Set<string>): boolean => {
      for (const target of ids) {
        if (
          source === target ||
          visited.has(target) ||
          !(reaches(source, target) || isAncestor(source, target))
        )
          continue;
        visited.add(target);
        const prior = matches.get(target);
        if (!prior || augment(prior, visited)) {
          matches.set(target, source);
          return true;
        }
      }
      return false;
    };
    for (const id of ids) augment(id, new Set());
    maxObservedParallelWork = Math.max(maxObservedParallelWork, ids.length - matches.size);
  }
  const decomposition = new Map<string, number>();
  for (const entry of lineage) {
    const row = byId.get(entry.caseId);
    if (!row) throw new Error("Case decomposition lost its owned identity");
    const key = `${entry.depth}:${row.case_type}`;
    decomposition.set(key, (decomposition.get(key) ?? 0) + 1);
  }
  return {
    totalCases: state.cases.length,
    completedCases: completed.length,
    automaticCompletedCases: automatic.length,
    automationRatio: completedChildren.length
      ? automatic.filter((row) => row.parent_case_id).length / completedChildren.length
      : null,
    rootCount: new Set(lineage.map((row) => row.rootCaseId)).size,
    maxDepth: Math.max(0, ...lineage.map((row) => row.depth)),
    humanInterventions: events.filter(
      (event) =>
        (event.kind === "TAKEOVER" && event.detail.toMode === "HUMAN") ||
        event.kind === "ACCEPTED" ||
        event.kind === "PROMOTED",
    ).length,
    handovers: events.filter((event) => event.kind === "TAKEOVER").length,
    reworkEvents: events.filter((event) =>
      ["REOPENED", "CHECKS_FAILED", "ROLLBACK"].includes(event.kind),
    ).length,
    candidateUpdates: events.filter((event) => event.kind === "CANDIDATE_UPDATED").length,
    longestAutomaticCompletedChain: Math.max(0, ...automaticDepth),
    maxObservedParallelWork,
    integrationRework: events.filter((event) =>
      ["CHECKS_FAILED", "CANDIDATE_UPDATED", "REOPENED"].includes(event.kind),
    ).length,
    verifiedRollouts: events.filter((event) => event.kind === "DEPLOYED_VERIFIED").length,
    rollbacks: events.filter((event) => event.kind === "ROLLBACK").length,
    improvementCandidates: state.cases.filter(
      (row) => row.case_type === "DEVELOPMENT_IMPROVEMENT_CANDIDATE",
    ).length,
    promotedImprovements: events.filter((event) => event.kind === "PROMOTED").length,
    completedImprovements: completed.filter(
      (row) => row.case_type === "DEVELOPMENT_IMPROVEMENT_CANDIDATE",
    ).length,
    primaryModes: [...primaryModes].map(([caseId, processingMode]) => ({ caseId, processingMode })),
    lineage,
    segments: [...segments.values()],
    durations,
    attempts,
    decomposition: [...decomposition].map(([key, count]) => ({
      depth: Number(key.slice(0, key.indexOf(":"))),
      caseType: key.slice(key.indexOf(":") + 1),
      count,
    })),
  };
}
