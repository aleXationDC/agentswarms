import { describe, expect, it, vi } from "vitest";
import {
  documentIngressManifest,
  documentStoredIngress,
} from "@/axtn/workbenches/documents/documentPersistence.server";
import {
  DocumentInputManifest,
  DocumentWorkIdentity,
} from "@/axtn/workbenches/documents/documentWorkContract";
import { documentInputHash } from "@/axtn/workbenches/documents/documentWork.server";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: vi.fn() } }));

const owner = "abcdefab-abcd-4abc-8abc-abcdefabcdef";
const foreignOwner = "22222222-2222-4222-8222-222222222222";
const marker = "SYNTHETIC_PRIVATE_MARKER";

describe("Environment pilot E5 reuses native deterministic document privacy contracts", () => {
  it.each(["NO_AI", "UNRESOLVED"] as const)(
    "minimizes %s ingress without changing identity, privacy or permitting semantic intake",
    (privacyStatus) => {
      const original = {
        business_request_id: "synthetic-context-request",
        idempotency_key: "synthetic-context-delivery",
        source_type: "fixture",
        source_ref: "synthetic:private-source",
        source_revision: "synthetic-v1",
        source_identity: { original_filename: marker },
        technical: { original_sha256: "a".repeat(64), provider_secret: marker },
        privacy: { state: privacyStatus, explanation: marker },
        document_text: marker.repeat(500),
      };
      const raw = JSON.stringify(original);
      const stored = documentStoredIngress(owner, raw);
      const minimized = JSON.parse(stored);
      expect(stored).not.toContain(marker);
      expect(stored).not.toContain(original.source_ref);
      expect(minimized.privacy_status).toBe(privacyStatus);
      expect(minimized.input_hash).toBe(documentInputHash(documentIngressManifest(original)));
      expect(documentStoredIngress(owner, stored)).toBe(stored);
      expect(Buffer.byteLength(stored)).toBeLessThan(Buffer.byteLength(raw) / 10);
      expect(() => documentStoredIngress(foreignOwner, stored)).toThrow(
        "DOCUMENT_PERSISTENCE_MINIMIZED_OWNER_REQUIRED",
      );
      const identity = {
        businessRequestId: original.business_request_id,
        deliveryId: original.idempotency_key,
        caseType: "DOCUMENT_PROCESSING",
        workContractRef: {
          kind: "contract",
          repository: "aXtn/aXtn-agentswarms",
          id: "tests/unit/environmentPatternMinimalContext.test.ts",
        },
        scenarioClass: "synthetic_acceptance",
        scenarioId: "environment-pilot-minimal-context",
        processingMode: "DETERMINISTIC",
        executionChannel: "SWARM",
        actorRef: "synthetic-native-contract-test",
        inputManifest: documentIngressManifest(original),
      };
      expect(DocumentWorkIdentity.safeParse(identity).success).toBe(true);
      expect(
        DocumentWorkIdentity.safeParse({ ...identity, processingMode: "SEMANTIC" }).success,
      ).toBe(false);
      expect(
        DocumentInputManifest.safeParse({
          ...identity.inputManifest,
          privacyStatus: "ELIGIBLE",
        }).success,
      ).toBe(false);
    },
  );
});
