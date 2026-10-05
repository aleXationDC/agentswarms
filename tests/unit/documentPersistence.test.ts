import { describe, expect, it, vi } from "vitest";
import {
  DocumentMinimizedIngress,
  DocumentMinimizedRegistrationAck,
  documentIngressManifest,
  documentScopedReferenceHash,
  documentStoredIngress,
  minimizeDocumentIngress,
  minimizeDocumentRegistrationAck,
  documentSuspendedOutput,
  DOCUMENT_SUSPENDED_OUTPUT,
  documentRunOutput,
  documentRunError,
  DOCUMENT_COMPLETED_OUTPUT,
  DOCUMENT_FAILED_OUTPUT,
} from "@/axtn/workbenches/documents/documentPersistence.server";
import { documentInputHash } from "@/axtn/workbenches/documents/documentWork.server";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: vi.fn() } }));
const owner = "abcdefab-abcd-4abc-8abc-abcdefabcdef";
const source = {
  business_request_id: "REQUEST_LEAKAGE_MARKER",
  idempotency_key: "DELIVERY_LEAKAGE_MARKER",
  source_ref: "drive:REFERENCE_LEAKAGE_MARKER",
  source_revision: '"REVISION_LEAKAGE_MARKER"',
  source_type: "google_drive",
  source_identity: { original_filename: "FILENAME_LEAKAGE_MARKER" },
  privacy: { state: "NO_AI", explanation: "PRIVATE_LEAKAGE_MARKER" },
  technical: { original_sha256: "a".repeat(64), provider_secret: "SECRET_LEAKAGE_MARKER" },
  document_text: "FULL_TEXT_LEAKAGE_MARKER",
  attachment: "ORIGINAL_LEAKAGE_MARKER",
};
const ack = {
  accepted: true,
  document_id: "DOCUMENT_LEAKAGE_MARKER",
  source_ref: source.source_ref,
  processing_status: "registered",
  processing_route: "privacy_hold",
  registry_outcome: "inserted",
  case_id: "22222222-2222-4222-8222-222222222222",
  input_hash: documentInputHash(documentIngressManifest(source)),
};
describe("DMS minimized storage codecs, not privacy or execution authority", () => {
  it.each([
    ["suspended", DOCUMENT_SUSPENDED_OUTPUT],
    ["success", DOCUMENT_COMPLETED_OUTPUT],
    ["error", DOCUMENT_FAILED_OUTPUT],
  ] as const)("omits Parent %s output while preserving generic output", (status, expected) => {
    expect(
      documentRunOutput("9b9ea6c2-a554-4fa7-9c40-908dad632ae7", status, "ORIGINAL_LEAKAGE_MARKER"),
    ).toBe(expected);
    expect(documentRunOutput("generic", status, "ORIGINAL_LEAKAGE_MARKER")).toBe(
      "ORIGINAL_LEAKAGE_MARKER",
    );
  });
  it.each([
    ["ORIGINAL_LEAKAGE_MARKER", "DOCUMENT_RUN_FAILED"],
    ["DOCUMENT_UNLISTED_LEAKAGE_MARKER", "DOCUMENT_RUN_FAILED"],
    ["DOCUMENT_CHECKPOINT_WRITE_FAILED original text", "DOCUMENT_RUN_FAILED"],
    ["DOCUMENT_CHECKPOINT_WRITE_FAILED", "DOCUMENT_CHECKPOINT_WRITE_FAILED"],
    [null, null],
    [undefined, undefined],
  ])("allows only exact known diagnostic codes, never prefix-shaped text %s", (error, expected) => {
    expect(documentRunError("9b9ea6c2-a554-4fa7-9c40-908dad632ae7", error)).toBe(expected);
    expect(documentRunError("generic", error)).toBe(error);
  });
  it("omits suspended Parent free output but preserves unrelated output exactly", () => {
    expect(
      documentSuspendedOutput("9b9ea6c2-a554-4fa7-9c40-908dad632ae7", "ORIGINAL_LEAKAGE_MARKER"),
    ).toBe(DOCUMENT_SUSPENDED_OUTPUT);
    expect(documentSuspendedOutput("generic", "ORIGINAL_LEAKAGE_MARKER")).toBe(
      "ORIGINAL_LEAKAGE_MARKER",
    );
  });
  it("serializes and reuses strict owner-bound minimized input without raw fields", () => {
    const stored = documentStoredIngress(owner, JSON.stringify(source));
    expect(stored).not.toContain("LEAKAGE_MARKER");
    expect(documentStoredIngress(owner, stored)).toBe(stored);
    expect(documentStoredIngress(owner.toUpperCase(), stored)).toBe(stored);
  });
  it("rejects malformed original JSON with a content-free error", () => {
    expect(() => documentStoredIngress(owner, "ORIGINAL_LEAKAGE_MARKER")).toThrow(
      "DOCUMENT_PERSISTENCE_INGRESS_INVALID_JSON",
    );
  });
  it("rejects a foreign-owner minimized manifest explicitly", () => {
    expect(() =>
      documentStoredIngress(ack.case_id, documentStoredIngress(owner, JSON.stringify(source))),
    ).toThrow("DOCUMENT_PERSISTENCE_MINIMIZED_OWNER_REQUIRED");
  });
  it("rejects explicitly minimized raw extras instead of parsing them as legacy input", () => {
    expect(() =>
      documentStoredIngress(
        owner,
        JSON.stringify({
          ...minimizeDocumentIngress(owner, source),
          original: "LEAKAGE_MARKER",
        }),
      ),
    ).toThrow("DOCUMENT_PERSISTENCE_MINIMIZED_CONTRACT_REQUIRED");
  });
  it("rejects an unsupported ingress without recording caller text in its error", () => {
    expect(() =>
      documentStoredIngress(owner, JSON.stringify({ original: "LEAKAGE_MARKER" })),
    ).toThrow("DOCUMENT_PERSISTENCE_INGRESS_CONTRACT_REQUIRED");
  });
  it("projects all original/ref/request/revision/name/secret markers out of the ingress", () => {
    const projected = minimizeDocumentIngress(owner, source);
    expect(JSON.stringify(projected)).not.toContain("LEAKAGE_MARKER");
    expect(projected.input_hash).toBe(ack.input_hash);
    expect(projected.privacy_status).toBe("NO_AI");
    expect(projected.source_kind).toBe("drive");
    expect(DocumentMinimizedIngress.parse(projected)).toEqual(projected);
  });
  it("projects raw ACK references out while preserving exact Case/Input and technical status", () => {
    const projected = minimizeDocumentRegistrationAck(owner, ack);
    expect(JSON.stringify(projected)).not.toContain("LEAKAGE_MARKER");
    expect(projected.case_id).toBe(ack.case_id);
    expect(projected.input_hash).toBe(ack.input_hash);
    expect(DocumentMinimizedRegistrationAck.parse(projected)).toEqual(projected);
  });
  it("frames and scopes hashes to a canonical authenticated owner UUID", () => {
    expect(documentScopedReferenceHash(owner, "document")).toBe(
      documentScopedReferenceHash(owner.toUpperCase(), "document"),
    );
    expect(documentScopedReferenceHash(owner, "document")).not.toBe(
      documentScopedReferenceHash(ack.case_id, "document"),
    );
    expect(documentScopedReferenceHash(owner, "document")).not.toBe(
      documentScopedReferenceHash(owner, "document-2"),
    );
    expect(() => documentScopedReferenceHash("claimed owner", "document")).toThrow();
  });
  it("keeps source identity stable when transport delivery changes", () => {
    const first = minimizeDocumentIngress(owner, source);
    const second = minimizeDocumentIngress(owner, {
      ...source,
      idempotency_key: "different-delivery",
    });
    expect(second.delivery_hash).not.toBe(first.delivery_hash);
    expect(second.source_ref_hash).toBe(first.source_ref_hash);
    expect(second.input_hash).toBe(first.input_hash);
    expect(second.business_request_hash).toBe(first.business_request_hash);
  });
  it("retains legacy exact-source fallback without retaining its raw text", () => {
    const { source_ref: _sourceRef, ...legacy } = source;
    expect(documentIngressManifest(legacy).sourceRef).toBe(source.idempotency_key);
    expect(minimizeDocumentIngress(owner, legacy).source_ref_hash).toBe(
      documentScopedReferenceHash(owner, source.idempotency_key),
    );
  });
  it("retains provider revision/ETag fallback and original hash precedence", () => {
    const { source_revision: _revision, ...legacy } = source;
    const value = {
      ...legacy,
      source_identity: { etag: source.source_revision },
      technical: {
        original_sha256: source.technical.original_sha256,
        content_hash: "b".repeat(64),
      },
    };
    expect(documentIngressManifest(value).sourceRevision).toBe(source.source_revision);
    expect(minimizeDocumentIngress(owner, value).input_hash).toBe(ack.input_hash);
  });
  it.each(["imap", "gmail", "mail"])(
    "preserves exact Mail semantics and categorical review route %s",
    (source_type) => {
      expect(minimizeDocumentIngress(owner, { ...source, source_type }).source_kind).toBe("mail");
      expect(
        minimizeDocumentRegistrationAck(owner, { ...ack, next_location: "00_Review" })
          .next_location,
      ).toBe("00_Review");
    },
  );
  it.each([
    { source_ref: "" },
    { source_ref: "invalid\nreference" },
    { business_request_id: "invalid\nrequest" },
    { source_revision: "", source_identity: {} },
    { technical: { original_sha256: "not-hash" } },
    { privacy: { state: "ELIGIBLE" } },
    { privacy: { state: "unknown" } },
    { source_type: "unsupported" },
  ])(
    "fails malformed/unsupported input explicitly rather than inventing authority %j",
    (change) => {
      expect(() => minimizeDocumentIngress(owner, { ...source, ...change })).toThrow();
    },
  );
  it.each([
    { original: "LEAKAGE_MARKER" },
    { source_ref: source.source_ref },
    { approved: true },
    { owner_scope_hash: "claimed-owner" },
    { input_hash: "bad" },
  ])("strict minimized ingress rejects raw extras/claims %j", (change) => {
    expect(
      DocumentMinimizedIngress.safeParse({ ...minimizeDocumentIngress(owner, source), ...change })
        .success,
    ).toBe(false);
  });
  it.each([
    { original: "LEAKAGE_MARKER" },
    { source_ref: source.source_ref },
    { document_id: ack.document_id },
    { approved: true },
    { next_location: "ORIGINAL_LEAKAGE_MARKER" },
  ])("strict minimized ACK rejects raw extras/claims %j", (change) => {
    expect(
      DocumentMinimizedRegistrationAck.safeParse({
        ...minimizeDocumentRegistrationAck(owner, ack),
        ...change,
      }).success,
    ).toBe(false);
  });
  it("rejects an arbitrary raw route instead of persisting it as metadata", () => {
    expect(() =>
      minimizeDocumentRegistrationAck(owner, {
        ...ack,
        next_location: "RAW_ORIGINAL_LEAKAGE_MARKER",
      }),
    ).toThrow();
  });
});
