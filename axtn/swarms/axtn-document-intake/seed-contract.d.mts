type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

interface SwarmSeed {
  id: string;
  user_id: string;
  name: string;
  description: string;
  nodes: Json;
  edges: Json;
}

interface SwarmRow extends Omit<SwarmSeed, "description"> {
  published_nodes: Json | null;
  published_edges: Json | null;
}

interface Store {
  get(id: string): Promise<SwarmRow | null>;
  insert(row: SwarmSeed): Promise<SwarmRow>;
  updateDraft(id: string, nodes: Json, edges?: Json): Promise<void>;
}

type Publish = (id: string, userId: string) => Promise<void>;

export function seedDocumentIntake(input: {
  userId: string;
  store: Store;
  publish: Publish;
}): Promise<{ created: boolean; published: boolean }>;

export function applyDocumentIntake(input: {
  userId: string;
  store: Store;
  publish: Publish;
}): Promise<{ changed: boolean; published: boolean }>;
export function seedDocumentCaseIntake(input: {
  userId: string;
  store: Store;
  publish: Publish;
}): Promise<{ created: boolean; changed: boolean; published: boolean }>;
