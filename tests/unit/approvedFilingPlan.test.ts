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
      proposed_folder_path: "03_Ressources/Insurance",
      proposed_filename: "some model title.pdf",
      document_date: "2026-04-01",
    };
    const envelope = {
      source_filename: "Invoice.pdf",
      ingested_at: "2026-04-02T00:00:00.000Z",
    };
    const plan = buildApprovedFilingPlan(proposal, envelope);
    expect(plan.approved_target_folder).toBe("03_Ressources/Insurance");
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
});
