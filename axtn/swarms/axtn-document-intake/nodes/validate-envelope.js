// Deterministic ingress validation + privacy gate. No LLM may run before this.
const raw = ctx.input;
let env;
try {
  env = typeof raw === "string" ? JSON.parse(raw) : raw;
} catch (e) {
  throw new Error("INVALID_ENVELOPE: body is not valid JSON");
}
if (!env || typeof env !== "object" || Array.isArray(env)) {
  throw new Error("INVALID_ENVELOPE: expected a JSON object");
}

const required = ["schema_version", "source_type", "idempotency_key", "source_identity", "privacy", "transport"];
for (const k of required) {
  const v = env[k];
  if (v === undefined || v === null || v === "") throw new Error("INVALID_ENVELOPE: missing " + k);
}

// Privacy Preflight V1 — deterministic, fail-closed allow-list.
// Both supported states hold semantic processing, so there is no branch a
// model could influence and no path from here to an LLM.
const p = env.privacy;
const state = String((p && typeof p === "object" ? (p.state ?? p.status) : p) ?? "").trim().toUpperCase();
const ROUTES = { NO_AI: "privacy_hold", UNRESOLVED: "privacy_hold" };
if (!Object.prototype.hasOwnProperty.call(ROUTES, state)) {
  throw new Error("PRIVACY_UNSUPPORTED_STATE: " + (state || "(empty)"));
}
const processing_route = ROUTES[state];

// Canonical, deterministic key. Never model-chosen.
const canonical = String(env.source_type).trim().toLowerCase() + ":" + String(env.idempotency_key).trim();
const document_id = canonical.replace(/[^A-Za-z0-9:._@-]/g, "_");
if (!document_id) throw new Error("INVALID_ENVELOPE: could not derive document_id");

const mail = env.mail && typeof env.mail === "object" ? env.mail : {};
const identity = env.source_identity && typeof env.source_identity === "object" ? env.source_identity : {};
const transport = env.transport && typeof env.transport === "object" ? env.transport : {};

// Technical/provenance facts only. Semantic fields stay blank on purpose.
const row = {
  schema_version: String(env.schema_version),
  record_kind: "document",
  document_id: document_id,
  artifact_type: String(env.artifact_type || "mail"),
  source_type: String(env.source_type),
  source_ref: String(env.idempotency_key),
  privacy_status: state,
  processing_status: "registered",
};

const put = (col, val) => {
  if (val === undefined || val === null || val === "") return;
  row[col] = String(val);
};
put("message_id", mail.message_id);
put("mail_ref", mail.mail_ref);
put("mail_identity_source", identity.source || identity.kind);
put("provider_type", identity.provider_type || transport.provider_type);
put("provider_account_id", identity.provider_account_id);
put("provider_message_id", mail.provider_message_id || transport.provider_message_id);
put("mailbox", transport.mailbox || identity.mailbox);
put("uidvalidity", transport.uidvalidity);
put("uid", transport.uid);

// Technical facts the transport already established before this boundary.
// They are copied verbatim from the envelope; nothing here is derived,
// inferred or model-chosen, and an absent fact stays absent.
const technical = env.technical && typeof env.technical === "object" ? env.technical : {};
put("original_filename", technical.original_name || technical.original_filename);
put("current_filename", technical.original_name || technical.original_filename);
put("mime_type", technical.mime_type);
put("extraction_status", technical.extraction_status);

// The hash algorithm is only stated when a hash is actually present, and only
// when the envelope itself names it or the field it arrived in does.
const contentHash = technical.original_sha256 || technical.content_hash;
if (contentHash !== undefined && contentHash !== null && contentHash !== "") {
  row.content_hash = String(contentHash);
  const declaredAlgorithm = technical.hash_algorithm
    ? String(technical.hash_algorithm)
    : (technical.original_sha256 ? "sha256" : "");
  if (declaredAlgorithm) row.hash_algorithm = declaredAlgorithm;
}

// File size is numeric in the registry contract, so only accept a value that
// really is a finite number rather than stringifying whatever arrived.
const declaredSize = technical.file_size !== undefined ? technical.file_size : transport.file_size;
if (declaredSize !== undefined && declaredSize !== null && declaredSize !== "") {
  const size = Number(declaredSize);
  if (Number.isFinite(size)) row.file_size = size;
}

// Provider-side location identifiers, again only when supplied.
put("drive_file_id", identity.drive_file_id);
put("current_parent_folder_id", identity.parent_folder_id || transport.parent_folder_id);
put("current_path", transport.location);

const discovered = transport.received_at || env.received_at;
if (discovered) row.discovered_at = String(discovered);

// Exactly the MCP tool's arguments and nothing else: the tool schema is
// closed, so one extra key makes the whole call fail validation upstream.
if (!processing_route) throw new Error("PRIVACY_ROUTE_UNRESOLVED");
return JSON.stringify({
  table_name: "axtn_document_registry",
  key_column: "document_id",
  key_value: document_id,
  row: row,
});
