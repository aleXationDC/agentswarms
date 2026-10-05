import { z } from "zod";
import {
  privacyTextCodePoints,
  validatePiiFindings,
  type PiiFinding,
} from "@/lib/privacy/pseudonymize.server";

const BASE_ENTITIES = [
  "PERSON",
  "EMAIL_ADDRESS",
  "PHONE_NUMBER",
  "LOCATION",
  "IBAN_CODE",
  "CREDIT_CARD",
] as const;

const GERMAN_RECOGNIZERS = [
  {
    name: "DeTaxIdRecognizer",
    supported_entity: "DE_TAX_ID",
    patterns: [{ name: "de_tax_id_11_digit", regex: "\\b[1-9][0-9]{10}\\b", score: 0.5 }],
    context: ["steuer-id", "steuerliche identifikationsnummer", "identifikationsnummer", "idnr"],
  },
  {
    name: "DeTaxNumberRecognizer",
    supported_entity: "DE_TAX_NUMBER",
    patterns: [
      { name: "de_tax_number_slashed", regex: "\\b[0-9]{2,3}/[0-9]{3}/[0-9]{4,5}\\b", score: 0.6 },
    ],
    context: ["steuernummer", "st-nr", "finanzamt"],
  },
  {
    name: "DeIdCardRecognizer",
    supported_entity: "DE_ID_CARD",
    patterns: [{ name: "de_id_card_9char", regex: "\\b[C-HJ-NPRTVWXYZ0-9]{9}\\b", score: 0.4 }],
    context: ["personalausweis", "ausweisnummer", "dokumentennummer"],
  },
  {
    name: "DePassportRecognizer",
    supported_entity: "DE_PASSPORT",
    patterns: [{ name: "de_passport_9char", regex: "\\b[C-HJ-NPRTVWXYZ0-9]{9}\\b", score: 0.4 }],
    context: ["reisepass", "passnummer", "reisepassnummer"],
  },
] as const;
const REQUESTED_ENTITIES = [
  ...BASE_ENTITIES,
  ...GERMAN_RECOGNIZERS.map((recognizer) => recognizer.supported_entity),
];
const REQUESTED_ENTITY_SET = new Set<string>(REQUESTED_ENTITIES);
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_REQUEST_BYTES = 6 * 1024 * 1024;
const DEADLINE_MS = 8_000;
const ENTITY = z.string().regex(/^[A-Z][A-Z0-9_]{0,99}(?![\s\S])/);
const ANALYZER_FINDING = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
  entity_type: ENTITY,
  score: z.number().finite().min(0).max(1),
});

export class DocumentPiiDetectionError extends Error {
  constructor(code: string) {
    super(`DOCUMENT_PII_${code}`);
    this.name = "DocumentPiiDetectionError";
  }
}

function configuredEndpoint(): string {
  const raw = process.env.PRESIDIO_ANALYZER_URL;
  if (!raw) throw new DocumentPiiDetectionError("ENDPOINT_REQUIRED");
  // Never reinterpret an operator typo as another destination for original text.
  if (raw !== "http://presidio-analyzer:3000" && raw !== "http://presidio-analyzer:3000/")
    throw new DocumentPiiDetectionError("ENDPOINT_INVALID");
  return "http://presidio-analyzer:3000";
}

function requireTimeRemaining(signal: AbortSignal, started: number) {
  if (signal.aborted || performance.now() - started >= DEADLINE_MS)
    throw new DocumentPiiDetectionError("DEADLINE_EXCEEDED");
}

async function beforeDeadline<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new DocumentPiiDetectionError("DEADLINE_EXCEEDED"));
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
    pending.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}

async function readJson(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.body) throw new DocumentPiiDetectionError("INVALID_RESPONSE");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const chunks: string[] = [];
  let size = 0;
  try {
    if (!response.ok) throw new DocumentPiiDetectionError("HTTP_FAILURE");
    if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? ""))
      throw new DocumentPiiDetectionError("INVALID_RESPONSE");
    const declared = response.headers.get("content-length");
    if (declared !== null && (!/^[0-9]+$/.test(declared) || Number(declared) > MAX_RESPONSE_BYTES))
      throw new DocumentPiiDetectionError("RESPONSE_LIMIT");
    while (true) {
      const next = await beforeDeadline(reader.read(), signal);
      if (next.done) break;
      size += next.value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw new DocumentPiiDetectionError("RESPONSE_LIMIT");
      chunks.push(decoder.decode(next.value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return JSON.parse(chunks.join("")) as unknown;
  } catch (error) {
    if (error instanceof DocumentPiiDetectionError) throw error;
    throw new DocumentPiiDetectionError("INVALID_RESPONSE");
  } finally {
    try {
      await beforeDeadline(reader.cancel(), signal);
    } finally {
      reader.releaseLock();
    }
  }
}

async function requestJson(url: string, signal: AbortSignal, body?: string): Promise<unknown> {
  try {
    const response = await beforeDeadline(
      fetch(url, {
        method: body === undefined ? "GET" : "POST",
        headers: { "content-type": "application/json" },
        ...(body === undefined ? {} : { body }),
        signal,
        redirect: "error",
      }),
      signal,
    );
    return await readJson(response, signal);
  } catch (error) {
    if (signal.aborted) throw new DocumentPiiDetectionError("DEADLINE_EXCEEDED");
    if (error instanceof DocumentPiiDetectionError) throw error;
    throw new DocumentPiiDetectionError("TRANSPORT_FAILURE");
  }
}

export async function detectDocumentPii(
  text: string,
  language: "en" | "de",
): Promise<{
  findings: PiiFinding[];
  language: "en" | "de";
  reportedSupportedEntities: string[];
  requestedEntities: string[];
}> {
  const endpoint = configuredEndpoint();
  if (language !== "en" && language !== "de")
    throw new DocumentPiiDetectionError("LANGUAGE_REQUIRED");
  const points = privacyTextCodePoints(text);
  if (points.length === 0) throw new DocumentPiiDetectionError("EMPTY_TEXT");
  const body = JSON.stringify({
    text,
    language,
    entities: REQUESTED_ENTITIES,
    score_threshold: 0,
    return_decision_process: false,
    allow_list: [],
    ad_hoc_recognizers: GERMAN_RECOGNIZERS.map((recognizer) => ({
      ...recognizer,
      supported_language: language,
    })),
  });
  if (Buffer.byteLength(body, "utf8") > MAX_REQUEST_BYTES)
    throw new DocumentPiiDetectionError("REQUEST_LIMIT");
  const started = performance.now();
  const signal = AbortSignal.timeout(DEADLINE_MS);
  const supported = z
    .array(ENTITY)
    .max(1_000)
    .safeParse(await requestJson(`${endpoint}/supportedentities?language=${language}`, signal));
  if (!supported.success) throw new DocumentPiiDetectionError("INVALID_COVERAGE_RESPONSE");
  if (!BASE_ENTITIES.every((entity) => supported.data.includes(entity)))
    throw new DocumentPiiDetectionError("REQUIRED_ENTITY_UNAVAILABLE");
  requireTimeRemaining(signal, started);
  const parsed = z
    .array(ANALYZER_FINDING)
    .max(10_000)
    .safeParse(await requestJson(`${endpoint}/analyze`, signal, body));
  if (!parsed.success) throw new DocumentPiiDetectionError("INVALID_FINDINGS");
  const findings = validatePiiFindings(
    parsed.data.map(({ start, end, entity_type, score }) => ({
      start,
      end,
      label: REQUESTED_ENTITY_SET.has(entity_type) ? entity_type : "PII",
      score,
    })),
    points.length,
  );
  requireTimeRemaining(signal, started);
  return {
    findings,
    language,
    reportedSupportedEntities: [...new Set(supported.data)]
      .filter((entity) => REQUESTED_ENTITY_SET.has(entity))
      .sort(),
    requestedEntities: [...REQUESTED_ENTITIES],
  };
}
