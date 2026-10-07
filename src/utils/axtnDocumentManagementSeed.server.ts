import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database, Json } from "@/integrations/supabase/types";
import { agentToNodePatch } from "@/lib/agentToSwarmNode";
import { toSnapshot } from "@/lib/agentVersions";
import { chunkText } from "@/lib/kbChunking";
import { canonicalJson } from "@/utils/provenance/canonicalJson";
import { publishSwarmForOwner } from "@/utils/swarmDeploy/operations.server";
import { resolveEmbedArgs } from "@/utils/tools/embedTarget.server";
import { embedAndStoreDocuments } from "@/utils/tools/embedding.server";
import {
  DMS_AGENT_DEFINITIONS,
  DMS_KB_CONTENT,
  DMS_KNOWLEDGE_BASE_ID,
  DMS_KNOWLEDGE_DOCUMENT_ID,
  DMS_RECONSTRUCTION_VERSION,
  DMS_SKILLS,
} from "../../axtn/swarms/axtn-document-management/reconstruction-v1.mjs";
import {
  CLEANUP_ID,
  CLEANUP_NAME,
  PARENT_ID,
  PARENT_NAME,
  PRIVACY_ID,
  PRIVACY_NAME,
  buildParentGraph,
  buildPrivacyGraph,
} from "../../axtn/swarms/axtn-document-management/graph.mjs";
import { buildCleanupGraph } from "../../axtn/swarms/axtn-blacklisted-file-cleanup/graph.mjs";
import { seedDocumentRegistries } from "../axtn/workbenches/documents/documentRegistries.server";
import { seedDocumentLocalTable } from "../axtn/workbenches/documents/documentLocalTableSeed.server";
import { seedAxtnDocumentCaseIntake } from "./axtnDocumentIntakeSeed.server";

type AgentInsert = Database["public"]["Tables"]["agents"]["Insert"];
type SwarmGraph = { nodes: unknown[]; edges: unknown[] };

const MEMORY_CONFIG = {
  stm_enabled: false,
  stm_window_messages: 12,
  stm_summarize: false,
  stm_summary_model: null,
  ltm_enabled: false,
  ltm_auto_extract: false,
  ltm_max_items: 100,
  ltm_recall_top_k: 5,
  chat_retention_days: 30,
};

const RETRIEVAL_SETTINGS = {
  mode: "hybrid",
  hybrid: { semanticWeight: 0.5 },
};

const DMS_GUARDRAILS = {
  blockPII: true,
  piiMode: "block",
  piiEntities: ["PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER", "LOCATION", "IBAN_CODE", "CREDIT_CARD"],
  piiApplyTo: "both",
  contentSafetyLevel: "high",
} as const;

function failOnError(error: { message: string; code?: string } | null, operation: string) {
  if (!error) return;
  throw new Error(`${operation}: ${error.code ?? "DATABASE_ERROR"}`);
}

function exact(actual: unknown, expected: unknown, code: string) {
  if (canonicalJson(actual) !== canonicalJson(expected)) throw new Error(code);
}

async function ensureSkill(userId: string, skill: (typeof DMS_SKILLS)[number]) {
  const { data, error } = await supabaseAdmin
    .from("agent_skills")
    .select("id, user_id, name, description, body, tags")
    .eq("id", skill.id)
    .maybeSingle();
  failOnError(error, "DMS_SKILL_READ");
  if (data) {
    if (data.user_id !== userId) throw new Error("DMS_SKILL_OWNER_CONFLICT");
    exact(
      { name: data.name, description: data.description, body: data.body, tags: data.tags },
      { name: skill.name, description: skill.description, body: skill.body, tags: skill.tags },
      "DMS_SKILL_DRIFT",
    );
    return;
  }
  const { data: sameName, error: nameError } = await supabaseAdmin
    .from("agent_skills")
    .select("id")
    .eq("user_id", userId)
    .eq("name", skill.name)
    .limit(1);
  failOnError(nameError, "DMS_SKILL_NAME_READ");
  if (sameName?.length) throw new Error("DMS_SKILL_NAME_CONFLICT");
  const result = await supabaseAdmin.from("agent_skills").insert({ ...skill, user_id: userId });
  failOnError(result.error, "DMS_SKILL_INSERT");
}

async function ensureKnowledgeBase(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("knowledge_bases")
    .select("id, user_id, name, description, is_sample, retrieval_settings")
    .eq("id", DMS_KNOWLEDGE_BASE_ID)
    .maybeSingle();
  failOnError(error, "DMS_KB_READ");
  const expected = {
    name: "aXtn DMS Contract - Reconstruction v1",
    description:
      "Owner-scoped, non-historical stage constraints recovered from the approved DMS graph contract.",
    is_sample: false,
    retrieval_settings: RETRIEVAL_SETTINGS,
  };
  if (data) {
    if (data.user_id !== userId) throw new Error("DMS_KB_OWNER_CONFLICT");
    exact(
      {
        name: data.name,
        description: data.description,
        is_sample: data.is_sample,
        retrieval_settings: data.retrieval_settings,
      },
      expected,
      "DMS_KB_DRIFT",
    );
  } else {
    const { data: sameName, error: nameError } = await supabaseAdmin
      .from("knowledge_bases")
      .select("id")
      .eq("user_id", userId)
      .eq("name", expected.name)
      .limit(1);
    failOnError(nameError, "DMS_KB_NAME_READ");
    if (sameName?.length) throw new Error("DMS_KB_NAME_CONFLICT");
    const inserted = await supabaseAdmin.from("knowledge_bases").insert({
      id: DMS_KNOWLEDGE_BASE_ID,
      user_id: userId,
      ...expected,
    });
    failOnError(inserted.error, "DMS_KB_INSERT");
  }

  const contentHash = createHash("sha256").update(DMS_KB_CONTENT).digest("hex");
  const baseMetadata = {
    source: "approved-dms-graph-contract",
    reconstructionVersion: DMS_RECONSTRUCTION_VERSION,
    chunk_strategy: "paragraph",
    chunk_size: 256,
    chunk_overlap: 0,
    chunk_mode: "flat",
  };
  const { data: document, error: documentError } = await supabaseAdmin
    .from("knowledge_documents")
    .select("id, user_id, knowledge_base_id, name, content, content_hash, is_sample, metadata")
    .eq("id", DMS_KNOWLEDGE_DOCUMENT_ID)
    .maybeSingle();
  failOnError(documentError, "DMS_KB_DOCUMENT_READ");
  const storedMetadata =
    document?.metadata && typeof document.metadata === "object" && !Array.isArray(document.metadata)
      ? (document.metadata as Record<string, unknown>)
      : null;
  const storedProvider =
    typeof storedMetadata?.embedding_provider === "string"
      ? storedMetadata.embedding_provider
      : undefined;
  const storedModel =
    typeof storedMetadata?.embedding_model === "string"
      ? storedMetadata.embedding_model
      : undefined;
  if (document && (!storedProvider || !storedModel))
    throw new Error("DMS_KB_EMBEDDING_PROVENANCE_REQUIRED");
  const embedArgs = await resolveEmbedArgs(userId, {
    provider: storedProvider,
    model: storedModel,
  });
  if (!embedArgs) throw new Error("DMS_KB_EMBED_PROVIDER_REQUIRED");
  const metadata = {
    ...baseMetadata,
    embedding_provider: embedArgs.stampProvider,
    embedding_model: embedArgs.defaults.model,
  };
  const expectedDocument = {
    knowledge_base_id: DMS_KNOWLEDGE_BASE_ID,
    name: "DMS bounded stage contract - Reconstruction v1",
    content: DMS_KB_CONTENT,
    content_hash: contentHash,
    is_sample: false,
    metadata,
  };
  if (document) {
    if (document.user_id !== userId) throw new Error("DMS_KB_DOCUMENT_OWNER_CONFLICT");
    exact(
      {
        knowledge_base_id: document.knowledge_base_id,
        name: document.name,
        content: document.content,
        content_hash: document.content_hash,
        is_sample: document.is_sample,
        metadata: document.metadata,
      },
      expectedDocument,
      "DMS_KB_DOCUMENT_DRIFT",
    );
  } else {
    const inserted = await supabaseAdmin.from("knowledge_documents").insert({
      id: DMS_KNOWLEDGE_DOCUMENT_ID,
      user_id: userId,
      ...expectedDocument,
    });
    failOnError(inserted.error, "DMS_KB_DOCUMENT_INSERT");
  }

  const { data: chunks, error: chunksError } = await supabaseAdmin
    .from("kb_chunks")
    .select("id, document_id, knowledge_base_id, user_id, is_sample, chunk_index")
    .eq("document_id", DMS_KNOWLEDGE_DOCUMENT_ID)
    .order("chunk_index", { ascending: true });
  failOnError(chunksError, "DMS_KB_CHUNKS_READ");
  if (chunks?.length) {
    if (
      chunks.some(
        (chunk) =>
          chunk.user_id !== userId ||
          chunk.knowledge_base_id !== DMS_KNOWLEDGE_BASE_ID ||
          chunk.is_sample ||
          chunk.document_id !== DMS_KNOWLEDGE_DOCUMENT_ID,
      )
    )
      throw new Error("DMS_KB_CHUNKS_CONFLICT");
    const { data: chunkContent, error: chunkContentError } = await supabaseAdmin
      .from("kb_chunks")
      .select("chunk_index, content, embedding")
      .eq("document_id", DMS_KNOWLEDGE_DOCUMENT_ID)
      .order("chunk_index", { ascending: true });
    failOnError(chunkContentError, "DMS_KB_CHUNK_CONTENT_READ");
    const expectedChunks = chunkText(DMS_KB_CONTENT, {
      strategy: "paragraph",
      chunkSize: 256,
      chunkOverlap: 0,
    });
    exact(
      chunkContent?.map(({ chunk_index, content }) => ({ chunk_index, content })),
      expectedChunks.map((content, chunk_index) => ({ chunk_index, content })),
      "DMS_KB_CHUNKS_DRIFT",
    );
    if (
      chunkContent?.some(
        (chunk) => typeof chunk.embedding !== "string" || !chunk.embedding.startsWith("["),
      )
    )
      throw new Error("DMS_KB_EMBEDDING_DRIFT");
    return;
  }

  const embedded = await embedAndStoreDocuments({
    sb: supabaseAdmin,
    docs: [
      {
        id: DMS_KNOWLEDGE_DOCUMENT_ID,
        knowledge_base_id: DMS_KNOWLEDGE_BASE_ID,
        user_id: userId,
        is_sample: false,
        content: DMS_KB_CONTENT,
        metadata: {
          ...metadata,
          embedding_provider: embedArgs.stampProvider,
          embedding_model: embedArgs.defaults.model,
        },
      },
    ],
    openaiKey: embedArgs.openaiKey,
    endpoint: embedArgs.endpoint,
    allowCustomModel: embedArgs.allowCustomModel,
    defaults: embedArgs.defaults,
    stampProvider: embedArgs.stampProvider,
    userId,
    surface: "aXtn DMS Reconstruction v1 Knowledge Base",
  });
  if (embedded.chunksInserted < 1) throw new Error("DMS_KB_EMBEDDING_REQUIRED");
}

function expectedAgent(userId: string, role: keyof typeof DMS_AGENT_DEFINITIONS): AgentInsert {
  const definition = DMS_AGENT_DEFINITIONS[role];
  return {
    id: definition.id,
    user_id: userId,
    name: definition.name,
    description: definition.description,
    system_prompt: definition.system_prompt,
    llm_provider: definition.llm_provider,
    llm_model: definition.llm_model,
    temperature: definition.temperature,
    max_tokens: definition.max_tokens,
    knowledge_base_id: DMS_KNOWLEDGE_BASE_ID,
    n8n_webhook_url: null,
    is_active: true,
    tools: {
      builtInTools: {},
      skillIds: [definition.skill_id],
      knowledgeBaseIds: [DMS_KNOWLEDGE_BASE_ID],
      toolConfigs: {},
      guardrails: DMS_GUARDRAILS,
    } as unknown as Json,
  };
}

async function ensureAgent(
  userId: string,
  role: keyof typeof DMS_AGENT_DEFINITIONS,
): Promise<{
  id: string;
  versionId: string;
  configHash: string;
  nodePatch: Record<string, unknown>;
}> {
  const expected = expectedAgent(userId, role);
  const { data: row, error } = await supabaseAdmin
    .from("agents")
    .select("*")
    .eq("id", expected.id!)
    .maybeSingle();
  failOnError(error, "DMS_AGENT_READ");
  let agent = row;
  if (agent) {
    if (agent.user_id !== userId) throw new Error("DMS_AGENT_OWNER_CONFLICT");
    if (!agent.is_active) throw new Error("DMS_AGENT_INACTIVE");
    exact(toSnapshot(agent), toSnapshot(expected), "DMS_AGENT_DRIFT");
  } else {
    const { data: sameName, error: nameError } = await supabaseAdmin
      .from("agents")
      .select("id")
      .eq("user_id", userId)
      .eq("name", expected.name!)
      .limit(1);
    failOnError(nameError, "DMS_AGENT_NAME_READ");
    if (sameName?.length) throw new Error("DMS_AGENT_NAME_CONFLICT");
    const inserted = await supabaseAdmin.from("agents").insert(expected).select("*").single();
    failOnError(inserted.error, "DMS_AGENT_INSERT");
    if (!inserted.data) throw new Error("DMS_AGENT_INSERT_EMPTY");
    agent = inserted.data;
  }

  const { data: memory, error: memoryError } = await supabaseAdmin
    .from("agent_memory_config")
    .select("*")
    .eq("agent_id", expected.id!)
    .maybeSingle();
  failOnError(memoryError, "DMS_AGENT_MEMORY_READ");
  if (memory) {
    if (memory.user_id !== userId) throw new Error("DMS_AGENT_MEMORY_OWNER_CONFLICT");
    exact(
      Object.fromEntries(
        Object.keys(MEMORY_CONFIG).map((key) => [key, memory[key as keyof typeof memory]]),
      ),
      MEMORY_CONFIG,
      "DMS_AGENT_MEMORY_DRIFT",
    );
  } else {
    const insertedMemory = await supabaseAdmin
      .from("agent_memory_config")
      .insert({ agent_id: expected.id!, user_id: userId, ...MEMORY_CONFIG });
    failOnError(insertedMemory.error, "DMS_AGENT_MEMORY_INSERT");
  }

  const configuration = toSnapshot(agent);
  const { data: versions, error: versionError } = await supabaseAdmin
    .from("agent_versions")
    .select("id, config, label, kind")
    .eq("agent_id", expected.id!)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  failOnError(versionError, "DMS_AGENT_VERSION_READ");
  let version = versions?.find(
    (candidate) =>
      canonicalJson(candidate.config) === canonicalJson(configuration) &&
      candidate.label === `DMS ${DMS_RECONSTRUCTION_VERSION}` &&
      candidate.kind === "manual",
  );
  if (!version) {
    if (versions?.length) throw new Error("DMS_AGENT_VERSION_DRIFT");
    const insertedVersion = await supabaseAdmin
      .from("agent_versions")
      .insert({
        agent_id: expected.id!,
        user_id: userId,
        label: `DMS ${DMS_RECONSTRUCTION_VERSION}`,
        kind: "manual",
        config: configuration as unknown as Json,
      })
      .select("id, config, label, kind")
      .single();
    failOnError(insertedVersion.error, "DMS_AGENT_VERSION_INSERT");
    if (!insertedVersion.data) throw new Error("DMS_AGENT_VERSION_INSERT_EMPTY");
    version = insertedVersion.data;
  }

  const { patch, dropped } = agentToNodePatch({
    ...agent,
    memory: {
      stm_enabled: memory?.stm_enabled ?? MEMORY_CONFIG.stm_enabled,
      stm_window_messages: memory?.stm_window_messages ?? MEMORY_CONFIG.stm_window_messages,
      ltm_enabled: memory?.ltm_enabled ?? MEMORY_CONFIG.ltm_enabled,
    },
  });
  if (dropped.length) throw new Error("DMS_AGENT_SNAPSHOT_HAS_UNREPRESENTABLE_SETTINGS");
  const digest = createHash("sha256")
    .update(canonicalJson({ configuration, memory: MEMORY_CONFIG }))
    .digest("hex");
  return {
    id: agent.id,
    versionId: version.id,
    configHash: digest,
    nodePatch: patch as Record<string, unknown>,
  };
}

async function ensurePublishedSwarm(
  userId: string,
  spec: { id: string; name: string; description: string; graph: SwarmGraph },
) {
  const { data: current, error } = await supabaseAdmin
    .from("swarms")
    .select("id, name, description, user_id, nodes, edges")
    .eq("id", spec.id)
    .maybeSingle();
  failOnError(error, "DMS_SWARM_READ");
  if (current) {
    if (current.user_id !== userId) throw new Error("DMS_SWARM_OWNER_CONFLICT");
    if (current.name !== spec.name || current.description !== spec.description)
      throw new Error("DMS_SWARM_METADATA_DRIFT");
    exact(current.nodes, spec.graph.nodes, "DMS_SWARM_NODES_DRIFT");
    exact(current.edges, spec.graph.edges, "DMS_SWARM_EDGES_DRIFT");
  } else {
    const { error: insertError } = await supabaseAdmin.from("swarms").insert({
      id: spec.id,
      user_id: userId,
      name: spec.name,
      description: spec.description,
      nodes: spec.graph.nodes as Json,
      edges: spec.graph.edges as Json,
    });
    failOnError(insertError, "DMS_SWARM_INSERT");
  }
  const published = await publishSwarmForOwner(spec.id, userId);
  if (!published.ok) throw new Error(`DMS_SWARM_PUBLISH_${published.error}`);
  const { data: readback, error: readbackError } = await supabaseAdmin
    .from("swarms")
    .select("published_version_id")
    .eq("id", spec.id)
    .eq("user_id", userId)
    .single();
  failOnError(readbackError, "DMS_SWARM_PUBLISH_READBACK");
  if (!readback?.published_version_id) throw new Error("DMS_SWARM_PUBLISHED_VERSION_REQUIRED");
  return { id: spec.id, published: true, versionId: readback.published_version_id };
}

export async function installAxtnDocumentManagement(userId: string) {
  const registry = await seedDocumentRegistries(userId);
  const localTable = await seedDocumentLocalTable(userId);
  const intake = await seedAxtnDocumentCaseIntake(userId);

  for (const skill of DMS_SKILLS) await ensureSkill(userId, skill);
  await ensureKnowledgeBase(userId);
  const [triage, processing] = await Promise.all([
    ensureAgent(userId, "triage"),
    ensureAgent(userId, "processing"),
  ]);

  const privacy = await ensurePublishedSwarm(userId, {
    id: PRIVACY_ID,
    name: PRIVACY_NAME,
    description:
      "Recovered native Privacy Preflight contract. Execution remains fail-closed until the separately approved local analyzer and protected privacy-evidence binding are active.",
    graph: buildPrivacyGraph(),
  });
  const cleanup = await ensurePublishedSwarm(userId, {
    id: CLEANUP_ID,
    name: CLEANUP_NAME,
    description:
      "Recovered native cleanup contract. No deletion occurs without explicit scoped selection and protected native Approval.",
    graph: buildCleanupGraph(),
  });
  const parentGraph = buildParentGraph({
    triage: {
      nodePatch: triage.nodePatch,
      agentSnapshot: {
        agentId: triage.id,
        versionId: triage.versionId,
        configHash: triage.configHash,
      },
    },
    processing: {
      nodePatch: processing.nodePatch,
      agentSnapshot: {
        agentId: processing.id,
        versionId: processing.versionId,
        configHash: processing.configHash,
      },
    },
  }) as SwarmGraph;
  const parent = await ensurePublishedSwarm(userId, {
    id: PARENT_ID,
    name: PARENT_NAME,
    description:
      "Native DMS composition with Reconstruction v1 Agent snapshots. No automatic Agent updates; external effects remain Approval- and provider-readback-gated.",
    graph: parentGraph,
  });

  return {
    version: DMS_RECONSTRUCTION_VERSION,
    registry,
    localTable,
    intake,
    skills: DMS_SKILLS.map(({ id, name }) => ({ id, name })),
    knowledgeBase: { id: DMS_KNOWLEDGE_BASE_ID, documentId: DMS_KNOWLEDGE_DOCUMENT_ID },
    agents: [
      { id: triage.id, versionId: triage.versionId, role: "triage" },
      { id: processing.id, versionId: processing.versionId, role: "processing" },
    ],
    swarms: [privacy, cleanup, parent],
    runtimeGates: [
      "The local Presidio privacy_preflight tool and protected source/rights/coverage evidence are not registered; UNRESOLVED input must fail closed.",
      "Native document Approval bindings and provider effect receipts remain separate gates; no filing or deletion was activated.",
    ],
  };
}
