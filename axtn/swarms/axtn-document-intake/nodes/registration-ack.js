// Deterministic ACK for Mail Ingress R3. Reads the registry result and the
// plan derived upstream; never asks a model anything.
let plan = {};
try { plan = JSON.parse(String(ctx.vars.envelope || "{}")); } catch (e) { plan = {}; }
const privacy_status = String((plan.row && plan.row.privacy_status) || "");
const source_type = String((plan.row && plan.row.source_type) || "");
const source_ref = String(plan.key_value || "");

// Same closed allow-list as the preflight: an unroutable state can never be
// reported as accepted.
const ROUTES = { NO_AI: "privacy_hold", UNRESOLVED: "privacy_hold" };
const route = Object.prototype.hasOwnProperty.call(ROUTES, privacy_status)
  ? ROUTES[privacy_status]
  : "";

// A JSON-RPC 200 says the transport worked, not that the write did. Success is
// only an explicit non-error result carrying a row the broker actually wrote.
const raw = String(ctx.input == null ? "" : ctx.input);
let envelope = null;
try { envelope = JSON.parse(raw); } catch (e) { envelope = null; }

const result = envelope && envelope.result ? envelope.result : null;
const structured = result && result.structuredContent ? result.structuredContent : null;
const rpcError = envelope && envelope.error ? envelope.error : (envelope && envelope.error === undefined ? null : null);
const toolErrored = !result || result.isError === true;
const outcome = structured ? String(structured.outcome || "") : "";
const wrote = outcome === "inserted" || outcome === "updated";

// The internal document_id is whatever the registry actually holds for this
// row: minted by the broker on insert, carried forward on every replay. It is
// read back from the write result rather than guessed here, so the ACK can
// only ever name an identity that is really persisted.
const effective = structured && structured.effective_columns ? structured.effective_columns : null;
const document_id = effective ? String(effective.document_id || "") : "";

const accepted = Boolean(document_id) && Boolean(route) && !toolErrored && wrote;

if (!accepted) {
  return JSON.stringify({
    accepted: false,
    document_id: document_id,
    source_ref: source_ref,
    processing_status: "rejected",
    processing_route: route || "unresolved",
    error: "registry_write_failed",
    detail: raw.slice(0, 500),
  });
}
// Workflow state and physical location are different things, and only the
// mailbox transport is actually being told to move something.
//
// A mail item is handed to the mailbox workflow with its transport
// destination, which is unchanged. A Drive file is NOT moved by registration:
// it stays where the poller found it until a filing action is separately
// approved, so claiming a next location here would describe a move that never
// happened. No next_location is emitted in that case at all.
const ack = {
  accepted: true,
  document_id: document_id,
  source_ref: source_ref,
  processing_status: "registered",
  processing_route: route,
  registry_outcome: outcome,
};
const MAIL_SOURCES = { imap: 1, gmail: 1, mail: 1 };
if (Object.prototype.hasOwnProperty.call(MAIL_SOURCES, source_type)) {
  ack.next_location = "00_Review";
}
return JSON.stringify(ack);
