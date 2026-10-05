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

The native Approval handler selects strict DMS reads from the persisted owned
Parent Swarm ID. For DMS only, its existing atomic suspended-to-running claim
is performed by the existing resume executor **after** exact suspended
checkpoint/snapshot validation. Previously the handler claimed first, so the
strict executor rejected that valid run as no longer suspended. No extra
claim, Approval engine or continuation path is added. Missing/failed claims
produce explicit content-free errors before execution. Development retains
its prior handler claim and read modes. Actual handler-to-executor tests cover
this ordering using synthetic database/Approval authority; they do not prove
live role/concurrency or human review.

The existing Canvas Approval handler also selects strict checkpoint writes
from its authenticated owned persisted Parent, never caller flags. It retains
the native parked-level cursor and exact context; checkpoint failure cannot
be followed by a successful suspension stamp. DMS suspension database errors
are bounded; Development retains boolean required writes and existing errors.
Nine actual handler fixtures exercise these contracts with mocked native
Approval/database services. Approval creation, checkpoint and status updates
remain separate native writes, not an atomic effect or recovery guarantee.

Suspended Parent free output is now the explicit
`document-suspended-output-v1` omission marker in sync responses, the existing
pending idempotency cache, async callbacks, legacy pending-cache readback and
native continuation responses. The original pending text may contain
document content and is not registration evidence. The top-level owned
registration ACK remains unchanged and is still reconstructed from existing
Case/Registry/run/checkpoint bindings; the pending claim is not completed or
replayed as a fresh execution. Generic/Development output is unchanged.
Returned/thrown registration database read errors retain explicit bounded
codes, not raw database exception text. Actual API/cache/callback/continuation
tests exercise marker omission and exact ACK/no-second-run behavior.

The same authenticated Parent profile now covers terminal free output with
`document-completed-output-v1` and `document-failed-output-v1` markers.
Sync responses, existing native outcome caches, async callbacks and Approval
continuation/cache writes omit result bodies. Errors retain only exact known
content-free diagnostic codes from an explicit allowlist; unknown text, fake
code prefixes and extra content become `DOCUMENT_RUN_FAILED`. This is a
failure, not a successful result, retry authorization or provider receipt.
The native Filing preparation still consumes the real in-memory result and
protected Intake binding before the public continuation is minimized.
Filing projection failure is explicit without exposing database text.

Legacy completed Parent replay projects only known output/run/status/swarm
fields, never arbitrary cached extras. A malformed/error/suspended terminal
cache or mismatching run ID requires same-run readback with409 and cannot
start another execution. Generic/Development results, cache extras, errors
and continuation output retain their existing contracts. An async terminal
outcome-persistence failure retains the actual returned run ID, not null;
it never repeats the graph/provider effect to repair the cache.

Actual tests exercise sync/async success/error/cache/callbacks, throw/returned
storage failures, lost legacy responses, exact routing-before-claim, native
Filing lineage and generic compatibility. The native handler-to-executor
fixture is still real code over synthetic storage/Approval authority.
Stored historical bodies, callback delivery retention and original-free
checkpoint hydration remain pending. No blanket
L19 or live original-free PASS follows.

The additive `20261005080000_document_parent_idempotency_bodies.sql` now
guards direct writes to the **existing** native idempotency cache. The private
trigger selects the profile from persisted key/run identity, holds shared
identity locks and checks owner/Parent binding. Once protected, the key's
ID/owner/Swarm and cache record's ID/key/request hash/delivery/creation time
cannot be rebound; a linked run cannot be detached or replaced. Initial
null-run claims may still acquire the actual owned Parent once.
Native key revocation and generic key/cache behavior are unchanged.

Non-null Parent cache responses must already be strict existing output DTOs,
with matching run/status/Swarm, explicit output markers and exact known
diagnostic codes. Raw output, extra bodies, wrong types or code-prefix text
are **rejected**, not silently converted into accepted results. Null/incomplete
outcomes remain incomplete and require readback; this does not complete a
Case, authorize an effect, add retries or create a new store. Existing RLS
still permits owner reads but not authenticated cache writes.
Completed API replay also reads the actual owned Parent and requires persisted
native success: missing/foreign/non-success runs return same-run409recovery,
read errors are bounded, and none starts a second execution.

The new migration was applied only to the explicitly isolated
`dms_native_contract_cache_guard_20261005` clone of the prior eleven-additive-
migration basis. Actual service/browser/foreign-role tests and all eight DMS
SQL role/regression suites pass. Actual server codec versus SQL writes admits
28 exact diagnostic codes and rejects7 unknown/prefix variants; all three
output states round-trip unchanged. Sixteen concurrent upserts raced16
key/run identity attempts, at most16 native sessions; new-session readback
finds exactly one same owned cache row. Only owned ephemeral cache/key/run/
Swarm fixtures are cleaned; the synthetic auth identity and isolated database
remain. No production migration, real provider action or independent
Acceptance was performed.

This does not sweep historical records, control SQL statement/error logs,
cover all callback/audit retention or hydrate raw checkpoints originally free
of document content. These remain explicit L19 boundaries.

For the authenticated source-defined Parent, the public API now requires the
existing `Idempotency-Key` header (nonempty, at most 200 characters; no silent
Parent truncation). Existing n8n Drive/IMAP/Workspace ingress HTTP nodes
already set this header. The existing public OPTIONS response now permits
that header alongside Authorization/Content-Type; otherwise cross-origin
browser clients could not send the mandatory delivery identity. No origin,
method, key scope or identity policy is widened. An actual OPTIONS fixture
verifies204/allowed headers and zero execution/storage writes.
A failed record or completed record without a result
returns `DOCUMENT_RUN_READBACK_RECOVERY_REQUIRED` with the same run ID rather
than starting the graph again. A concurrent insert conflict also cannot
take over a failed Parent record. Request mismatch is still checked first;
valid completed replay and suspended owned readback retain their contracts.
Generic/Development optional headers, generic verdict and atomic failed
takeover remain unchanged.

Returned Parent idempotency read/claim errors and returned/thrown outcome
write failures surface explicit content-free codes; no successful ACK is
returned when its pending cache write failed. This is an intentional
fail-closed barrier, **not recovery implementation or effect idempotency**.
Current provider rights, durable EffectKey/receipt/claim/fencing and UNKNOWN
readback are still required. Different keys/deliveries remain outside this
same-key guard; never report it as full no-double-effect proof.
