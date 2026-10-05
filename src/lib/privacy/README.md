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
