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
  document_id: "google_drive:drive:1F8F2UoPXxj51XZarRMMQ9IqFH1UYz7TR",
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

  it("derives source and provider file id from the identifier the run produced", () => {
    const registration = registrationContext(approval());

    expect(registration?.sourceType).toBe("google_drive");
    expect(registration?.providerFileId).toBe("1F8F2UoPXxj51XZarRMMQ9IqFH1UYz7TR");
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

// The drawer cannot be rendered in the node test environment, so its contract
// is guarded at the source level. These assertions are what stop the drawer
// from drifting away from the review page again.
describe("pending approval drawer contract", () => {
  const drawer = readFileSync(path.join(rootDir, "src/components/ApprovalInbox.tsx"), "utf8");

  it("offers both Approve and Reject", () => {
    expect(drawer).toContain('decide(ap, "approved")');
    expect(drawer).toContain('decide(ap, "rejected")');
  });

  it("routes both decisions through the shared approval decision path", () => {
    expect(drawer).toContain("useApprovalDecision");
    // No bespoke second write path into approvals from the drawer.
    expect(drawer).not.toMatch(/from\("approvals"\)[\s\S]{0,200}\.update\(/);
  });

  it("hides the decision actions on a review that is no longer actionable", () => {
    expect(drawer).toContain("isActionableReview(ap)");
  });

  it("shows the interpreted context, not only a raw payload dump", () => {
    expect(drawer).toContain("ReviewContextPanel");
  });
});

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

  it("resolves the registry row read-only by document_id", () => {
    expect(panel).toContain("findWorkbenchDocumentByDocumentId");
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
    expect(panel).toContain(".catch(() => undefined)");
  });
});
