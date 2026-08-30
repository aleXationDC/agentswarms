// Local RFC822/MIME parsing for Mail Intake (DMS-D1-0003 §5, §9).
//
// AgentSwarms owns local RFC822/MIME parsing and attachment materialization.
// Original raw RFC822 bytes are preserved byte-identical for durable archival.
//
// Uses `mailparser` (`simpleParser`) for robust MIME handling.
import { simpleParser, type ParsedMail, type Attachment as MailparserAttachment } from "mailparser";
import { buildCanonicalFilename, normaliseDate } from "@/lib/canonicalFilename";

export type MailAddress = {
  text: string;
  address: string | null;
  name: string | null;
};

export type MailAttachmentManifestItem = {
  attachmentIndex: number;
  filename: string;
  mimeType: string;
  size: number;
  contentHash: string;
  contentDisposition: "attachment" | "inline" | null;
  contentId: string | null;
  bytes: Uint8Array;
};

export type ParsedMailEnvelope = {
  mail_id: string;
  mail_account_id: string;
  raw_sha256: string;
  raw_size: number;
  message_id: string | null;
  in_reply_to: string | null;
  references: string[];
  from: MailAddress | null;
  to: MailAddress[];
  cc: MailAddress[];
  reply_to: MailAddress | null;
  subject: string;
  message_date: string;
  message_date_source: string;
  body_text: string;
  body_html: string | null;
  attachment_count: number;
  attachments: MailAttachmentManifestItem[];
  canonical_eml_filename: string;
};

/** Compute canonical mail identity: `mail:<mail_account_id>:sha256:<raw_sha256>`. */
export function mailIdFor(mailAccountId: string, rawSha256: string): string {
  const cleanAccount = mailAccountId.trim() || "default";
  const cleanHash = rawSha256.trim().toLowerCase();
  return `mail:${cleanAccount}:sha256:${cleanHash}`;
}

/** Compute SHA-256 hex digest of raw bytes. */
export async function computeSha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  );
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeAddress(addr: unknown): MailAddress | null {
  if (!addr || typeof addr !== "object") return null;
  const a = addr as { text?: string; value?: Array<{ address?: string; name?: string }> };
  if (Array.isArray(a.value) && a.value.length > 0) {
    const first = a.value[0];
    return {
      text: a.text ?? `${first.name ?? ""} <${first.address ?? ""}>`.trim(),
      address: first.address ?? null,
      name: first.name ?? null,
    };
  }
  return {
    text: typeof a.text === "string" ? a.text : "",
    address: null,
    name: null,
  };
}

function normalizeAddressList(addrs: unknown): MailAddress[] {
  if (!addrs) return [];
  if (Array.isArray(addrs)) {
    return addrs.map(normalizeAddress).filter((a): a is MailAddress => a !== null);
  }
  const obj = addrs as { value?: Array<{ address?: string; name?: string }> };
  if (Array.isArray(obj.value)) {
    return obj.value.map((v) => ({
      text: `${v.name ?? ""} <${v.address ?? ""}>`.trim(),
      address: v.address ?? null,
      name: v.name ?? null,
    }));
  }
  const single = normalizeAddress(addrs);
  return single ? [single] : [];
}

/**
 * Generate a deterministic canonical `.eml` filename:
 * `YYYY-MM-DD_MAIL_<clean_subject_or_sender>_<hash8>.eml`
 */
export function buildCanonicalMailFilename(args: {
  messageDate: string | null;
  subject: string;
  senderAddress: string | null;
  rawSha256: string;
}): string {
  const dateStr = normaliseDate(args.messageDate) || new Date().toISOString().slice(0, 10);
  const baseLabel = (args.subject || args.senderAddress || "Email")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 40);
  const shortHash = args.rawSha256.slice(0, 8);
  return `${dateStr}_MAIL_${baseLabel || "Message"}_${shortHash}.eml`;
}

/**
 * Parse raw RFC822 bytes locally and extract normalized headers, body, and attachments.
 */
export async function parseRfc822Bytes(args: {
  bytes: Uint8Array;
  mailAccountId: string;
  ingestedAt?: string;
}): Promise<ParsedMailEnvelope> {
  const { bytes, mailAccountId } = args;
  const rawSha256 = await computeSha256Hex(bytes);
  const mailId = mailIdFor(mailAccountId, rawSha256);

  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parsed: ParsedMail = await simpleParser(buffer);

  const from = normalizeAddress(parsed.from);
  const to = normalizeAddressList(parsed.to);
  const cc = normalizeAddressList(parsed.cc);
  const replyTo = normalizeAddress(parsed.replyTo);

  const messageId = parsed.messageId?.trim() ?? null;
  const inReplyTo = parsed.inReplyTo?.trim() ?? null;
  const references: string[] = Array.isArray(parsed.references)
    ? (parsed.references as string[]).map((r) => String(r).trim()).filter(Boolean)
    : typeof parsed.references === "string" && parsed.references.trim()
      ? [parsed.references.trim()]
      : [];

  const subject = (parsed.subject ?? "").trim();
  const rawDate = parsed.date ? parsed.date.toISOString() : null;
  const messageDate = normaliseDate(rawDate) || normaliseDate(args.ingestedAt) || new Date().toISOString().slice(0, 10);
  const messageDateSource = parsed.date ? "explicit_document" : "source_arrival";

  const bodyText = (parsed.text ?? "").trim();
  const bodyHtml = parsed.html ? String(parsed.html) : null;

  const rawAttachments: MailparserAttachment[] = parsed.attachments ?? [];
  const attachments: MailAttachmentManifestItem[] = [];

  for (let i = 0; i < rawAttachments.length; i++) {
    const att = rawAttachments[i];
    const attBytes = new Uint8Array(att.content);
    const attHash = await computeSha256Hex(attBytes);
    const fallbackExt = att.contentType?.includes("pdf")
      ? ".pdf"
      : att.contentType?.includes("png")
        ? ".png"
        : att.contentType?.includes("jpeg") || att.contentType?.includes("jpg")
          ? ".jpg"
          : "";
    const originalName = (att.filename ?? `attachment-${i + 1}${fallbackExt}`).trim();
    const cleanName = originalName.replace(/[^\w\s.-]/g, "_");

    attachments.push({
      attachmentIndex: i + 1,
      filename: cleanName,
      mimeType: att.contentType || "application/octet-stream",
      size: attBytes.byteLength,
      contentHash: attHash,
      contentDisposition: att.contentDisposition === "inline" ? "inline" : "attachment",
      contentId: att.cid ? String(att.cid) : null,
      bytes: attBytes,
    });
  }

  const canonicalEmlFilename = buildCanonicalMailFilename({
    messageDate,
    subject,
    senderAddress: from?.address ?? null,
    rawSha256,
  });

  return {
    mail_id: mailId,
    mail_account_id: mailAccountId,
    raw_sha256: rawSha256,
    raw_size: bytes.byteLength,
    message_id: messageId,
    in_reply_to: inReplyTo,
    references,
    from,
    to,
    cc,
    reply_to: replyTo,
    subject,
    message_date: messageDate,
    message_date_source: messageDateSource,
    body_text: bodyText,
    body_html: bodyHtml,
    attachment_count: attachments.length,
    attachments,
    canonical_eml_filename: canonicalEmlFilename,
  };
}
