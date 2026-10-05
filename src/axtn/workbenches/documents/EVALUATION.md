# Side-effect-free Document Candidate comparison

`documentEvaluation.ts` compares the baseline with one bounded candidate using
the existing `recognizeProviderSafeDocument` exact/fuzzy, contains/not_contains
and ordered AND/OR implementation. It reuses the existing classification-metric
helper rather than introducing a classifier, learner or orchestration engine.
This is an implemented deterministic comparison basis, **not** protected live
EvaluationEvidence persistence, a dataset loader or promotion authority.

The strict input accepts only bounded numeric feature IDs, categorical labels,
hashes, UUIDs and canonical references. It rejects original text, prompt/code
fields, arbitrary URLs, enabled changes, caller authority, NO_AI/UNRESOLVED,
unverified feedback revisions and denied rights input. Numeric IDs are a
minimized projection interface; a protected loader must later verify the
vocabulary, feature extraction, privacy/rights and ground-truth provenance.
An input boolean/hash is not such a receipt. Encoded original content must not
be admitted through a vocabulary; there is no production loader in this change.

Dataset and split fingerprints are computed over the actual supplied content,
not accepted as arbitrary labels. Every sample ID and rule ID is unique.
Both template and business-request groups are excluded across the baseline,
candidate and held-out test splits. All three partitions must exist; only the
held-out test partition is scored. Related examples within one partition are
permitted, explicitly without claiming statistical independence.
All samples must remain in the exact candidate source-kind scope.

The existing active pattern must exist at its exact computed revision.
Condition changes can touch only existing indices and settings; no new text,
conditions, operation or activation. Ordered features become fixed-width numeric
tokens, avoiding accidental feature-ID prefix matches. Family/target mapping
changes remain explicit. Input arrays, rule/condition counts, family cardinality
and aggregate exact/fuzzy work are bounded before recognition.
Across both sides, fuzzy work is capped at twenty million cells and exact scan
work at fifty million characters, in addition to the existing per-document
recognizer ceilings. Tests measure 19,939,168 admitted cells and 20,050,560
rejected cells, rather than inferring the budget from source strings.

Output contains no samples, conditions or feature payloads. It retains
Case/Candidate, baseline/candidate source SHA references, evaluator/dataset/
split/vocabulary/feature/rule revisions, Evidence references and descriptive
metrics:

- Family sample/prediction/correct counts, assignment precision, severe wrong
  targets, correction/exception rates, abstention, coverage and estimated Human
  interactions. The Human interaction metric is a deterministic estimate from
  incorrect/abstained predictions, not observed production actions.
- Existing macro-F1/accuracy describe family classification only. Assignment
  precision also requires the correct target. A perfect family score cannot
  override a wrong target.
- Precision intervals use the descriptive 95% Wilson binomial interval;
  `BINOMIAL_UNADJUSTED_FOR_WITHIN_SPLIT_GROUPING` explicitly records its limitation.
  Zero predictions yield null precision/interval, never a fabricated perfect
  score. Small samples and correlated groups are not promotion-quality evidence.
- Actual local elapsed milliseconds, zero model calls and zero provider writes.
  Monetary cost is null: no price/measurement is invented.

A severe wrong target or per-actual-family regression yields FAIL. Eliminating
an abstention-only predicted category is not itself a family regression.
Otherwise the verdict is REVIEW_REQUIRED, never PASS or auto-promotion.
No confidence or quality threshold is invented. Missing QualityProfile still
blocks later promotion, not deterministic comparison.

Every result is explicitly `authority=UNATTESTED_MINIMIZED_INPUT` and
`promotionAuthorized=false`. Privacy/rights hard-gate fields refer only to the
input contract, not a protected receipt or live verification. A caller-supplied
CodeSHA/evaluator hash is provenance context, not proof that Git bytes were
loaded or that the evaluator is independently approved.
No API, native Dataset, Approval, policy, Swarm, provider or source is mutated.
Existing native Candidate and Case state remain unchanged.

Run the actual deterministic fixtures with:

```bash
npx vitest run tests/unit/documentEvaluation.test.ts tests/unit/documentRecognition.test.ts tests/unit/documentCandidate.test.ts
```

Remaining: protected feature/vocabulary/rights/privacy loader, immutable native
EvaluationEvidence storage and replay, independent review/PR handoff, disabled
AutomationPolicy, QualityProfile and complete live Learning/Acceptance. This
comparison must not be used as a substitute for those contracts.
