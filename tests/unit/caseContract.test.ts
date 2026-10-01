import { describe, expect, it } from "vitest";

import {
  effectiveCaseStatus,
  reopenOnRelevantActivity,
  validateCaseDraft,
} from "@/axtn/workbenches/cases/caseContract";

describe("SupaCase contract", () => {
  it("requires a Contact and follow-up for WAITING_CONTACT", () => {
    expect(() => validateCaseDraft({ subject: "Call", status: "WAITING_CONTACT" })).toThrow(
      "WAITING_CONTACT requires a primary Contact",
    );
    expect(() =>
      validateCaseDraft({ subject: "Call", status: "WAITING_CONTACT", primary_contact_id: "c" }),
    ).toThrow("WAITING_CONTACT requires a follow-up date");
    expect(() =>
      validateCaseDraft({
        subject: "Call",
        status: "WAITING_CONTACT",
        primary_contact_id: "c",
        follow_up: "2026-09-05",
      }),
    ).not.toThrow();
  });

  it("does not permit automation to set priority 0", () => {
    expect(() => validateCaseDraft({ subject: "Critical", priority: 0 }, "automation")).toThrow(
      "Only a human",
    );
    expect(() => validateCaseDraft({ subject: "Critical", priority: 0 }, "human")).not.toThrow();
  });

  it("derives OPEN when follow-up is due and reopens CLOSED on activity", () => {
    expect(
      effectiveCaseStatus(
        "WAITING_CONTACT",
        "2026-09-04T23:59:00Z",
        new Date("2026-09-05T00:00:00Z"),
      ),
    ).toBe("OPEN");
    expect(
      effectiveCaseStatus("CLOSED", "2020-01-01T00:00:00Z", new Date("2026-09-05T00:00:00Z")),
    ).toBe("CLOSED");
    expect(reopenOnRelevantActivity("CLOSED")).toEqual({
      status: "OPEN",
      status_reason: "Relevant new activity",
    });
  });
});
