// Server-side document text extraction for the DMS native intake boundary
// (DMS-D1-0002 §3/§4).
//
// PARSING DECISION IS FIXED: server-side AgentSwarms, no OCR in D1.
// `pdfjs-dist` and `mammoth` are already dependencies of this project (used
// client-side via CDN dynamic import in `fileParsers.ts` for the KB upload
// path). This module runs the SAME libraries against the SAME original bytes,
// but as regular npm imports in the server runtime — no browser, no CDN, no
// second parser engine pushed into n8n.
//
// D1 extraction covers PDF text layer, DOCX, and UTF-8/plain-text formats
// only. It explicitly does NOT do OCR, image/vision analysis, or binary/
// executable inspection. Anything else comes back with a structured
// "unsupported_content_type" status rather than silently returning nothing —
// callers (native document_registry, Privacy Firewall) must be able to tell
// "no text" from "we didn't even try" apart.
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

export type ExtractionStatus = "ok" | "extraction_failed" | "unsupported_content_type" | "empty";

export interface ExtractionResult {
  status: ExtractionStatus;
  text: string | null;
  error: string | null;
}

const SUPPORTED_TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/csv",
]);

function isPdf(mimeType: string, filename: string): boolean {
  return mimeType === "application/pdf" || /\.pdf$/i.test(filename);
}

function isDocx(mimeType: string, filename: string): boolean {
  return (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    /\.docx$/i.test(filename)
  );
}

function isPlainText(mimeType: string, filename: string): boolean {
  if (SUPPORTED_TEXT_MIME_TYPES.has(mimeType)) return true;
  return /\.(txt|md|markdown|csv)$/i.test(filename);
}

// Resolve the pdfjs worker file from THIS project's own node_modules rather
// than a CDN — the server has no CDN dependency and must keep working offline
// / air-gapped from the Docker network's egress policy.
function resolvePdfWorkerUrl(): string {
  const require = createRequire(import.meta.url);
  const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
  return pathToFileURL(workerPath).href;
}

async function extractPdfText(bytes: Uint8Array): Promise<ExtractionResult> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = resolvePdfWorkerUrl();
    const doc = await pdfjs.getDocument({
      data: bytes,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;
    const parts: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((it) => ("str" in it ? (it as { str: string }).str : ""))
        .join(" ");
      parts.push(text);
    }
    const joined = parts.join("\n\n").trim();
    if (!joined) {
      return {
        status: "empty",
        text: null,
        error: "PDF text layer is empty (likely a scanned/image-only PDF). D1 does not OCR.",
      };
    }
    return { status: "ok", text: joined, error: null };
  } catch (err) {
    return {
      status: "extraction_failed",
      text: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function extractDocxText(bytes: Uint8Array): Promise<ExtractionResult> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    const text = String(result?.value ?? "").trim();
    if (!text) {
      return { status: "empty", text: null, error: "DOCX contained no extractable text." };
    }
    return { status: "ok", text, error: null };
  } catch (err) {
    return {
      status: "extraction_failed",
      text: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function extractPlainText(bytes: Uint8Array): ExtractionResult {
  try {
    const text = Buffer.from(bytes).toString("utf8").trim();
    if (!text) return { status: "empty", text: null, error: "File is empty." };
    return { status: "ok", text, error: null };
  } catch (err) {
    return {
      status: "extraction_failed",
      text: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Extract text server-side from raw, original bytes.
 *
 * Never fabricates content on failure — an unreadable/unsupported document
 * comes back with `text: null` and an explicit `status`/`error` so the
 * intake boundary can route it to native manual review instead of silently
 * treating it as empty.
 */
export async function extractDocumentText(args: {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
}): Promise<ExtractionResult> {
  const { bytes, mimeType, filename } = args;
  if (isPdf(mimeType, filename)) return extractPdfText(bytes);
  if (isDocx(mimeType, filename)) return extractDocxText(bytes);
  if (isPlainText(mimeType, filename)) return extractPlainText(bytes);
  return {
    status: "unsupported_content_type",
    text: null,
    error: `D1 does not extract "${mimeType || "unknown mime type"}" (OCR/image/vision/binary inspection are explicitly out of scope). Routed to manual review.`,
  };
}
