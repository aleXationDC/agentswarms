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

/**
 * The swarm runtime treats a throw from a function node as a node failure, so
 * "does not register" and "throws" are the same statement here.
 */
function ackFailure(input: string, envelope: string): string {
  try {
    runAck(input, envelope);
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  throw new Error("expected the ACK node to fail the run, but it returned a value");
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
    const message = ackFailure(
      brokerResult("inserted", null),
      plan("google_drive", "drive:1F8F2Uo"),
    );

    expect(message).toContain("REGISTRY_WRITE_FAILED");
    expect(message).toContain("drive:1F8F2Uo");
  });

  it("treats a transport-level 200 carrying a tool error as a failure", () => {
    const message = ackFailure(
      JSON.stringify({ result: { isError: true, structuredContent: { outcome: "inserted" } } }),
      plan("google_drive", "drive:1F8F2Uo"),
    );

    expect(message).toContain("REGISTRY_WRITE_FAILED");
  });

  it("rejects an outcome that is not an actual write", () => {
    for (const outcome of ["", "skipped", "noop"]) {
      expect(ackFailure(brokerResult(outcome), plan("imap", "mail:msg-1"))).toContain(
        "REGISTRY_WRITE_FAILED",
      );
    }
  });

  it("fails closed on a privacy state the preflight cannot route", () => {
    const message = ackFailure(
      brokerResult("inserted"),
      JSON.stringify({
        key_value: "drive:1F8F2Uo",
        row: { privacy_status: "AI_ALLOWED", source_type: "google_drive" },
      }),
    );

    // No consent policy exists in V1; an unroutable state is never "accepted",
    // and it is a deterministic rejection rather than a retryable fault.
    expect(message).toContain("PRIVACY_ROUTE_UNRESOLVED");
    expect(message).not.toContain("REGISTRY_WRITE_FAILED");
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

  it("fails the run on malformed input rather than acknowledging it", () => {
    // DMS-LIVE-0004-A: this node used to swallow every failure into a returned
    // rejection object. The swarm then carried on into the native approval
    // gate, so an unregistered document produced a pending approval and the
    // ingress cached the deterministic Idempotency-Key as a completed success.
    // Failing the node is what makes the item retryable at all.
    for (const input of ["", "not json", "null", "{}"]) {
      expect(ackFailure(input, plan("google_drive", "drive:1F8F2Uo"))).toContain(
        "REGISTRY_WRITE_FAILED",
      );
    }
  });

  it("never reports an unproven write as a value the swarm can continue on", () => {
    // The whole failure surface of this node, in one statement: nothing that is
    // not a proven registry write may leave here as a normal return value.
    const unproven = [
      brokerResult("inserted", null),
      brokerResult("skipped"),
      JSON.stringify({ result: { isError: true } }),
      JSON.stringify({ error: { code: -32000, message: "MCP initialize failed: timeout" } }),
      "",
    ];

    for (const input of unproven) {
      expect(() => runAck(input, plan("google_drive", "drive:1F8F2Uo"))).toThrow();
    }
  });

  it("names the failing item and cause without leaking document content", () => {
    const message = ackFailure(
      JSON.stringify({ error: { code: -32000, message: "MCP initialize failed: timeout" } }),
      JSON.stringify({
        key_value: "drive:1F8F2Uo",
        row: {
          privacy_status: "NO_AI",
          source_type: "google_drive",
          extracted_text: "PATIENT DIAGNOSIS SECRET",
        },
      }),
    );

    // Enough to operate on: which item, which class, why.
    expect(message).toContain("REGISTRY_WRITE_FAILED");
    expect(message).toContain("source_ref=drive:1F8F2Uo");
    expect(message).toContain("MCP initialize failed: timeout");
    // Never the document itself.
    expect(message).not.toContain("PATIENT DIAGNOSIS SECRET");
  });

  it("still returns normally when the registry really did write", () => {
    // The failure path must not have swallowed the success path with it.
    const ack = runAck(brokerResult("inserted"), plan("google_drive", "drive:1F8F2Uo"));

    expect(ack.accepted).toBe(true);
    expect(ack.document_id).toBe(MINTED_ID);
  });

  it("asks no model and reaches no network of its own", () => {
    expect(ACK_SOURCE).not.toMatch(/\bfetch\s*\(/);
    expect(ACK_SOURCE).not.toMatch(/\brequire\s*\(/);
    expect(ACK_SOURCE).not.toMatch(/\bprompt\b/i);
  });
});
