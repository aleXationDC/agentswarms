// Deterministic ACK for Mail Ingress R3. Reads the registry result and the
// plan derived upstream; never asks a model anything.
let plan = {};
try { plan = JSON.parse(String(ctx.vars.envelope || "{}")); } catch (e) { plan = {}; }
const document_id = String(plan.key_value || "");
const privacy_status = String((plan.row && plan.row.privacy_status) || "");

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

const accepted = Boolean(document_id) && Boolean(route) && !toolErrored && wrote;

if (!accepted) {
  return JSON.stringify({
    accepted: false,
    document_id: document_id,
    processing_status: "rejected",
    processing_route: route || "unresolved",
    error: "registry_write_failed",
    detail: raw.slice(0, 500),
  });
}
return JSON.stringify({
  accepted: true,
  document_id: document_id,
  processing_status: "registered",
  next_location: "00_Review",
  processing_route: route,
  registry_outcome: outcome,
});
