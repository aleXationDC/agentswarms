const parse = (value) => {
  try { return typeof value === "string" ? JSON.parse(value) : value; }
  catch (error) { throw new Error("DOCUMENT_CASE_REGISTRY_INPUT_INVALID"); }
};
const plan = parse(ctx.vars.envelope);
const work = parse(ctx.vars.intake_case);
if (!plan || !plan.row || !work ||
    typeof work.case_id !== "string" || typeof work.document_id !== "string" ||
    work.source_kind !== "document_work" || work.case_type !== "DOCUMENT_PROCESSING" ||
    !["NEW", "OPEN"].includes(work.status) ||
    work.document_input?.sourceRef !== plan.key_value) {
  throw new Error("DOCUMENT_INTAKE_CASE_BEFORE_REGISTRY_REQUIRED");
}
return JSON.stringify({
  table_name: plan.table_name, key_column: plan.key_column, key_value: plan.key_value,
  row: { ...plan.row, document_id: work.document_id, intake_case_id: work.case_id },
  immutable_columns: ["document_id", "intake_case_id"],
});
