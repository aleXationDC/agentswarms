// POST /api/dms/intake — the native raw-document intake boundary (DMS-D1-0002 §3).
//
//   Authorization: Bearer <swarm API key, scope "dms_intake">
//   ?drive_file_id=...&drive_url=...&filename=...&mime_type=...
//   &parent_folder_ids=id1,id2&created_time=...&modified_time=...&declared_size=...
//   body: raw file bytes (n8n's HTTP node with sendBinaryData, NOT multipart)
//
// This is n8n's ONLY reach into AgentSwarms for D1 intake: n8n sends the
// original, unmodified bytes it downloaded from Drive plus Drive's own
// metadata, and every architectural step from here on — hashing, extraction,
// entity resolution, the Privacy Firewall, the registry, invoking the
// Document Intake Swarm — happens inside AgentSwarms (src/lib/dmsIntake.server.ts).
// n8n never sees a document_id, a content_hash, or extracted text.
//
// Auth/rate-limit/budget/upload-bound reuse the exact patterns already
// proven by /api/swarm/run (swarm_api_keys, per-key rate limit + concurrency
// slot, budget gate) and /api/data/upload (Content-Length pre-check before
// reading the body), per the task's explicit instruction to reuse rather than
// invent a new mechanism.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sha256Hex } from "@/utils/swarmDeploy.functions";
import { resolveDeployedGraph } from "@/lib/swarmPublish";
import { resolveInternalOrigin } from "@/utils/internalOrigin.server";
import { acquireSlotGlobal, envInt, rateLimitedGlobal } from "@/utils/rateLimit.server";
import { auditEvent } from "@/utils/audit.server";
import { clientIp, clientUserAgent } from "@/utils/requestMeta.server";
import { budgetMessage, getBudgetDecision } from "@/utils/budgetGuard.server";
import { uploadMaxBytes } from "@/utils/data/ingest.server";
import { processIntake, type DriveMetadata } from "@/lib/dmsIntake.server";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const Route = createFileRoute("/api/dms/intake")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const rawKey = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
        if (!rawKey) return json({ error: "Missing API key" }, 401);

        const keyHash = await sha256Hex(rawKey);
        const { data: key } = await supabaseAdmin
          .from("swarm_api_keys")
          .select("id, user_id, swarm_id, is_active, expires_at, scopes")
          .eq("key_hash", keyHash)
          .maybeSingle();
        if (!key) return json({ error: "Invalid or disabled API key" }, 401);

        const denyKey = (reason: string, message: string, status = 401) => {
          auditEvent({
            userId: key.user_id,
            action: "dms.intake.denied",
            resourceType: "swarm",
            resourceId: key.swarm_id,
            detail: {
              reason,
              key_id: key.id,
              ip: clientIp(request),
              user_agent: clientUserAgent(request),
            },
          });
          return json({ error: message }, status);
        };

        if (!key.is_active) return denyKey("key_disabled", "Invalid or disabled API key");
        if (key.expires_at && Date.parse(key.expires_at) <= Date.now()) {
          return denyKey("key_expired", "This API key has expired.", 403);
        }
        // Least privilege: a key must be scoped explicitly for intake. A
        // general "run" key is deliberately NOT accepted here — see the
        // migration widening scopes to include "dms_intake".
        const scopes = key.scopes ?? [];
        if (!scopes.includes("dms_intake")) {
          return denyKey(
            "missing_scope",
            "This API key is not allowed to submit documents for intake.",
            403,
          );
        }

        const bucket = `dms-intake:${key.id}`;
        if (await rateLimitedGlobal(bucket, envInt("DMS_INTAKE_RATE_LIMIT_PER_MIN", 20))) {
          return json({ error: "Rate limit exceeded — slow down and retry." }, 429);
        }
        const slot = await acquireSlotGlobal(
          bucket,
          envInt("DMS_INTAKE_MAX_CONCURRENT", 3),
          envInt("SWARM_RUN_TIMEOUT_MS", 600_000) / 1000 + 300,
        );
        if (!slot) {
          return json(
            { error: "Too many concurrent intakes for this key — retry when one finishes." },
            429,
          );
        }

        try {
          const budget = await getBudgetDecision(key.user_id, {
            type: "swarm_api_key",
            id: key.id,
          });
          if (budget.over) return json({ error: budgetMessage(budget) }, 402);

          const url = new URL(request.url);
          const q = (name: string) => url.searchParams.get(name) ?? "";
          const driveFileId = q("drive_file_id").trim();
          const filename = q("filename").trim().slice(0, 500);
          const mimeType = q("mime_type").trim() || "application/octet-stream";
          if (!driveFileId) return json({ error: "Missing drive_file_id" }, 400);
          if (!filename) return json({ error: "Missing filename" }, 400);

          // Reject an oversized upload from the declared length BEFORE reading
          // it, exactly like /api/data/upload — extraction is expensive and
          // must never be reached for a payload we would refuse anyway.
          const declared = Number(request.headers.get("Content-Length") ?? "");
          if (Number.isFinite(declared) && declared > uploadMaxBytes()) {
            return json(
              {
                error: `This file is larger than the ${(uploadMaxBytes() / (1024 * 1024)).toFixed(0)} MB intake limit.`,
              },
              413,
            );
          }
          if (!request.body) return json({ error: "Empty request body" }, 400);

          const bytes = new Uint8Array(await request.arrayBuffer());
          if (bytes.byteLength > uploadMaxBytes()) {
            return json(
              {
                error: `This file is larger than the ${(uploadMaxBytes() / (1024 * 1024)).toFixed(0)} MB intake limit.`,
              },
              413,
            );
          }

          const drive: DriveMetadata = {
            driveFileId,
            driveUrl: q("drive_url").trim() || null,
            filename,
            mimeType,
            parentFolderIds: q("parent_folder_ids")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            createdTime: q("created_time").trim() || null,
            modifiedTime: q("modified_time").trim() || null,
            size: bytes.byteLength,
          };

          const { data: swarm } = await supabaseAdmin
            .from("swarms")
            .select("id, name, nodes, edges, published_nodes, published_edges, published_at")
            .eq("id", key.swarm_id)
            .maybeSingle();
          if (!swarm) return json({ error: "Document Intake Swarm not found" }, 404);
          // Same "serve the published graph" guarantee as /api/swarm/run: a
          // canvas edit mid-flight cannot change what an in-flight intake run
          // does.
          const deployed = resolveDeployedGraph(swarm);
          const documentIntakeSwarm = {
            id: swarm.id,
            name: swarm.name,
            nodes: deployed.nodes,
            edges: deployed.edges,
          };

          const origin = resolveInternalOrigin();

          const result = await processIntake(supabaseAdmin, {
            userId: key.user_id,
            bytes,
            drive,
            origin,
            documentIntakeSwarm,
          });

          auditEvent({
            userId: key.user_id,
            action: "dms.intake.processed",
            resourceType: "document",
            resourceId: result.documentId,
            detail: { status: result.status, key_id: key.id },
          });

          if (result.status === "duplicate") {
            return json({
              documentId: result.documentId,
              status: "duplicate",
              reason: result.reason,
            });
          }
          if (result.status === "manual_review") {
            return json({
              documentId: result.documentId,
              status: "manual_review",
              reason: result.reason,
            });
          }
          if (result.runResult.status === "error") {
            return json(
              {
                documentId: result.documentId,
                status: "error",
                error: result.runResult.error,
                runId: result.runResult.runId,
              },
              502,
            );
          }
          return json({
            documentId: result.documentId,
            status: result.runResult.status, // "suspended" (awaiting Approval) or "completed"
            runId: result.runResult.runId,
          });
        } catch (e) {
          return json({ error: (e as Error).message }, 500);
        } finally {
          await slot.release();
        }
      },
    },
  },
});
