-- Human Clarification Loop: durable record of what a rejection actually taught us.
--
-- AgentSwarms has no native facility for human corrections. Verified against
-- this installation: no migration creates a table matching feedback/rating/
-- correction/preference, `approvals` has no reason column, and the resume path
-- (swarmResume.functions.ts) carries only a boolean — `decision.note` exists in
-- the executor's type but nothing can supply it. LTM (`agent_memory_items`) is
-- the closest native store, but it is agent-scoped free text recalled by
-- keyword overlap, and it is switched OFF for headless swarm runs. So it can
-- hold the LESSON, but it cannot hold the CASE: which document, which run,
-- which proposal was rejected, which conversation clarified it.
--
-- This table is deliberately only that missing case record — the join between a
-- rejected proposal, the clarification conversation, and the agreed outcome.
-- Cognition, dialogue and recall stay native: the conversation lives in
-- `conversations`/`messages`, the generalised lesson goes to LTM / a knowledge
-- base, and the proposal itself is produced by a normal swarm run.
--
-- Naming note: this is a FEEDBACK EVENT, not "learning". A row here means the
-- correction was captured and is retrievable — nothing more. Promotion to a
-- trusted filing policy requires repeated evidence or explicit confirmation.

CREATE TABLE public.clarification_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What the case is about. `subject_key` is the stable identity of the thing
  -- being decided (for filing: "drive:<file_id>"), so repeated rejections of
  -- the SAME document join onto one case across many runs.
  subject_key TEXT NOT NULL,
  subject_kind TEXT NOT NULL DEFAULT 'document',

  -- Native objects this case is bound to. No FK on swarm_run_id: a run may be
  -- pruned by retention while the lesson stays valid.
  swarm_id UUID REFERENCES public.swarms(id) ON DELETE SET NULL,
  latest_swarm_run_id UUID,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,

  -- The deterministic envelope. Identity fields are never re-derived from an
  -- LLM answer, so keeping the original here makes the case self-contained.
  envelope JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Every proposal this subject has produced, oldest first. Each entry:
  -- { cycle, proposal, approval_id, decision, rejected_at }.
  proposals JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- What the dialogue established, once the agent declares consensus:
  -- primary_context, organization, document_family, topic, filing_preference,
  -- rejected_assumption, accepted_alternative, generalized_principle,
  -- human_confirmed_generalization.
  learned_signals JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Loop safety. Counts PROPOSAL cycles, never conversation turns: the human
  -- may need many messages to explain themselves, and throttling that would
  -- defeat the point of the clarification loop.
  cycle_count INTEGER NOT NULL DEFAULT 1,

  -- open        → awaiting a decision on the current proposal
  -- clarifying  → rejected; dialogue in progress
  -- consensus   → agent declared consensus; revised proposal may be generated
  -- resolved    → a proposal was approved
  -- abandoned   → cycle limit hit; needs manual handling, no mutation
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'clarifying', 'consensus', 'resolved', 'abandoned')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One live case per subject per user; a new document decision reopens rather
-- than duplicating, which is what makes cycle_count meaningful.
CREATE UNIQUE INDEX clarification_cases_subject_uniq
  ON public.clarification_cases (user_id, subject_key);

CREATE INDEX clarification_cases_status_idx
  ON public.clarification_cases (user_id, status);

CREATE INDEX clarification_cases_conversation_idx
  ON public.clarification_cases (conversation_id);

ALTER TABLE public.clarification_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own clarification cases"
  ON public.clarification_cases FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_clarification_cases_updated_at
  BEFORE UPDATE ON public.clarification_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Rejection reason capture. The approval card is where a human is already
-- standing when they disagree; making them go elsewhere to explain guarantees
-- the explanation is lost. Nullable and additive: existing approvals and the
-- existing resume path are unaffected.
ALTER TABLE public.approvals
  ADD COLUMN IF NOT EXISTS decision_note TEXT;
