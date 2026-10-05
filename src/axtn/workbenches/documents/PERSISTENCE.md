# Minimized DMS ingress and registration recovery

This increment minimizes the existing headless native **Document Management
Parent run's input** and adds compatible hashed-input/ACK readback.
It is **not complete L19 original-free runtime persistence**: step/tool/model
bodies, all checkpoints, browser/canvas direct writes, API/callback/cache
responses and historical records still require scoped protection and proof.
No global environment flag, provider, model, local MCP or deployment is changed.

`document-minimized-ingress-v1` stores only schema/version, authenticated-owner
scope hash, business/delivery/source/revision hashes, normalized source kind,
original content fingerprint, initial privacy status and exact InputHash.
No raw business/delivery/provider reference, filename, original text, prompt,
attachment or secret is copied from the request. Scope hashing frames the
canonical owner UUID and value with a NUL separator; it does not grant source
rights, privacy eligibility, reviewer authority or execution permission.
Delivery hash is diagnostic metadata, not an authenticated provider receipt.

Initial NO_AI/UNRESOLVED input keeps the same native InputManifest and hash as
the existing technical Intake. Source reference is independent of delivery,
with the existing explicit-reference/provider-revision/ETag/hash fallback
contracts retained. Unsupported or malformed source/privacy metadata fails
explicitly; ELIGIBLE cannot be invented without protected evidence.
Already-minimized input must strictly match the authenticated owner.

The headless tracer selects this profile solely for the source-defined stable
Parent Swarm ID, never a client privacy flag. A missing owned DMS run is an
explicit failure rather than silent best-effort loss of registration binding.
Resume requires the same owner, run and Parent identity and never invents a new
run when the parked Parent cannot be reopened. Unrelated/Development raw-body,
global opt-out, best-effort and exact resume payload behavior is preserved.
Safe technical metadata remains available even with free-body retention off;
it is required by registration recovery and contains no prompt body.

`document-minimized-registration-ack-v1` replaces raw document/source references
with owner-scoped hashes but retains the exact Case/Input, categorical
registration outcome and optional Mail `00_Review` route. The readback adapter
loads the owned protected native Case first, validates hashes against its real
source/business/input metadata, then reads Registry by that persisted source.
It returns the same public ACK shape with references from authoritative owned
rows. No Case, Registry, Approval or workflow execution is created/changed.
Legacy, minimized and mixed-format registration reads remain compatible.
Forged/foreign/stale/hash/route/raw-extra bindings fail explicitly.

Native Filing preparation/duplicate-success projection uses the existing
protected Approval's Document/Intake Case binding instead of trying to recover
an identity from a minimized prompt. It invokes the same owner-bound
`ensureCaseForAcceptance` and cannot invent another Case. Invalid native
bindings do not fall back to prompt claims. This is only lineage recovery:
READY_FOR_FILING does not constitute provider readback, independent Acceptance
or authorization for FILE/DELETE; effect/receipt gates remain incomplete.

Executed tests run actual codec, headless constructor, parked registration/API
handler and native resume handler code, including owner-scoped markers,
response-loss readback, same-run resume, explicit failure and preserved generic
behavior. A source-shape resume regression assertion was updated for the
conditional metadata patch and paired with an actual generic-resume payload
test. Full scoped checkpoint hydration, database-role/direct-write barriers,
model/trace/callback/cache redaction, semantic rights/privacy loader and live
restart/Acceptance remain pending. Do not report the whole runtime as
original-free because this input/readback surface is minimized.

`tests/integration/documentPersistenceHashes.ts` executes the hash expression
in the explicitly isolated native PostgreSQL database and compares actual
results with the server codec for UUID casing, NUL framing, quotes, escapes,
UTF8 and owner separation. Algorithm parity is not source/privacy authority
or a complete native runtime persistence proof.
