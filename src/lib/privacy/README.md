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

**Actual negative evidence matters:** this image reports the six base entities
and detects all ten requested labels in positive English fixtures, but it
does not support German-language analysis and leaves the generated
`example.invalid` email marker uncovered. The probe retains that counterexample,
including after restart, rather than presenting a more convenient positive
fixture as complete coverage. Generated markers do not appear in analyzer logs.
This is bounded capability evidence, **not privacy eligibility**. No live
activation is justified by these fixtures; an accepted real language/model/
coverage profile and protected source/rights/Case receipt remain required.
