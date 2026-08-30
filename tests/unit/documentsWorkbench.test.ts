// DMS-D1-0005-DOCUMENTS-v2 §10 - §13 (Documents Workbench unit tests)
import { describe, expect, it } from "vitest";
import {
  previewDocumentImpact,
  type DocumentListItem,
  type DocumentCorrectionEdits,
} from "@/lib/documentsWorkbench";

describe("Documents Workbench — previewDocumentImpact", () => {
  const baseDoc: DocumentListItem = {
    documentId: "drive:test123",
    driveFileId: "test123",
    driveUrl: "https://drive.google.com/file/d/test123/view",
    canonicalFilename: "2026-08-30_Invoice_Telekom.pdf",
    originalFilename: "Invoice_Telekom.pdf",
    documentType: "invoice",
    documentFamily: "Finance",
    organization: "Deutsche Telekom",
    primaryDomain: "Finance",
    documentDate: "2026-08-30",
    documentDateSource: "explicit_document",
    currentPath: "02_Areas/Finanzen",
    proposedPath: "02_Areas/Finanzen",
    paraClass: "02_Areas",
    status: "approved",
    confidence: 0.95,
    ingestedAt: "2026-08-30T12:00:00.000Z",
    modifiedTime: "2026-08-30T12:00:00.000Z",
    topics: "DSL, Fiber",
    fileSize: 10240,
    mimeType: "application/pdf",
    contentHash: "hash123",
    privacyClass: "standard",
  };

  it("detects metadata-only edits without filename or path changes", () => {
    const edits: DocumentCorrectionEdits = {
      document_type: "receipt",
      organization: "Telekom Deutschland",
      topics: "Fiber 500",
    };
    const impact = previewDocumentImpact(baseDoc, edits);
    expect(impact.actionType).toBe("metadata_only");
    expect(impact.hasFilenameChange).toBe(false);
    expect(impact.hasPathChange).toBe(false);
    expect(impact.targetFilename).toBe("2026-08-30_Invoice_Telekom.pdf");
    expect(impact.targetPath).toBe("02_Areas/Finanzen");
  });

  it("detects rename when date changes canonical filename", () => {
    const edits: DocumentCorrectionEdits = {
      document_date: "2026-09-01",
    };
    const impact = previewDocumentImpact(baseDoc, edits);
    expect(impact.actionType).toBe("rename");
    expect(impact.hasFilenameChange).toBe(true);
    expect(impact.hasPathChange).toBe(false);
    expect(impact.targetFilename).toBe("2026-09-01_Invoice_Telekom.pdf");
  });

  it("detects move when PARA target folder changes", () => {
    const edits: DocumentCorrectionEdits = {
      proposed_path: "04_Archive/2026/Telekom",
    };
    const impact = previewDocumentImpact(baseDoc, edits);
    expect(impact.actionType).toBe("move");
    expect(impact.hasFilenameChange).toBe(false);
    expect(impact.hasPathChange).toBe(true);
    expect(impact.targetPath).toBe("04_Archive/2026/Telekom");
  });

  it("detects rename and move when both change", () => {
    const edits: DocumentCorrectionEdits = {
      canonical_filename: "2026-08-30_Telekom_Bill_Final.pdf",
      proposed_path: "01_Projects/HomeOffice/Invoices",
    };
    const impact = previewDocumentImpact(baseDoc, edits);
    expect(impact.actionType).toBe("rename_and_move");
    expect(impact.hasFilenameChange).toBe(true);
    expect(impact.hasPathChange).toBe(true);
    expect(impact.targetFilename).toBe("2026-08-30_Telekom_Bill_Final.pdf");
    expect(impact.targetPath).toBe("01_Projects/HomeOffice/Invoices");
  });

  it("rejects non-PARA folder roots and falls back safely", () => {
    const edits: DocumentCorrectionEdits = {
      proposed_path: "00_Inbox/Unknown", // invalid root
    };
    const impact = previewDocumentImpact(baseDoc, edits);
    expect(impact.hasPathChange).toBe(false);
    expect(impact.targetPath).toBe("02_Areas/Finanzen");
  });
});
