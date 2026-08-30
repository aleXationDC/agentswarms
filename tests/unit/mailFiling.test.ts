// Unit tests for mail filing projection and canonical PARA paths (DMS-D1-0003 §11, §14, §16).
import { describe, it, expect } from "vitest";
import {
  buildApprovedMailFilingPlan,
  buildImapTargetFolder,
} from "@/lib/mailFiling.server";

describe("MailFiling & PARA Projection", () => {
  it("projects logical relative PARA path to IMAP 00_aleXation/ prefix", () => {
    expect(buildImapTargetFolder("02_Areas/Immobilien/Elektro")).toBe("00_aleXation/02_Areas/Immobilien/Elektro");
    expect(buildImapTargetFolder("01_Projects/Migration")).toBe("00_aleXation/01_Projects/Migration");
    expect(buildImapTargetFolder("/03_Resources/Manuals/")).toBe("00_aleXation/03_Resources/Manuals");
  });

  it("builds deterministic approved mail filing plan with attachments", () => {
    const proposal = {
      proposed_folder_path: "02_Areas/Immobilien/Elektro",
      document_type: "email",
      document_date: "2026-08-30",
      document_date_source: "explicit_document",
    };

    const envelope = {
      mail_id: "mail:primary:sha256:abcd1234efgh5678",
      drive_eml_file_id: "drive-eml-999",
      canonical_eml_filename: "2026-08-30_MAIL_Invoice_abcd1234.eml",
      message_date: "2026-08-30",
    };

    const attachments = [
      {
        document_id: "drive:att-file-123",
        drive_file_id: "att-file-123",
        original_filename: "rechnung_elektro.pdf",
        proposed_folder_path: "02_Areas/Immobilien/Elektro",
      },
    ];

    const plan = buildApprovedMailFilingPlan({
      mailId: "mail:primary:sha256:abcd1234efgh5678",
      proposal,
      envelope,
      attachments,
      approvalId: "appr-001",
    });

    expect(plan.mail_id).toBe("mail:primary:sha256:abcd1234efgh5678");
    expect(plan.drive_eml_file_id).toBe("drive-eml-999");
    expect(plan.approved_target_folder).toBe("02_Areas/Immobilien/Elektro");
    expect(plan.approved_eml_filename).toBe("2026-08-30_MAIL_Invoice_abcd1234.eml");
    expect(plan.imap_target_folder).toBe("00_aleXation/02_Areas/Immobilien/Elektro");
    expect(plan.attachments).toHaveLength(1);
    expect(plan.attachments[0].document_id).toBe("drive:att-file-123");
    expect(plan.attachments[0].approved_target_folder).toBe("02_Areas/Immobilien/Elektro");
    expect(plan.attachments[0].approved_filename).toMatch(/^2026-08-30_/);
  });
});
