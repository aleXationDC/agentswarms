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

// The DETERMINISTIC SOURCE IDENTITY. This is the key the registry row is
// found by, and it is exactly that: a locator for the source item, not the
// document's identity. Keying on it is what makes replay land on the row that
// already exists instead of creating a second one.
//
// The internal document_id is deliberately NOT derived here. It is minted once
// by the platform broker when the row is first created and carried forward on
// every later write (see the immutable/generate directives at the bottom of
// this file). A snippet here could not mint one correctly even if it wanted
// to: this sandbox is built with no host globals, so it has no CSPRNG.
if (env.source_ref !== undefined && (
  typeof env.source_ref !== "string" || !env.source_ref.trim() ||
  env.source_ref.length > 500 || /[\u0000-\u001f\u007f]/.test(env.source_ref)
)) throw new Error("INVALID_ENVELOPE: invalid source_ref");
const source_ref = env.source_ref === undefined
  ? String(env.idempotency_key).trim()
  : env.source_ref;
if (!source_ref) throw new Error("INVALID_ENVELOPE: empty idempotency_key");

const mail = env.mail && typeof env.mail === "object" ? env.mail : {};
const identity = env.source_identity && typeof env.source_identity === "object" ? env.source_identity : {};
const transport = env.transport && typeof env.transport === "object" ? env.transport : {};

// Technical/provenance facts only. Semantic fields stay blank on purpose.
const source_type = String(env.source_type).trim();
const is_mail = source_type === "imap" || source_type === "gmail" || source_type === "mail";

// A mail item is a mail; anything else this ingress registers is a document.
// The old unconditional "mail" default silently mislabelled every Drive file
// that did not state its own artifact_type.
const artifact_type = env.artifact_type
  ? String(env.artifact_type)
  : (is_mail ? "mail" : "document");

const row = {
  schema_version: String(env.schema_version),
  record_kind: "document",
  artifact_type: artifact_type,
  source_type: source_type,
  source_ref: source_ref,
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

// Provider-side location identifiers, again only when supplied. These are
// SOURCE LOCATORS and are stored in their own columns; nothing here is ever
// promoted to the document's identity or to its filename.
put("drive_file_id", identity.drive_file_id);
put("current_parent_folder_id", identity.parent_folder_id || transport.parent_folder_id);
put("current_path", transport.location);

// Source link. Preferred verbatim from the transport, which reads it from
// provider metadata. The canonical Drive fallback is a deterministic rendering
// of an ID we already hold rather than a new fact: it states where the file
// we just registered lives, and without it the Workbench has no way back to
// the provider for documents whose metadata omitted the link.
const suppliedUrl = env.source_url || identity.source_url || identity.drive_url || transport.source_url;
if (suppliedUrl) {
  put("drive_url", suppliedUrl);
} else if (source_type === "google_drive" && identity.drive_file_id) {
  put("drive_url", "https://drive.google.com/file/d/" + String(identity.drive_file_id) + "/view");
}

const discovered = transport.received_at || env.received_at;
if (discovered) row.discovered_at = String(discovered);

// Exactly the MCP tool's arguments and nothing else: the tool schema is
// closed, so one extra key makes the whole call fail validation upstream.
//
// document_id is absent from `row` on purpose. The broker mints it only when
// it inserts a new row, and `immutable_columns` makes it survive every later
// write of the same source item — including the pre-existing rows whose
// document_id is a legacy provider-derived value, which are carried forward
// untouched rather than rewritten.
if (!processing_route) throw new Error("PRIVACY_ROUTE_UNRESOLVED");
return JSON.stringify({
  table_name: "axtn_document_registry",
  key_column: "source_ref",
  key_value: source_ref,
  row: row,
  immutable_columns: ["document_id"],
  generate_columns: { document_id: "hex24" },
});
