const parse = (value, code) => {
  try { return typeof value === "string" ? JSON.parse(value) : value; }
  catch (error) { throw new Error(code); }
};
const ingress = parse(ctx.vars.ingress, "DOCUMENT_INGRESS_INVALID");
const plan = parse(ctx.vars.envelope, "DOCUMENT_REGISTRY_PLAN_INVALID");
if (!ingress || !plan || !plan.row) throw new Error("DOCUMENT_TECHNICAL_INPUT_REQUIRED");
const identity = ingress.source_identity || {};
const technical = ingress.technical || {};
const transport = ingress.transport || {};
const sourceType = plan.row.source_type;
const sourceKind = sourceType === "google_drive" ? "drive"
  : ["imap", "gmail", "mail"].includes(sourceType) ? "mail"
  : sourceType === "fixture" ? "fixture" : null;
const sourceRevision = ingress.source_revision || identity.provider_revision || identity.etag;
const businessRequestId = ingress.business_request_id;
const deliveryId = ingress.delivery_id || transport.delivery_id;
const contentHash = technical.original_sha256 || technical.content_hash;
if (!sourceKind || !sourceRevision || !businessRequestId || !deliveryId ||
    typeof contentHash !== "string" || !/^[a-f0-9]{64}$/.test(contentHash)) {
  throw new Error("DOCUMENT_SOURCE_REQUEST_DELIVERY_REVISION_REQUIRED");
}
return JSON.stringify({
  operation: "document_ensure",
  work: {
    businessRequestId,
    caseType: "DOCUMENT_PROCESSING",
    workContractRef: {
      kind: "contract", repository: "aXtn/aXtn-agentswarms",
      id: "handoffs/requests/AXTN-DMS-RECOVERY-AND-LEARNING-0001.md",
      revision: "dad9629ae1ae98465beefa63deccd6c76aa42031",
    },
    scenarioClass: sourceKind === "fixture" ? "regression" : "real_work",
    scenarioId: businessRequestId,
    processingMode: "DETERMINISTIC", executionChannel: "SWARM", actorRef: "native-dms-intake",
    inputManifest: {
      sourceKind, sourceRef: plan.key_value, sourceRevision, contentHash,
      privacyStatus: plan.row.privacy_status,
    },
    deliveryId, references: [],
  },
});
