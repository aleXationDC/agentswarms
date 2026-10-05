import { randomBytes } from "node:crypto";
import { z } from "zod";

// Presidio/Python offsets count Unicode code points, not JavaScript UTF-16 units.
export const PiiFinding = z
  .object({
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
    label: z.string().min(1).max(100),
    score: z.number().finite().min(0).max(1),
  })
  .strict();
export type PiiFinding = z.infer<typeof PiiFinding>;
type Region = { start: number; end: number; labels: Set<string> };
const labels: Readonly<Record<string, string>> = {
  PERSON: "PERSON",
  EMAIL_ADDRESS: "EMAIL",
  PHONE_NUMBER: "PHONE",
  LOCATION: "ADDRESS",
  IBAN_CODE: "IBAN",
  CREDIT_CARD: "PAYMENT_CARD",
  DE_TAX_ID: "TAX_ID",
  DE_TAX_NUMBER: "TAX_ID",
  DE_ID_CARD: "ID_DOCUMENT",
  DE_PASSPORT: "ID_DOCUMENT",
};

export function pseudonymizeDocumentText(
  text: string,
  input: unknown,
): {
  pseudonymizedText: string;
  pseudonymCount: number;
  pseudonymTypes: string[];
} {
  if (typeof text !== "string" || text.length > 2_000_000)
    throw new Error("DOCUMENT_PRIVACY_TEXT_LIMIT");
  const points = Array.from(text);
  if (points.length > 1_000_000) throw new Error("DOCUMENT_PRIVACY_TEXT_LIMIT");
  for (const point of points) {
    const code = point.codePointAt(0);
    if (code !== undefined && code >= 0xd800 && code <= 0xdfff)
      throw new Error("DOCUMENT_PRIVACY_INVALID_UNICODE");
  }
  const findings = z.array(PiiFinding).max(10_000).parse(input);
  const regions: Region[] = [];
  for (const finding of findings.sort((a, b) => a.start - b.start || a.end - b.end)) {
    if (finding.start >= finding.end || finding.end > points.length)
      throw new Error("DOCUMENT_PRIVACY_INVALID_SPAN");
    const previous = regions.at(-1);
    if (previous && finding.start < previous.end) {
      previous.end = Math.max(previous.end, finding.end);
      previous.labels.add(labels[finding.label] ?? "PII");
    } else {
      regions.push({
        start: finding.start,
        end: finding.end,
        labels: new Set([labels[finding.label] ?? "PII"]),
      });
    }
  }
  const namespace = randomBytes(12).toString("hex");
  const tokens = new Map<string, string>();
  const types = new Set<string>();
  const output: string[] = [];
  let cursor = 0;
  for (const region of regions) {
    const type = region.labels.size === 1 ? [...region.labels][0] : "PII";
    const value = points.slice(region.start, region.end).join("");
    const key = JSON.stringify([type, value]);
    let token = tokens.get(key);
    if (!token) {
      token = `[${type}_${namespace}_${tokens.size + 1}]`;
      tokens.set(key, token);
    }
    types.add(type);
    output.push(points.slice(cursor, region.start).join(""), token);
    cursor = region.end;
  }
  output.push(points.slice(cursor).join(""));
  return {
    pseudonymizedText: output.join(""),
    pseudonymCount: tokens.size,
    pseudonymTypes: [...types].sort(),
  };
}
