// DMS-D1-0002 §11 (Ablagebot preflight contract): the fields Ablagebot's
// dry-run validation requires (`approved_target_folder`, `approved_filename`)
// must be asserted deterministically over the approved proposal — never sent
// as the model's raw `proposed_folder_path`/`proposed_filename` field names
// (which Ablagebot does not recognise) and never with a model-invented
// filename (canonicalFilename.ts owns filename shape).
import { describe, expect, it } from "vitest";

import { buildApprovedFilingPlan } from "@/lib/documentIdentity";

describe("buildApprovedFilingPlan", () => {
  it("maps the human-approved folder path to approved_target_folder", () => {
    const proposal = {
      document_id: "drive:abc123",
      proposed_folder_path: "03_Resources/Insurance",
      proposed_filename: "some model title.pdf",
      document_date: "2026-04-01",
    };
    const envelope = {
      source_filename: "Invoice.pdf",
      ingested_at: "2026-04-02T00:00:00.000Z",
    };
    const plan = buildApprovedFilingPlan(proposal, envelope);
    expect(plan.approved_target_folder).toBe("03_Resources/Insurance");
  });

  it("uses the deterministic canonical filename, not the model's proposed_filename", () => {
    const proposal = {
      proposed_folder_path: "04_Archive",
      proposed_filename: "AI invented name.pdf",
      document_date: "2026-04-01",
    };
    const envelope = { source_filename: "Invoice.pdf" };
    const plan = buildApprovedFilingPlan(proposal, envelope);
    expect(plan.approved_filename).toBe("2026-04-01_Invoice.pdf");
  });

  it("falls back to the source filename unchanged when no usable date exists", () => {
    const proposal = { proposed_folder_path: "04_Archive" };
    const envelope = { source_filename: "Invoice.pdf" };
    const plan = buildApprovedFilingPlan(proposal, envelope);
    expect(plan.approved_filename).toBe("Invoice.pdf");
  });

  it("preserves every other proposal field untouched", () => {
    const proposal = {
      document_id: "drive:abc123",
      proposed_folder_path: "04_Archive",
      proposed_filename: "x.pdf",
      document_type: "invoice",
      confidence: 0.9,
    };
    const envelope = { source_filename: "x.pdf" };
    const plan = buildApprovedFilingPlan(proposal, envelope);
    expect(plan.document_id).toBe("drive:abc123");
    expect(plan.document_type).toBe("invoice");
    expect(plan.confidence).toBe(0.9);
  });

  // DMS-D1-0005-DOCUMENTS-v2 §6: Resume execution precedence
  it("applies human-overridden PARA target and date to downstream filing plan", () => {
    const humanOverrideProposal = {
      document_id: "drive:abc123",
      proposed_folder_path: "01_Projects/Alpha/Contracts",
      document_date: "2026-08-30",
      document_date_source: "explicit_document",
      human_overridden: true,
      duplicate_decision: "related_successor",
      target_canonical_document_id: "drive:orig456",
    };
    const envelope = {
      source_filename: "Contract_Amendment.pdf",
      created_time: "2026-08-20T00:00:00.000Z",
    };
    const plan = buildApprovedFilingPlan(humanOverrideProposal, envelope);
    expect(plan.approved_target_folder).toBe("01_Projects/Alpha/Contracts");
    expect(plan.approved_filename).toBe("2026-08-30_Contract_Amendment.pdf");
    expect(plan.duplicate_decision).toBe("related_successor");
    expect(plan.target_canonical_document_id).toBe("drive:orig456");
  });

  it("preserves duplicate/version decision in filing plan", () => {
    const duplicateProposal = {
      document_id: "drive:dup123",
      proposed_folder_path: "04_Archive",
      duplicate_decision: "duplicate",
      target_canonical_document_id: "drive:canon999",
    };
    const envelope = { source_filename: "statement.pdf" };
    const plan = buildApprovedFilingPlan(duplicateProposal, envelope);
    expect(plan.duplicate_decision).toBe("duplicate");
    expect(plan.target_canonical_document_id).toBe("drive:canon999");
  });
});
