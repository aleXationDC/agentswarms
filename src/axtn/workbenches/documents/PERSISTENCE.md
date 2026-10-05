# Minimized DMS ingress and registration recovery

This increment minimizes the existing headless native **Document Management
Parent run's input** and adds compatible hashed-input/ACK readback.
It is **not complete L19 original-free runtime persistence**: separate model
traces, child traces, all checkpoints, browser/canvas direct writes, API/callback/cache
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

The same headless Parent tracer also excludes step inputs/outputs, tool
arguments/results, edge previews, final outputs and free-form errors, regardless
of the global free-body flag. It preserves native IDs, status, topology,
model/provider identity, tokens, latency, bytes and costs. Input redaction is
explicit; errors retain bounded node/run failure codes, not raw exception text.
An unavailable step, edge, final close or prior-step/edge recovery fails with a
content-free persistence error. Existing final-close retry remains unchanged.
Actual writer tests exercise marker exclusion and preserve exact generic body
behavior. The retained graph snapshot is still required by native Approval
binding; this protection neither changes its routing nor minimizes checkpoint
context, direct database writers or separate model/callback/cache bodies.

The additive `20261004180000_document_parent_trace_bodies.sql` applies the same
body policy to direct native Parent step/edge writes and run final/error bodies,
including authenticated browser and service-role writes. It also omits thinking,
memory/RAG/extraction bodies on these step rows. Owner/run identity is checked
against the persisted Parent; Parent and protected row identity cannot be
rebound to escape the profile. Parent locking serializes protected child writes
with identity updates. Generic rows retain existing bodies. No existing records
are scanned/deleted, ingress or graph snapshots rewritten, or checkpoint state
changed. Labels and technical model/provider identifiers are not arbitrary-body
sanitizers; child/model/checkpoint/cache/retention protection remains incomplete.
The trigger function is private and introduces no alternate store or authority.

`documentParentTrace.sql` executes actual service-role and authenticated-role
inserts/updates, owner/rebinding denial, private-function access, body markers
and preserved generic/technical/routing data. The concurrency fixture uses
sixteen independent native sessions and new-session readback, then cleans only
its own fixture run. Both require the explicitly isolated native database; no
production migration or runtime leakage PASS follows from these tests.

`20261004190000_document_parent_model_trace_bodies.sql` protects model traces
whose existing `decision_id` is the persisted owned Parent run. Prompt,
request/response payload, tool bodies and free-form error are replaced with
explicit redaction markers/bounded codes; model/provider, token/cost/latency
and native cost-scope columns remain. Rebinding an already protected trace or
moving a generic historical trace into this identity fails. Protected trace
markers also prevent body injection after the referenced run has been deleted.
This is not source/privacy authority and does not cover initial writes missing
the correlation, separate
gateway calls, audit/log bodies, callbacks/cache or checkpoint context.

The isolated native model role fixture uses actual auth rows and checks
browser/service writes, owner/detach/rebinding/deleted-Parent denial, technical
usage and generic bodies. Concurrent upserts and detach attempts exercise
independent sessions with new-session readback; only own fixture rows are
cleaned. No production migration or global free-body flag is changed.

Model request metadata retains only typed boolean estimated/missing/replayed
flags, allowlisted price-source categories and numeric whole-turn token/cost/
image counts. This preserves measured-zero versus unknown-price semantics and
native repricing discovery without retaining arbitrary request bodies. Wrong
types and free-text masquerading as usage metadata are excluded.

The existing native headless executor now carries the original DMS Parent run
ID through nested Execute-Swarm calls into their existing model/data-tool
decision correlation. Each nested call validates that ID against the persisted
owned Parent before executing. This is correlation only: no child run,
checkpoint, Case, scheduler, workflow sequencing or Approval authority is
created. Generic nested execution retains its existing uncorrelated behavior.
Actual two-level executor tests capture the internal chat request and data-tool
context, retained provider/model/owner scope, one top-level trace/decision and
explicit missing/failed Parent denial. Mocked model/tool responses are not
live provider, privacy or full original-free runtime proof.

DMS Parent registration/resume now requests a strict owned checkpoint read
instead of generic legacy coercion. Missing state, non-string context, omitted
routing arrays, invalid level or a database failure produces content-free
errors. Generic and protected Development readers keep their prior contracts.
Resume requires the same suspended Parent, exact snapshot IDs, valid Approval
parked node, disjoint completed/skipped sets, real dead edges, and the native
level cursor (headless increments it **before** persisting suspension; the
existing canvas writer stores the parked level itself). Both exact native
representations are checked against the actual Approval level, not arbitrary
caller cursor values.
Prior levels must retain completed/skipped identities. Valid context/routing
is preserved unchanged; no node is restarted to repair missing metadata.
Actual executor suspension-to-resume tests use the produced checkpoint and
prove the preceding tool runs once. These tests mock storage/approval/provider
services, not genuine human Acceptance. **Raw checkpoint context remains**:
strict validation is not minimized hydration or a full L19 proof.

Every existing headless DMS Parent level now requires its checkpoint write, not
only protected Approval suspension. Invalid native state is rejected before
writing; returned or thrown database failures surface bounded content-free
codes without raw database text/logging. Actual executor failure fixtures show
later-level tools do not execute when the intervening checkpoint fails.
Generic best-effort notifications and Development required-write failures are
unchanged. This does not provide an atomic provider-effect receipt/claim:
an effect followed by a failed checkpoint still needs existing Case/effect
readback recovery, not blind replay.
