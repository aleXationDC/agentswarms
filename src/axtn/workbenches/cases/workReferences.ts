import { WorkReference, type WorkState } from "./workContract";

/** Native transitions retain authoritative references in audit request data. */
export function workReferences(record: WorkState["cases"][number], events: WorkState["events"]) {
  const references = new Map<string, ReturnType<typeof WorkReference.parse>>();
  const errors: string[] = [];
  const add = (value: unknown) => {
    const parsed = WorkReference.safeParse(value);
    if (!parsed.success) {
      errors.push("A persisted native Work reference is malformed.");
      return;
    }
    const ref = parsed.data;
    references.set(JSON.stringify([ref.kind, ref.repository, ref.id, ref.revision ?? null]), ref);
  };
  for (const ref of record.references ?? []) add(ref);
  if (record.result_ref !== undefined && record.result_ref !== null) add(record.result_ref);
  for (const event of events) {
    if (event.caseId !== record.case_id) continue;
    const request = event.detail.request;
    if (!request || typeof request !== "object" || Array.isArray(request)) continue;
    if ("references" in request && request.references !== undefined) {
      if (Array.isArray(request.references)) request.references.forEach(add);
      else errors.push("Persisted native Work references are not an array.");
    }
    if ("resultRef" in request && request.resultRef !== undefined) add(request.resultRef);
  }
  return { references: [...references.values()], errors: [...new Set(errors)] };
}
