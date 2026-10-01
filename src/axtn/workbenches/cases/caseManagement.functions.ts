import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { CASE_STATUSES, type CaseDraft, type CaseStatus } from "./caseContract";

export type CaseRecord = CaseDraft & {
  case_id: string;
  case_type: string;
  status: CaseStatus;
  status_reason: string | null;
  priority: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};
export type AccountRecord = { account_id: string; name: string; account_type: string | null };
export type ContactRecord = {
  contact_id: string;
  name: string;
  email: string | null;
  account_id: string | null;
};
export type CaseRelation = {
  relation_id: string;
  case_id: string;
  relation_type: string;
  target_id: string;
  target_kind: "document" | "contact" | "account" | "case";
};

const AccessInput = z.object({ access_token: z.string().min(1) });
const CaseInput = AccessInput.extend({
  subject: z.string().min(1).max(500),
  parent_case_id: z.string().uuid().nullable().optional(),
  case_type: z.string().min(1).max(80).optional(),
  status: z.enum(CASE_STATUSES).optional(),
  status_reason: z.string().max(500).nullable().optional(),
  priority: z.number().int().min(0).max(3).optional(),
  due_date: z.string().nullable().optional(),
  follow_up: z.string().nullable().optional(),
  account_id: z.string().uuid().nullable().optional(),
  primary_contact_id: z.string().uuid().nullable().optional(),
  related_entity: z.string().max(500).nullable().optional(),
  actor: z.enum(["human", "automation"]).optional(),
});
const CaseUpdateInput = CaseInput.extend({
  case_id: z.string().uuid(),
  relevant_activity: z.boolean().optional(),
});

async function requireUser(accessToken: string) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Server is missing Supabase configuration.");
  const sb = createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data, error } = await sb.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Unauthorized");
  return data.user.id;
}

export const listCaseManagement = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AccessInput.parse(input))
  .handler(async ({ data }) => {
    const userId = await requireUser(data.access_token);
    const { listCaseManagementData } = await import("./caseManagement.server");
    return listCaseManagementData(userId);
  });

export const createCase = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CaseInput.parse(input))
  .handler(async ({ data }) => {
    const userId = await requireUser(data.access_token);
    const { createCaseForUser } = await import("./caseManagement.server");
    return createCaseForUser(userId, data);
  });

export const assignDocumentToCase = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    AccessInput.extend({ case_id: z.string().uuid(), document_id: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const userId = await requireUser(data.access_token);
    const { assignDocument } = await import("./caseManagement.server");
    return assignDocument(userId, data.case_id, data.document_id);
  });

export const createCaseRelation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    AccessInput.extend({
      case_id: z.string().uuid(),
      target_kind: z.enum(["case", "account", "contact"]),
      target_id: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const userId = await requireUser(data.access_token);
    const { createCaseRelationForUser } = await import("./caseManagement.server");
    return createCaseRelationForUser(userId, data.case_id, data.target_kind, data.target_id);
  });

export const updateCase = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CaseUpdateInput.parse(input))
  .handler(async ({ data }) => {
    const userId = await requireUser(data.access_token);
    const { updateCaseForUser } = await import("./caseManagement.server");
    return updateCaseForUser(userId, data);
  });

export const createAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    AccessInput.extend({
      name: z.string().min(1).max(300),
      account_type: z.string().max(80).nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const userId = await requireUser(data.access_token);
    const { createAccountForUser } = await import("./caseManagement.server");
    return createAccountForUser(userId, data.name, data.account_type ?? null);
  });

export const createContact = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    AccessInput.extend({
      name: z.string().min(1).max(300),
      email: z.string().email().nullable().optional(),
      account_id: z.string().uuid().nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const userId = await requireUser(data.access_token);
    const { createContactForUser } = await import("./caseManagement.server");
    return createContactForUser(userId, data.name, data.email ?? null, data.account_id ?? null);
  });
