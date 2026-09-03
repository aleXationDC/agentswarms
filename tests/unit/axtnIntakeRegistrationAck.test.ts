// DMS-LIVE-0003-A: the ACK may only state what actually happened.
//
// Two defects met in this node. It reported `next_location: "00_Review"` for a
// Google Drive file that registration never moved and never intended to move,
// and it echoed the document identity the caller had supplied — so a provider
// locator round-tripped back out as if the registry had confirmed it.
//
// The ACK now reports the identity the registry really holds, read back from
// the write result, and names a destination only for the transport that is
// genuinely being asked to move something.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ACK_SOURCE = readFileSync(
  path.join(rootDir, "axtn/swarms/axtn-document-intake/nodes/registration-ack.js"),
  "utf8",
);

type Ack = {
  accepted: boolean;
  document_id: string;
  source_ref: string;
  processing_status: string;
  processing_route: string;
  registry_outcome?: string;
  next_location?: string;
  error?: string;
};

const MINTED_ID = "0f1e2d3c4b5a69788796a5b4";

function plan(sourceType: string, keyValue: string) {
  return JSON.stringify({
    key_column: "source_ref",
    key_value: keyValue,
    row: { privacy_status: "NO_AI", source_type: sourceType },
  });
}

function brokerResult(outcome: string, documentId: string | null = MINTED_ID) {
  return JSON.stringify({
    result: {
      structuredContent: {
        outcome,
        ...(documentId === null ? {} : { effective_columns: { document_id: documentId } }),
      },
    },
  });
}

/** Runs the real deployed function-node body the way the swarm runtime does. */
function runAck(input: string, envelope: string): Ack {
  const fn = new Function("ctx", ACK_SOURCE) as (ctx: unknown) => string;
  return JSON.parse(fn({ input, vars: { envelope } }));
}

describe("intake registration ACK", () => {
  it("does not claim a move that registration never performed", () => {
    const ack = runAck(brokerResult("inserted"), plan("google_drive", "drive:1F8F2Uo"));

    expect(ack.accepted).toBe(true);
    expect(ack.processing_status).toBe("registered");
    // The file is still in 00_Inbox. Saying otherwise would misdescribe the
    // filesystem to every consumer downstream.
    expect(ack).not.toHaveProperty("next_location");
  });

  it("still gives the mailbox transport the destination it acts on", () => {
    for (const source of ["imap", "gmail", "mail"]) {
      const ack = runAck(brokerResult("inserted"), plan(source, "mail:msg-1"));

      expect(ack.next_location).toBe("00_Review");
      expect(ack.accepted).toBe(true);
    }
  });

  it("reports the identity the registry holds, not one the caller supplied", () => {
    const ack = runAck(brokerResult("inserted"), plan("google_drive", "drive:1F8F2Uo"));

    expect(ack.document_id).toBe(MINTED_ID);
    expect(ack.document_id).toMatch(/^[0-9a-f]{24}$/);
    // The old ACK named the provider locator here.
    expect(ack.document_id).not.toContain("drive:");
    // Which item this was is still reported — under its own name.
    expect(ack.source_ref).toBe("drive:1F8F2Uo");
  });

  it("returns the same identity on replay, and says the row was updated", () => {
    const first = runAck(brokerResult("inserted"), plan("google_drive", "drive:1F8F2Uo"));
    const replay = runAck(brokerResult("updated"), plan("google_drive", "drive:1F8F2Uo"));

    expect(replay.document_id).toBe(first.document_id);
    expect(replay.registry_outcome).toBe("updated");
    expect(replay.accepted).toBe(true);
  });

  it("refuses to acknowledge a write that did not produce an identity", () => {
    const ack = runAck(brokerResult("inserted", null), plan("google_drive", "drive:1F8F2Uo"));

    expect(ack.accepted).toBe(false);
    expect(ack.processing_status).toBe("rejected");
    expect(ack.error).toBe("registry_write_failed");
    expect(ack).not.toHaveProperty("next_location");
  });

  it("treats a transport-level 200 carrying a tool error as a failure", () => {
    const ack = runAck(
      JSON.stringify({ result: { isError: true, structuredContent: { outcome: "inserted" } } }),
      plan("google_drive", "drive:1F8F2Uo"),
    );

    expect(ack.accepted).toBe(false);
    expect(ack.processing_status).toBe("rejected");
  });

  it("rejects an outcome that is not an actual write", () => {
    for (const outcome of ["", "skipped", "noop"]) {
      expect(runAck(brokerResult(outcome), plan("imap", "mail:msg-1")).accepted).toBe(false);
    }
  });

  it("fails closed on a privacy state the preflight cannot route", () => {
    const ack = runAck(
      brokerResult("inserted"),
      JSON.stringify({
        key_value: "drive:1F8F2Uo",
        row: { privacy_status: "AI_ALLOWED", source_type: "google_drive" },
      }),
    );

    // No consent policy exists in V1; an unroutable state is never "accepted".
    expect(ack.accepted).toBe(false);
    expect(ack.processing_route).toBe("unresolved");
  });

  it("routes both supported privacy states to the privacy hold", () => {
    for (const status of ["NO_AI", "UNRESOLVED"]) {
      const ack = runAck(
        brokerResult("inserted"),
        JSON.stringify({
          key_value: "drive:1F8F2Uo",
          row: { privacy_status: status, source_type: "google_drive" },
        }),
      );

      expect(ack.processing_route).toBe("privacy_hold");
    }
  });

  it("survives malformed input instead of throwing inside the swarm", () => {
    for (const input of ["", "not json", "null", "{}"]) {
      const ack = runAck(input, plan("google_drive", "drive:1F8F2Uo"));

      expect(ack.accepted).toBe(false);
      expect(ack.processing_status).toBe("rejected");
    }
  });

  it("asks no model and reaches no network of its own", () => {
    expect(ACK_SOURCE).not.toMatch(/\bfetch\s*\(/);
    expect(ACK_SOURCE).not.toMatch(/\brequire\s*\(/);
    expect(ACK_SOURCE).not.toMatch(/\bprompt\b/i);
  });
});
