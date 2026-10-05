export type RecognitionMatchMode = "exact" | "fuzzy";
export type RecognitionConditionOperator = "contains" | "not_contains";
export type RecognitionConnector = "AND" | "OR";

export type RecognitionCondition = {
  value: string;
  operator: RecognitionConditionOperator;
  connector?: RecognitionConnector;
  match_mode?: RecognitionMatchMode;
  max_deviation_percent?: number;
};

export type DocumentRecognitionPattern = {
  pattern_id: string;
  name: string;
  active: boolean;
  source_document_id?: string | null;
  source_ref?: string | null;
  source_stage?: "privacy_preflight";
  conditions: RecognitionCondition[];
  match_settings?: { default_mode?: RecognitionMatchMode; max_deviation_percent?: number };
  suggestions: {
    document_family?: string | null;
    document_type?: string | null;
    primary_domain?: string | null;
    para_class?: string | null;
    labels?: string | null;
  };
  // Compatibility fields for existing pure-function fixtures. Persisted
  // patterns use provider-safe condition values instead of raw text.
  typical_text?: string;
  normalized_text?: string;
  match_mode?: RecognitionMatchMode;
  max_deviation_percent?: number;
  document_family?: string | null;
  document_type?: string | null;
  organization?: string | null;
  primary_domain?: string | null;
  para_class?: string | null;
  labels?: string | null;
  confidence_on_match?: number;
  notes?: string | null;
};

export type RecognitionResult = {
  matched: boolean;
  pattern: DocumentRecognitionPattern | null;
  matchPercent: number | null;
  matchMode: RecognitionMatchMode | null;
  appliedFields: string[];
  recognizedFacts: Record<string, string>;
  conditionResults?: Array<{ value: string; matched: boolean; percent: number }>;
};

// Compatibility fixture for existing pure-function callers. Runtime pattern
// creation and storage use the native generic Dataset seam.
export const DOCUMENT_RECOGNITION_PATTERNS: readonly DocumentRecognitionPattern[] = [
  {
    pattern_id: "invoice-characteristic-header-v1",
    name: "Invoice characteristic header",
    active: true,
    conditions: [{ value: "Invoice number", operator: "contains", match_mode: "exact" }],
    suggestions: {
      document_family: "Invoice",
      document_type: "Invoice",
      primary_domain: "Finance",
      para_class: "02_Areas",
      labels: "billing, vendor",
    },
    typical_text: "Invoice number",
    normalized_text: "invoice number",
    match_mode: "exact",
    max_deviation_percent: 0,
    document_family: "Invoice",
    document_type: "Invoice",
    primary_domain: "Finance",
    para_class: "02_Areas",
    labels: "billing, vendor",
  },
];

export function normalizeRecognitionText(value: string): string {
  return value
    .replace(
      /\[(PERSON|EMAIL|ADDRESS|PHONE|IBAN|PAYMENT_CARD|TAX_ID|ID_DOCUMENT|PII)_[a-f0-9]{24}_[1-9][0-9]{0,4}\]/g,
      "[$1_X]",
    )
    .replace(/\b(?:PERSON|EMAIL|ADDRESS|PHONE|LOCATION)_\d+\b/gi, (token) =>
      token.replace(/_\d+$/i, "_X"),
    )
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const above = previous[column];
      previous[column] =
        left[row - 1] === right[column - 1]
          ? diagonal
          : Math.min(previous[column - 1], above, diagonal) + 1;
      diagonal = above;
    }
  }
  return previous[right.length];
}

function matchCondition(
  normalized: string,
  condition: RecognitionCondition,
  pattern: DocumentRecognitionPattern,
) {
  const expected = normalizeRecognitionText(condition.value);
  const mode = condition.match_mode ?? pattern.match_settings?.default_mode ?? "exact";
  if (mode === "exact") {
    const matched = normalized.includes(expected);
    return {
      matched: condition.operator === "not_contains" ? !matched : matched,
      percent: matched ? 100 : 0,
    };
  }
  const distance = levenshtein(normalized, expected);
  const deviation = (distance / Math.max(normalized.length, expected.length, 1)) * 100;
  const maxDeviation =
    condition.max_deviation_percent ?? pattern.match_settings?.max_deviation_percent ?? 0;
  const fuzzyMatched = deviation <= maxDeviation;
  return {
    matched: condition.operator === "not_contains" ? !fuzzyMatched : fuzzyMatched,
    percent: Math.max(0, Math.round(100 - deviation)),
  };
}

function boundedConditions(
  normalized: string,
  patterns: readonly DocumentRecognitionPattern[],
): Array<{ pattern: DocumentRecognitionPattern; conditions: RecognitionCondition[] }> {
  if (!Array.isArray(patterns) || patterns.length > 100)
    throw new Error("DOCUMENT_RECOGNITION_PATTERN_LIMIT");
  let conditionCount = 0;
  let fuzzyCells = 0;
  let exactCharacters = 0;
  const prepared = [];
  const deviation = (value: number | undefined) => {
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 100))
      throw new Error("DOCUMENT_RECOGNITION_INVALID_DEVIATION");
  };
  const mode = (value: RecognitionMatchMode | undefined) => {
    if (value !== undefined && value !== "exact" && value !== "fuzzy")
      throw new Error("DOCUMENT_RECOGNITION_INVALID_MODE");
  };
  for (const pattern of patterns) {
    if (!pattern || typeof pattern.active !== "boolean")
      throw new Error("DOCUMENT_RECOGNITION_INVALID_PATTERN");
    if (!pattern.active) continue;
    mode(pattern.match_mode);
    mode(pattern.match_settings?.default_mode);
    deviation(pattern.max_deviation_percent);
    deviation(pattern.match_settings?.max_deviation_percent);
    if (!Array.isArray(pattern.conditions))
      throw new Error("DOCUMENT_RECOGNITION_INVALID_CONDITIONS");
    const conditions = normalizedConditions(pattern);
    if (conditions.length > 32) throw new Error("DOCUMENT_RECOGNITION_CONDITION_LIMIT");
    conditionCount += conditions.length;
    if (conditionCount > 1_000) throw new Error("DOCUMENT_RECOGNITION_CONDITION_LIMIT");
    for (const condition of conditions) {
      if (
        !condition ||
        typeof condition.value !== "string" ||
        !condition.value.trim() ||
        condition.value.length > 4_096 ||
        (condition.operator !== "contains" && condition.operator !== "not_contains") ||
        (condition.connector !== undefined &&
          condition.connector !== "AND" &&
          condition.connector !== "OR")
      )
        throw new Error("DOCUMENT_RECOGNITION_INVALID_CONDITION");
      mode(condition.match_mode);
      deviation(condition.max_deviation_percent);
      const expected = normalizeRecognitionText(condition.value);
      if ((condition.match_mode ?? pattern.match_settings?.default_mode ?? "exact") === "fuzzy")
        fuzzyCells += normalized.length * expected.length;
      else exactCharacters += normalized.length + expected.length;
      if (fuzzyCells > 2_000_000 || exactCharacters > 50_000_000)
        throw new Error("DOCUMENT_RECOGNITION_WORK_BUDGET");
    }
    prepared.push({ pattern, conditions });
  }
  return prepared;
}

function normalizedConditions(pattern: DocumentRecognitionPattern): RecognitionCondition[] {
  if (pattern.conditions?.length) return pattern.conditions;
  if (pattern.normalized_text || pattern.typical_text) {
    return [
      {
        value: pattern.typical_text ?? pattern.normalized_text ?? "",
        operator: "contains",
        match_mode: pattern.match_mode ?? "exact",
        max_deviation_percent: pattern.max_deviation_percent ?? 0,
      },
    ];
  }
  return [];
}

function recognizedFacts(pattern: DocumentRecognitionPattern): Record<string, string> {
  const suggestions = pattern.suggestions ?? {};
  return Object.fromEntries(
    [
      ["document_family", suggestions.document_family ?? pattern.document_family],
      ["document_type", suggestions.document_type ?? pattern.document_type],
      ["primary_domain", suggestions.primary_domain ?? pattern.primary_domain],
      ["para_class", suggestions.para_class ?? pattern.para_class],
      ["labels", suggestions.labels ?? pattern.labels],
    ].filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

export function recognizeProviderSafeDocument(
  providerSafeContent: string,
  patterns: readonly DocumentRecognitionPattern[] = DOCUMENT_RECOGNITION_PATTERNS,
): RecognitionResult {
  if (typeof providerSafeContent !== "string" || providerSafeContent.length > 1_000_000)
    throw new Error("DOCUMENT_RECOGNITION_TEXT_LIMIT");
  const normalized = normalizeRecognitionText(providerSafeContent);
  // Validate the whole active manifest before returning an early ordered match.
  for (const { pattern, conditions } of boundedConditions(normalized, patterns)) {
    const results = conditions.map((condition) => ({
      value: condition.value,
      ...matchCondition(normalized, condition, pattern),
    }));
    if (!results.length) continue;
    const matched = results.reduce(
      (current, result, index) =>
        index === 0
          ? result.matched
          : (conditions[index].connector ?? "AND") === "OR"
            ? current || result.matched
            : current && result.matched,
      true,
    );
    if (!matched) continue;
    const recognized = recognizedFacts(pattern);
    return {
      matched: true,
      pattern,
      matchMode: results.some((result) => result.percent < 100) ? "fuzzy" : "exact",
      matchPercent: Math.round(
        results.reduce((sum, result) => sum + result.percent, 0) / results.length,
      ),
      appliedFields: Object.keys(recognized),
      recognizedFacts: recognized,
      conditionResults: results,
    };
  }
  return {
    matched: false,
    pattern: null,
    matchPercent: null,
    matchMode: null,
    appliedFields: [],
    recognizedFacts: {},
    conditionResults: [],
  };
}
