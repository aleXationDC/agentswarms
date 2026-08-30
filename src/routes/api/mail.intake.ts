// POST /api/mail/intake — the native AgentSwarms Mail Intake boundary (DMS-D1-0003 §5, §13).
//
// Scoped API Key: "dms_intake".
// Actions:
//   1. action=discover (or default binary POST with ?action=discover):
//      Takes raw RFC822 bytes and IMAP metadata. Computes mail_id, parses MIME locally,
//      writes mechanical mail_registry row, returns attachment manifest for Drive staging.
//   2. action=stage_readback (JSON):
//      Takes Drive readback facts for .eml and attachments, records Drive provenance,
//      registers attachments in document_registry, and verifies staging readiness.
//   3. action=review_readback (JSON):
//      Takes new IMAP locator under 00_aleXation/00_Review.
//   4. action=process_semantic (JSON or Binary with ?action=process_semantic):
//      Runs local Entity Resolution, Privacy Firewall, attachment proposal analysis,
//      produces coherent proposal, and creates single parent Human Approval.
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
import {
  processMailDiscovery,
  processMailStagingReadback,
  processMailReviewReadback,
  processMailSemantic,
  type DriveReadbackItem,
} from "@/lib/mailIntake.server";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const Route = createFileRoute("/api/mail/intake")({
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
            action: "mail.intake.denied",
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
        const scopes = key.scopes ?? [];
        if (!scopes.includes("dms_intake")) {
          return denyKey(
            "missing_scope",
            "This API key is not allowed to submit mail for intake.",
            403,
          );
        }

        const bucket = `mail-intake:${key.id}`;
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
          const action = q("action") || "discover";
          const mailAccountId = q("mail_account_id") || "primary";

          // Action: stage_readback (JSON)
          if (action === "stage_readback") {
            const bodyJson = await request.json() as {
              mail_id: string;
              drive_eml: DriveReadbackItem;
              drive_attachments?: Array<DriveReadbackItem & { attachmentIndex: number; mimeType?: string }>;
            };
            if (!bodyJson?.mail_id || !bodyJson?.drive_eml) {
              return json({ error: "Missing mail_id or drive_eml in stage_readback" }, 400);
            }
            const res = await processMailStagingReadback(supabaseAdmin, {
              userId: key.user_id,
              mailId: bodyJson.mail_id,
              driveEml: bodyJson.drive_eml,
              driveAttachments: bodyJson.drive_attachments,
            });
            return json(res);
          }

          // Action: review_readback (JSON)
          if (action === "review_readback") {
            const bodyJson = await request.json() as {
              mail_id: string;
              review_mailbox_path?: string;
              review_uid: string;
              review_uidvalidity?: string;
            };
            if (!bodyJson?.mail_id || !bodyJson?.review_uid) {
              return json({ error: "Missing mail_id or review_uid in review_readback" }, 400);
            }
            const res = await processMailReviewReadback(supabaseAdmin, {
              userId: key.user_id,
              mailId: bodyJson.mail_id,
              reviewMailboxPath: bodyJson.review_mailbox_path,
              reviewUid: bodyJson.review_uid,
              reviewUidValidity: bodyJson.review_uidvalidity,
            });
            return json(res);
          }

          // Action: process_semantic (Binary or JSON with raw_base64)
          if (action === "process_semantic") {
            const mailId = q("mail_id");
            if (!mailId) return json({ error: "Missing mail_id" }, 400);

            let rawBytes: Uint8Array;
            const contentType = request.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
              const bodyJson = await request.json() as { raw_base64?: string };
              if (!bodyJson?.raw_base64) return json({ error: "Missing raw_base64 in JSON payload" }, 400);
              rawBytes = new Uint8Array(Buffer.from(bodyJson.raw_base64, "base64"));
            } else {
              rawBytes = new Uint8Array(await request.arrayBuffer());
            }

            let mailIntakeSwarm = undefined;
            if (key.swarm_id) {
              const { data: swarm } = await supabaseAdmin
                .from("swarms")
                .select("id, name, nodes, edges, published_nodes, published_edges, published_at")
                .eq("id", key.swarm_id)
                .maybeSingle();
              if (swarm) {
                const deployed = resolveDeployedGraph(swarm);
                mailIntakeSwarm = {
                  id: swarm.id,
                  name: swarm.name,
                  nodes: deployed.nodes,
                  edges: deployed.edges,
                };
              }
            }

            const origin = resolveInternalOrigin();
            const res = await processMailSemantic(supabaseAdmin, {
              userId: key.user_id,
              mailId,
              rawBytes,
              mailAccountId,
              origin,
              mailIntakeSwarm,
            });

            return json(res, res.status === "privacy_error" ? 502 : 200);
          }

          // Default action: discover (binary RFC822)
          const sourceMailboxPath = q("source_mailbox_path") || "00_aleXation/00_Import";
          const sourceUid = q("source_uid") || "0";
          const sourceUidValidity = q("source_uidvalidity") || "0";

          const declared = Number(request.headers.get("Content-Length") ?? "");
          if (Number.isFinite(declared) && declared > uploadMaxBytes()) {
            return json(
              {
                error: `This message is larger than the ${(uploadMaxBytes() / (1024 * 1024)).toFixed(0)} MB intake limit.`,
              },
              413,
            );
          }
          if (!request.body) return json({ error: "Empty request body" }, 400);

          const bytes = new Uint8Array(await request.arrayBuffer());
          if (bytes.byteLength > uploadMaxBytes()) {
            return json(
              {
                error: `This message is larger than the ${(uploadMaxBytes() / (1024 * 1024)).toFixed(0)} MB intake limit.`,
              },
              413,
            );
          }

          const result = await processMailDiscovery(supabaseAdmin, {
            userId: key.user_id,
            bytes,
            mailAccountId,
            sourceMailboxPath,
            sourceUid,
            sourceUidValidity,
          });

          auditEvent({
            userId: key.user_id,
            action: "mail.intake.discovered",
            resourceType: "mail",
            resourceId: result.mailId,
            detail: { status: result.status, key_id: key.id },
          });

          return json(result);
        } catch (e) {
          return json({ error: (e as Error).message }, 500);
        } finally {
          await slot.release();
        }
      },
    },
  },
});
