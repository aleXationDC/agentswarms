# Bounded local privacy transformation

The accepted DMS recovery contract requires restoration/adaptation of the
historical local privacy boundary from
`7123d0ef167e72b39ee39a944e418003a253f50f`. Existing native graph sequencing,
Case, Approval and provider authority stay outside this module.

`pseudonymize.server.ts` restores one ephemeral offline capability only:
replace supplied, validated Presidio/Python code-point spans in memory.
The historical winner-takes-overlap algorithm could expose the uncovered tail
of a losing span. This implementation covers the complete overlapping union,
including low/zero-score and unknown labels. No malformed finding is filtered
away; the whole request fails. Unicode offsets, size/count and span bounds are
validated before output. Random invocation namespaces prevent stable
cross-document tokens; exact repeated sightings reuse tokens only locally.
Original-to-token maps are neither returned, logged nor persisted.

**This is not an eligibility decision, detector, proof of complete PII coverage
or provider-safe authorization.** An empty finding list does not establish
privacy. No arbitrary client-supplied findings may grant ELIGIBLE or bypass
NO_AI/UNRESOLVED. The protected local detector/source/rights/coverage receipt
and Case privacy authority adapter are still missing; the historical unsafe
endpoint fallbacks, category claims and permissive defaults are not restored.
The helper is not registered as a client tool or activated in a production graph.

## Local analyzer recovery boundary

The accepted recovery request (sections 5 and 9) explicitly includes historical
Privacy/Presidio recovery. The native graph provides sequencing, but no native
PII detector. Historical `piiDetection.server.ts` used the standard Presidio
REST API, tried multiple endpoints and silently discarded malformed findings.
The bounded adaptation retains that standard external capability only:
one explicitly configured internal endpoint, language-specific supported-entity
readback before sending text, fixed per-request recognizers, bounded transport,
and all-or-nothing span validation. It introduces no service, graph controller,
Case transition, privacy setter or default-model/provider replacement.
Coverage reported by an analyzer is necessary, not proof of complete detection.
Private-network/image/model/logging verification and protected source/rights/
coverage receipt binding remain separate mandatory gates before live use.

`detectDocumentPii(text, language)` requires the operator to set
`PRESIDIO_ANALYZER_URL=http://presidio-analyzer:3000` explicitly; only that
internal destination is accepted. Language must be `en` or `de`, never inferred
or silently switched. `/supportedentities?language=...` must report the six
historical base entities before `/analyze` receives text. The four historical
German ad-hoc pattern recognizers accompany each request. The passport pattern
now covers the same full nine-character alphanumeric document-number shape
as the identity-card pattern, rather than falsely requiring eight digits.
These coarse patterns are not checksum validation or complete PII coverage.
The analysis request explicitly disables score filtering, allow-list
exemptions and decision-process explanations.

The eight-second deadline covers both provider calls and result validation;
redirects, retries and fallback endpoints are disallowed. Actual response bytes
are streamed with a 4 MiB limit and strict UTF-8/JSON validation; rejected bodies
are cancelled. Shared text/span limits preserve Python code-point offsets.
Every malformed finding fails the entire call. Unknown findings are retained
as generic `PII`, not discarded; unrequested metadata/entity names and raw
analyzer explanations never leave the adapter. Explicit failure codes contain
no original text, response body or underlying transport cause. The client
does not log or persist text/findings, return pseudonym maps, grant ELIGIBLE,
alter NO_AI/UNRESOLVED or register a tool. Live analyzer model/coverage and
private-network/logging verification remain unperformed; HTTP fixtures alone
prove transport, not real detector coverage.

The versioned real-image probe is
`tests/integration/documentPiiAnalyzer.mjs`, run with the existing
`node_modules/.bin/vite-node --script tests/integration/documentPiiAnalyzer.mjs`.
It requires the exact owned fixture `axtn-dms-pii-contract-fixture`, label
`axtn.fixture.document-pii=1`, network `none`, no published ports, read-only root,
user `1001`, at most 1536 MiB memory, and exact stock image
`mcr.microsoft.com/presidio-analyzer@sha256:d459416c39345b60b72050a98aeef6be4f6b3d9da20e5ba9561e8b920f9abedb`.
It uses only ephemeral synthetic input and Docker-exec HTTP transport; it
does not join a production network or borrow any live provider credential.

**Actual negative evidence matters:** the earlier stock-only request detected
all ten requested labels in positive English fixtures but left a generated
`example.invalid` email marker uncovered. This failure is now repaired with
one additional standard per-request Presidio PatternRecognizer for the
existing `EMAIL_ADDRESS` entity. It conservatively covers non-space text on
both sides of `@` rather than treating a public-TLD catalog as privacy
authority. It may over-redact punctuation and non-address strings; its
technical regex score does not grant eligibility or policy confidence.
The zero score filtering and existing exact text/span/overlap safeguards remain.

The real pinned image probe now requires actual Python-offset email findings
covering all four generated variants: `.invalid`, single-label internal
domain, plus-tag/subdomain and Unicode local/domain text. Every marker is
absent from transformed output and analyzer logs, before and after the
isolated fixture restart. All ten existing requested entities remain detected.
The image still does **not** support German-language analysis, which must fail
before original text is sent. Positive examples are not exhaustive coverage.
No live activation is justified by these fixtures; an accepted real language/
model/coverage profile and protected source/rights/Case receipt remain required.

Historical `privacyPreflight.server.ts` and its native `privacy_preflight`
Tool registration were reread at the authoritative recovery revision. Its
client category claims, default language and silent empty-dataset fallback
cannot be restored as authority. The current native tool is not registered:
safe source/rights/privacy binding remains a real integration gap, not permission
to mark UNRESOLVED input eligible after this local transformation.

The existing pure recognition normalizer understands these exact random-token
frames and reduces them to generic type placeholders, retaining neither
namespace nor sequence. Legacy tokens remain compatible; all nine actual
emitted token categories and cross-invocation matching are exercised. This
does not establish identity across documents, seed a rule, authorize semantic
processing or activate Learning. The persisted rule/candidate/evaluation
contracts remain unfinished. The existing recognizer now rejects manifests
before matching if they exceed 100 rules, 32 conditions per active rule,
1000 active conditions, one million input UTF-16 units, 4096 units per condition,
two million aggregate fuzzy comparison cells or fifty million aggregate
exact-scan characters. Modes/operators/connectors and finite deviations from
0 through 100 are validated before an earlier rule can hide an invalid later
rule. Disabled rules stay disabled; no threshold or promotion policy is invented.
