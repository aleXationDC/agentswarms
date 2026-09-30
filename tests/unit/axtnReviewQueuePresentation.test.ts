// DMS-LIVE-0003-A-R1: the review surface must be triageable and truthful.
//
// Two defects are locked down here.
//
// The queue rendered `action_title` as the subject of every row, so a review
// backlog of registered documents read as N identical lines saying "Review
// Intake Registration" — undecidable without opening every one of them.
//
// The detail view rendered the acknowledgement JSON as the Description, making
// the raw payload the primary working surface while the very same facts were
// interpreted directly below it.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  REGISTRATION_GATE_NOTE,
  registrationContext,
  reviewFacts,
  reviewSearchText,
  reviewSubject,
  type NativeApproval,
  type RegisteredDocumentFacts,
} from "@/axtn/workbenches/reviews/reviewWorkbench";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const FILE_ID = "1WzrMnmvfvc_8Sejt5Dm7Wl8-itzSZWTr";
const FILENAME = "2026-03-22_Scan_ 1.pdf";

const ACK = {
  accepted: true,
  document_id: "b64b00c064ab0cba3fc3c733",
  source_ref: `drive:${FILE_ID}`,
  processing_status: "registered",
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
    decided_at: null,
    decided_by: null,
    agent_id: null,
    swarm_run_id: "run-1",
    approver_user_ids: [],
    approver_group_ids: [],
    notified_at: null,
    ...overrides,
  } as NativeApproval;
}

const registryRow: RegisteredDocumentFacts = {
  filename: FILENAME,
  sourceType: "google_drive",
  currentPath: "00_Inbox",
  processingStatus: "registered",
  providerFileId: FILE_ID,
};

describe("review queue subject", () => {
  it("uses the document filename as the human subject of a registration", () => {
    expect(reviewSubject(approval(), registryRow)).toBe(FILENAME);
  });

  it("never substitutes an identifier for a filename", () => {
    const subject = reviewSubject(approval(), { ...registryRow, filename: null });

    expect(subject).not.toContain(FILE_ID);
    expect(subject).not.toContain(ACK.document_id);
    // Without a name the queue keeps the native approval title. It does not
    // invent one out of a locator.
    expect(subject).toBe("Review Intake Registration");
  });

  it("falls back to the native title when no registry row resolves", () => {
    expect(reviewSubject(approval(), null)).toBe("Review Intake Registration");
  });

  it("leaves a semantic proposal approval on its own title", () => {
    const proposal = approval({
      action_title: "Review Classification Proposal",
      description: null,
      payload: { proposal: { document_type: "invoice" } },
    });

    expect(registrationContext(proposal)).toBeNull();
    expect(reviewSubject(proposal, null)).toBe("Review Classification Proposal");
  });
});

describe("review queue facts", () => {
  it("states the registration context a reviewer needs without opening the item", () => {
    const facts = reviewFacts(approval(), registryRow);

    expect(facts).toContain("Intake registration");
    expect(facts).toContain("google_drive");
    expect(facts).toContain("00_Inbox");
    expect(facts).toContain("registered");
    expect(facts).toContain("privacy_hold");
    expect(facts).toContain("pending approval");
  });

  it("omits facts that do not exist rather than padding with placeholders", () => {
    const facts = reviewFacts(approval(), null);

    expect(facts).not.toContain("");
    expect(facts.every((fact) => fact.trim().length > 0)).toBe(true);
    expect(facts).not.toContain("00_Inbox");
  });

  it("does not announce a pending decision on a decided review", () => {
    const facts = reviewFacts(approval({ status: "approved" }), registryRow);

    expect(facts).not.toContain("pending approval");
  });

  it("keeps semantic proposals on their existing semantic facts", () => {
    const facts = reviewFacts(
      approval({
        description: null,
        payload: { proposal: { document_type: "invoice", primary_domain: "finance" } },
      }),
      null,
    );

    expect(facts).toEqual(["invoice", "finance"]);
  });
});

describe("review search", () => {
  it("finds a document by its name", () => {
    expect(reviewSearchText(approval(), registryRow)).toContain(FILENAME.toLowerCase());
  });

  it("still finds it by source, location and provider identifiers", () => {
    const text = reviewSearchText(approval(), registryRow);

    expect(text).toContain("google_drive");
    expect(text).toContain("00_inbox");
    expect(text).toContain(FILE_ID.toLowerCase());
    expect(text).toContain(ACK.document_id);
  });

  it("works without a resolved registry row", () => {
    expect(reviewSearchText(approval(), null)).toContain("review intake registration");
  });
});

describe("registration approval copy", () => {
  it("does not claim the registration still has to happen", () => {
    const note = REGISTRATION_GATE_NOTE.toLowerCase();

    expect(note).toContain("already complete");
    expect(note).not.toMatch(/approve to register|approving registers|will be registered/);
  });

  it("states what the decision actually does to a run that is already registered", () => {
    // Traced from the published aXtn Document Management swarm: gate1_intake
    // sits between run_intake and run_privacy, so the row exists before the
    // approval is shown and neither decision writes or unwinds it.
    const note = REGISTRATION_GATE_NOTE.toLowerCase();

    expect(note).toContain("further processing");
    expect(note).toContain("halts");
    expect(note).toContain("neither decision creates or removes the registration");
  });
});

describe("review surfaces", () => {
  const queue = readFileSync(path.join(rootDir, "src/routes/_authenticated/review.tsx"), "utf8");
  const detail = readFileSync(
    path.join(rootDir, "src/routes/_authenticated/review_.$approvalId.tsx"),
    "utf8",
  );
  const drawer = readFileSync(path.join(rootDir, "src/components/ApprovalInbox.tsx"), "utf8");

  it("renders the queue subject through the shared presentation model", () => {
    expect(queue).toContain("reviewSubject(item, documentFor(item))");
    expect(queue).toContain("reviewFacts(item, documentFor(item))");
  });

  it("searches the queue with the resolved document in hand", () => {
    expect(queue).toContain("reviewSearchText(item, documentFor(item))");
  });

  it("reads the registry once for the whole queue rather than per row", () => {
    expect(queue).toContain("useRegisteredDocumentsById()");
  });

  it("titles the detail view with the document, not the generic action title", () => {
    expect(detail).toContain("reviewSubject(approval, document)");
  });

  it("keeps raw acknowledgement and request context under Technical metadata", () => {
    expect(detail).toContain("Technical metadata");
    // The raw JSON is inside the collapsed block, not the primary Description.
    const technical = detail.slice(detail.indexOf("Technical metadata"));
    expect(technical).toContain("JSON.stringify(approval.payload, null, 2)");
    expect(detail).toMatch(/\{!isRegistration && \(/);
  });

  it("keeps queue and detail decisions on the native approval path", () => {
    expect(queue).toContain("useApprovalDecision");
    expect(detail).toContain("useApprovalDecision");
    expect(detail).toContain("isActionableReview(approval)");
    // The native inbox owns its direct approvals update and resumes parked
    // runs after the decision. It is not an aXtn review-detail surface.
    expect(drawer).toContain('.from("approvals")');
    expect(drawer).toContain('decide(ap.id, "rejected")');
    expect(drawer).toContain('decide(ap.id, "approved")');
  });

  // The native ApprovalInbox intentionally has no aXtn document-registry
  // lookup. Registration subjects are covered by the queue/detail model above.

  it("writes nothing through the review surfaces except the native decision", () => {
    for (const surface of [queue, detail]) {
      expect(surface).not.toMatch(/from\("user_data_rows"\)[\s\S]{0,80}\.(update|insert|delete)\(/);
    }
  });
});
