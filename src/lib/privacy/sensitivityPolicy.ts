// Sensitivity policy (DMS-D1-0002 §5, "Sensitivity policy").
//
// Pure, dependency-free classification: given what the local PII engine
// found (or the fact that it could not run at all), decide which of the four
// tiers applies and what that implies for external processing. Kept separate
// from the Presidio HTTP client (piiDetection.server.ts) so this can be unit
// tested exhaustively without a network call or a running sidecar.
export type SensitivityTier = "standard" | "personal" | "confidential" | "restricted";

export type SensitivityDecision = {
  tier: SensitivityTier;
  /** May raw/near-raw text ever leave the local boundary (LLM, embeddings)? */
  externalProcessingAllowed: boolean;
  /** Must the text be pseudonymised before anything external sees it? */
  requiresPseudonymization: boolean;
  reason: string;
};

/** The subset of Presidio recognizer labels this policy cares about. */
export type PiiLabel =
  | "PERSON"
  | "EMAIL_ADDRESS"
  | "PHONE_NUMBER"
  | "LOCATION"
  | "IBAN_CODE"
  | "CREDIT_CARD"
  | "DE_TAX_ID"
  | "DE_TAX_NUMBER"
  | "DE_ID_CARD"
  | "DE_PASSPORT"
  | string;

export type PiiFinding = { label: PiiLabel; score: number };

export type SensitivityInput = {
  findings: PiiFinding[];
  /**
   * Content whose readability/coverage is not established at all — e.g.
   * image-only/unreadable objects in D1, or the sanitizer could not run.
   * Per §5 this is `restricted` unconditionally: "unreadable/image-only
   * content in D1 when contents are unknown".
   */
  contentUnknown?: boolean;
  /** DE_ID_CARD/DE_PASSPORT-style identity documents, health data, biometrics. */
  containsRestrictedCategory?: boolean;
  /** Sanitizer errored, timed out, or returned a low-confidence/uncertain result. */
  sanitizerFailed?: boolean;
};

const RESTRICTED_LABELS = new Set(["DE_ID_CARD", "DE_PASSPORT"]);
const CONFIDENTIAL_LABELS = new Set(["IBAN_CODE", "CREDIT_CARD", "DE_TAX_ID", "DE_TAX_NUMBER"]);
const PERSONAL_LABELS = new Set(["PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER", "LOCATION"]);

/** Minimum recognizer confidence to count a finding at all; below this, ignore. */
const MIN_SCORE = 0.4;

/**
 * Classify local PII-detection output into a sensitivity decision. Fails
 * closed: any ambiguity (sanitizer failure, unknown content, restricted
 * category) always wins over a lower tier, never the reverse.
 */
export function classifySensitivity(input: SensitivityInput): SensitivityDecision {
  if (input.sanitizerFailed) {
    return {
      tier: "restricted",
      externalProcessingAllowed: false,
      requiresPseudonymization: true,
      reason: "Local PII sanitizer failed/timed out — failing closed per §5.",
    };
  }
  if (input.contentUnknown) {
    return {
      tier: "restricted",
      externalProcessingAllowed: false,
      requiresPseudonymization: true,
      reason: "Content is unreadable/image-only; PII coverage cannot be established.",
    };
  }
  if (input.containsRestrictedCategory) {
    return {
      tier: "restricted",
      externalProcessingAllowed: false,
      requiresPseudonymization: true,
      reason: "Contains an explicitly restricted category (identity document/health/biometric).",
    };
  }

  const relevant = input.findings.filter((f) => f.score >= MIN_SCORE);
  const labels = new Set(relevant.map((f) => f.label));

  for (const l of labels) {
    if (RESTRICTED_LABELS.has(l)) {
      return {
        tier: "restricted",
        externalProcessingAllowed: false,
        requiresPseudonymization: true,
        reason: `Detected restricted identifier (${l}).`,
      };
    }
  }
  for (const l of labels) {
    if (CONFIDENTIAL_LABELS.has(l)) {
      return {
        tier: "confidential",
        externalProcessingAllowed: true,
        requiresPseudonymization: true,
        reason: `Detected financial/account identifier (${l}); aggressive pseudonymisation required.`,
      };
    }
  }
  for (const l of labels) {
    if (PERSONAL_LABELS.has(l)) {
      return {
        tier: "personal",
        externalProcessingAllowed: true,
        requiresPseudonymization: true,
        reason: `Detected ordinary personal data (${l}); pseudonymisation required before external use.`,
      };
    }
  }

  return {
    tier: "standard",
    externalProcessingAllowed: true,
    requiresPseudonymization: false,
    reason: "No personal data detected above threshold.",
  };
}
