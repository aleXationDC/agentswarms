// DMS-LIVE-0002-A-R1: the intake registration boundary must preserve the
// technical facts the transport already established.
//
// The defect these tests lock down: the envelope carried filename, MIME type
// and SHA-256, and the registry declared columns for all three, but the
// registration mapping only read the mail-shaped fields. Every registered Drive
// document therefore landed in the registry with eight populated columns and no
// way to tell one from another in the UI.
//
// The mapping under test is the deployed swarm function-node body, kept in the
// repository so it is reviewable and testable rather than only living in the
// database.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VALIDATE_SOURCE = readFileSync(
  path.join(rootDir, "axtn/swarms/axtn-document-intake/nodes/validate-envelope.js"),
  "utf8",
);

type UpsertCall = {
  table_name: string;
  key_column: string;
  key_value: string;
  row: Record<string, unknown>;
};

/**
 * Runs the real function-node body the way the swarm runtime does: the code is
 * a function body with a `ctx` in scope that returns the MCP tool arguments.
 */
function runValidate(envelope: unknown): UpsertCall {
  const fn = new Function("ctx", VALIDATE_SOURCE) as (ctx: unknown) => string;
  return JSON.parse(fn({ input: envelope, vars: {} }));
}

// The exact envelope the accepted Drive intake workflow emits per document.
const DRIVE_ENVELOPE = {
  schema_version: "axtn-drive-document-intake-v1",
  source_type: "google_drive",
  document_id: "drive:1F8F2UoPXxj51XZarRMMQ9IqFH1UYz7TR",
  idempotency_key: "drive:1F8F2UoPXxj51XZarRMMQ9IqFH1UYz7TR",
  source_identity: {
    drive_file_id: "1F8F2UoPXxj51XZarRMMQ9IqFH1UYz7TR",
    parent_folder_id: "1jpMNNm60DaRYxKblzcF8u--8z8n7-a5u",
  },
  technical: {
    original_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    mime_type: "application/pdf",
    original_name: "Rechnung-2026-01.pdf",
    extraction_status: "not_attempted",
  },
  privacy: { status: "UNRESOLVED", basis: "none", rule_id: null },
  transport: { location: "00_Inbox" },
};

describe("intake registration mapping", () => {
  it("still targets the canonical registry keyed on document_id", () => {
    const call = runValidate(DRIVE_ENVELOPE);

    expect(call.table_name).toBe("axtn_document_registry");
    expect(call.key_column).toBe("document_id");
    expect(call.key_value).toBe("google_drive:drive:1F8F2UoPXxj51XZarRMMQ9IqFH1UYz7TR");
    expect(call.row.document_id).toBe(call.key_value);
  });

  it("preserves the technical facts the transport already established", () => {
    const { row } = runValidate(DRIVE_ENVELOPE);

    expect(row.original_filename).toBe("Rechnung-2026-01.pdf");
    expect(row.mime_type).toBe("application/pdf");
    expect(row.content_hash).toBe(DRIVE_ENVELOPE.technical.original_sha256);
    expect(row.hash_algorithm).toBe("sha256");
    expect(row.extraction_status).toBe("not_attempted");
  });

  it("preserves the provider-side source identity", () => {
    const { row } = runValidate(DRIVE_ENVELOPE);

    expect(row.source_type).toBe("google_drive");
    expect(row.source_ref).toBe("drive:1F8F2UoPXxj51XZarRMMQ9IqFH1UYz7TR");
    expect(row.drive_file_id).toBe("1F8F2UoPXxj51XZarRMMQ9IqFH1UYz7TR");
    expect(row.current_parent_folder_id).toBe("1jpMNNm60DaRYxKblzcF8u--8z8n7-a5u");
    expect(row.current_path).toBe("00_Inbox");
  });

  it("keeps the lifecycle and privacy contract unchanged", () => {
    const { row } = runValidate(DRIVE_ENVELOPE);

    expect(row.record_kind).toBe("document");
    expect(row.processing_status).toBe("registered");
    expect(row.privacy_status).toBe("UNRESOLVED");
    expect(row.schema_version).toBe("axtn-drive-document-intake-v1");
  });

  it("fabricates nothing when the technical facts are absent", () => {
    const { row } = runValidate({ ...DRIVE_ENVELOPE, technical: undefined });

    for (const column of [
      "original_filename",
      "current_filename",
      "mime_type",
      "content_hash",
      "hash_algorithm",
      "extraction_status",
      "file_size",
    ]) {
      expect(row).not.toHaveProperty(column);
    }
    // The identity that really did arrive is still recorded.
    expect(row.document_id).toBeTruthy();
    expect(row.drive_file_id).toBe("1F8F2UoPXxj51XZarRMMQ9IqFH1UYz7TR");
  });

  it("does not claim a hash algorithm when there is no hash", () => {
    const { row } = runValidate({
      ...DRIVE_ENVELOPE,
      technical: { ...DRIVE_ENVELOPE.technical, original_sha256: null },
    });

    expect(row).not.toHaveProperty("content_hash");
    expect(row).not.toHaveProperty("hash_algorithm");
  });

  it("honours an explicitly declared hash algorithm", () => {
    const { row } = runValidate({
      ...DRIVE_ENVELOPE,
      technical: {
        ...DRIVE_ENVELOPE.technical,
        original_sha256: undefined,
        content_hash: "abc",
        hash_algorithm: "sha512",
      },
    });

    expect(row.content_hash).toBe("abc");
    expect(row.hash_algorithm).toBe("sha512");
  });

  it("records file size as a number and ignores a non-numeric one", () => {
    expect(
      runValidate({
        ...DRIVE_ENVELOPE,
        technical: { ...DRIVE_ENVELOPE.technical, file_size: 8421 },
      }).row.file_size,
    ).toBe(8421);
    expect(
      runValidate({
        ...DRIVE_ENVELOPE,
        technical: { ...DRIVE_ENVELOPE.technical, file_size: "unknown" },
      }).row,
    ).not.toHaveProperty("file_size");
  });

  it("leaves the mail envelope contract working unchanged", () => {
    const { row } = runValidate({
      schema_version: "axtn-mail-ingress-v3",
      source_type: "gmail",
      artifact_type: "mail",
      idempotency_key: "gmail:acct:msg-1",
      source_identity: { provider_type: "google_workspace", provider_account_id: "acct" },
      mail: { message_id: "<m@x>", mail_ref: "msg-1" },
      privacy: { status: "NO_AI" },
      transport: { mailbox: "INBOX" },
    });

    expect(row.message_id).toBe("<m@x>");
    expect(row.mail_ref).toBe("msg-1");
    expect(row.mailbox).toBe("INBOX");
    expect(row.privacy_status).toBe("NO_AI");
    expect(row.processing_status).toBe("registered");
    // A mail envelope carries no Drive facts and must not gain any.
    expect(row).not.toHaveProperty("drive_file_id");
    expect(row).not.toHaveProperty("mime_type");
  });

  it("still fails closed on an unsupported privacy state", () => {
    expect(() =>
      runValidate({ ...DRIVE_ENVELOPE, privacy: { status: "AI_ALLOWED" } }),
    ).toThrowError(/PRIVACY_UNSUPPORTED_STATE/);
  });

  it("still refuses an incomplete envelope", () => {
    expect(() => runValidate({ ...DRIVE_ENVELOPE, idempotency_key: "" })).toThrowError(
      /INVALID_ENVELOPE/,
    );
  });

  it("writes only columns the registry declares", () => {
    // Mirrors the declared column schema of axtn_document_registry. The Local
    // Table broker rejects the whole upsert on an undeclared column, so a typo
    // here would fail the live write rather than be silently ignored.
    const declared = new Set([
      "artifact_type",
      "attachment_index",
      "canonical_filename",
      "classification_status",
      "classified_by",
      "confidence",
      "content_hash",
      "created_time",
      "current_filename",
      "current_parent_folder_id",
      "current_path",
      "discovered_at",
      "document_date",
      "document_id",
      "document_type",
      "drive_file_id",
      "drive_url",
      "extraction_error",
      "extraction_status",
      "file_size",
      "hash_algorithm",
      "human_review_status",
      "last_verified_at",
      "mail_identity_source",
      "mail_ref",
      "mailbox",
      "message_id",
      "mime_type",
      "modified_time",
      "naming_policy_version",
      "organization",
      "original_filename",
      "para_class",
      "parent_document_id",
      "primary_domain",
      "privacy_status",
      "processing_status",
      "proposed_path",
      "provider_account_id",
      "provider_message_id",
      "provider_type",
      "record_kind",
      "related_entity",
      "schema_version",
      "source_approval_id",
      "source_ref",
      "source_swarm_run_id",
      "source_type",
      "uid",
      "uidvalidity",
    ]);
    const { row } = runValidate({
      ...DRIVE_ENVELOPE,
      technical: { ...DRIVE_ENVELOPE.technical, file_size: 10 },
    });

    expect(Object.keys(row).filter((column) => !declared.has(column))).toEqual([]);
  });

  it("introduces no persistence or network access of its own", () => {
    expect(VALIDATE_SOURCE).not.toMatch(/\bfetch\s*\(|supabase|createClient|process\.env/);
  });
});
