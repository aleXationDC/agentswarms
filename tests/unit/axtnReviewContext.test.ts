// DMS-LIVE-0002-A: aXtn Reviews and the pending-approval drawer must explain
// what a reviewer is actually deciding.
//
// The defect these tests lock down: a Stage-0 registration approval carries the
// intake acknowledgement in `payload.last_output`, not a classification
// proposal. The review surface only understood `payload.proposal`, so every
// field rendered as "—" and the reviewer was asked to approve a blank form.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  isActionableReview,
  registrationContext,
  reviewContext,
  type NativeApproval,
} from "@/axtn/workbenches/reviews/reviewWorkbench";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const ACK = {
  accepted: true,
  document_id: "b64b00c064ab0cba3fc3c733",
  source_ref: "drive:1F8F2UoPXxj51XZarRMMQ9IqFH1UYz7TR",
  processing_status: "registered",
  next_location: "00_Review",
  processing_route: "privacy_hold",
  registry_outcome: "inserted",
};

function approval(overrides: Partial<NativeApproval> = {}): NativeApproval {
  return {
    id: "approval-1",
    user_id: "user-1",
    status: "pending",
    action_type: "swarm_step",
    action_title: "Review Intake Registration",
    agent_name: "Human Approval: Review Intake Registration",
    agent_avatar: "🛡️",
    risk_level: "medium",
    description: JSON.stringify(ACK),
    payload: { last_output: JSON.stringify(ACK) },
    created_at: new Date().toISOString(),
    ...overrides,
  } as NativeApproval;
}

describe("registration approval context", () => {
  it("interprets the intake acknowledgement instead of showing an empty form", () => {
    const registration = registrationContext(approval());

    expect(registration).not.toBeNull();
    expect(registration?.documentId).toBe(ACK.document_id);
    expect(registration?.processingStatus).toBe("registered");
    expect(registration?.registryOutcome).toBe("inserted");
    expect(registration?.processingRoute).toBe("privacy_hold");
    expect(registration?.nextLocation).toBe("00_Review");
    expect(registration?.accepted).toBe(true);
  });

  it("reads the provider file id out of the source reference, not the identity", () => {
    const registration = registrationContext(approval());

    expect(registration?.sourceRef).toBe("drive:1F8F2UoPXxj51XZarRMMQ9IqFH1UYz7TR");
    expect(registration?.providerFileId).toBe("1F8F2UoPXxj51XZarRMMQ9IqFH1UYz7TR");
    // The document identity is opaque and carries no provider information, so
    // no source kind can be derived from it. The registry row supplies that.
    expect(registration?.sourceType).toBeNull();
    expect(registration?.providerFileId).not.toBe(registration?.documentId);
  });

  it("never mines the opaque document identity for a provider file id", () => {
    // A 24-hex identity has no ":" to split, and splitting it would fabricate
    // a locator out of an identifier that deliberately contains none.
    const registration = registrationContext(
      approval({
        description: JSON.stringify({
          accepted: true,
          document_id: "b64b00c064ab0cba3fc3c733",
          processing_status: "registered",
        }),
        payload: {},
      }),
    );

    expect(registration?.documentId).toBe("b64b00c064ab0cba3fc3c733");
    expect(registration?.providerFileId).toBeNull();
    expect(registration?.sourceType).toBeNull();
  });

  it("falls back to the description when the payload carries no last_output", () => {
    const registration = registrationContext(approval({ payload: {} }));

    expect(registration?.documentId).toBe(ACK.document_id);
  });

  it("accepts an already-decoded acknowledgement object", () => {
    const registration = registrationContext(approval({ payload: { last_output: ACK } }));

    expect(registration?.documentId).toBe(ACK.document_id);
  });

  it("returns nothing rather than a guess when there is no acknowledgement", () => {
    expect(
      registrationContext(approval({ payload: { note: "hi" }, description: "plain text" })),
    ).toBeNull();
    expect(registrationContext(approval({ payload: {}, description: "{}" }))).toBeNull();
  });

  it("does not claim a registration for a semantic proposal approval", () => {
    const semantic = approval({
      description: "Classify invoice",
      payload: { proposal: { document_type: "Invoice", organization: "ACME", confidence: 0.91 } },
    });

    expect(registrationContext(semantic)).toBeNull();
  });
});

describe("review context", () => {
  it("exposes the registration context on a registration approval", () => {
    const context = reviewContext(approval());

    expect(context.registration?.documentId).toBe(ACK.document_id);
  });

  it("still renders semantic proposals exactly as before", () => {
    const context = reviewContext(
      approval({
        description: "Classify invoice",
        payload: {
          proposal: {
            document_type: "Invoice",
            organization: "ACME",
            proposed_path: "10_Areas/Finance",
            confidence: 0.91,
            summary: "Quarterly invoice",
          },
        },
      }),
    );

    expect(context.documentType).toBe("Invoice");
    expect(context.organization).toBe("ACME");
    expect(context.proposedLocation).toBe("10_Areas/Finance");
    expect(context.confidence).toBe(0.91);
    expect(context.summary).toBe("Quarterly invoice");
    expect(context.registration).toBeNull();
  });
});

describe("review actionability", () => {
  it("is actionable while pending", () => {
    expect(isActionableReview(approval())).toBe(true);
  });

  it("is not actionable once decided", () => {
    expect(isActionableReview(approval({ status: "approved" }))).toBe(false);
    expect(isActionableReview(approval({ status: "rejected" }))).toBe(false);
  });
});

// The 1.5.0 upgrade restores the native ApprovalInbox implementation. The
// former aXtn-specific drawer assertions described an implementation that is
// no longer part of the native surface; review semantics remain covered above
// and the native inbox is covered by its own upstream tests.

describe("review detail page contract", () => {
  const page = readFileSync(
    path.join(rootDir, "src/routes/_authenticated/review_.$approvalId.tsx"),
    "utf8",
  );

  it("uses the same context renderer and the same actionability rule as the drawer", () => {
    expect(page).toContain("ReviewContextPanel");
    expect(page).toContain("isActionableReview(approval)");
  });

  it("routes decisions through the shared approval decision path", () => {
    expect(page).toContain("useApprovalDecision");
  });
});

describe("registration review supplementation contract", () => {
  const panel = readFileSync(
    path.join(rootDir, "src/components/axtn/ReviewContextPanel.tsx"),
    "utf8",
  );
  const lookupHook = readFileSync(
    path.join(rootDir, "src/hooks/use-registered-document.ts"),
    "utf8",
  );

  it("resolves the registry row read-only by document_id", () => {
    // The lookup lives in the shared hook so the drawer, the detail page and
    // the queue can never disagree about which document an approval is about.
    expect(panel).toContain("useRegisteredDocument");
    expect(lookupHook).toContain("findWorkbenchDocumentByDocumentId");
    expect(lookupHook).not.toMatch(/\.update\(|\.insert\(|\.upsert\(|\.delete\(/);
  });

  it("displays the technical identity fields the handoff requires", () => {
    for (const label of [
      '"Document ID"',
      '"Filename"',
      '"Source kind"',
      '"Provider file ID"',
      '"MIME type"',
      '"Content hash"',
      '"Registration status"',
      '"Registry outcome"',
      '"Next location"',
    ]) {
      expect(panel).toContain(label);
    }
  });

  it("keeps the approval record as the primary source", () => {
    // ACK values come first; registry values only fill gaps.
    expect(panel).toContain("registration.sourceType ?? document?.sourceType");
    expect(panel).toContain("registration.providerFileId ?? document?.providerFileId");
  });

  it("never mutates the approval or writes through this panel", () => {
    expect(panel).not.toMatch(/\.update\(|\.insert\(|\.upsert\(|\.delete\(/);
  });

  it("tolerates a missing registry row without breaking rendering", () => {
    // The lookup failure path is swallowed and the panel still renders the ACK.
    expect(lookupHook).toContain(".catch(() => undefined)");
  });
});
