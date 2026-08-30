// DocumentsAnalyst — embedded AI Analyst for the Documents Workbench.
//
// Scoped strictly to canonical documents and related entities/domains/mail datasets:
//   - document_registry
//   - entity_resolution
//   - domain_registry
//   - mail_registry
//
// Zero silent mutations: queries only, transparent step trace (Plan, Query, Check, Synthesize).
// DMS-D1-0005-DOCUMENTS-v2 §14
import { useState, useCallback, useEffect } from "react";
import { clickable } from "@/lib/clickable";
import {
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  Loader2,
  Send,
  Sparkles,
  Search,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MarkdownMessage } from "@/components/playground/MarkdownMessage";
import {
  runAnalystTurn,
  trimTurnForStorage,
  type AnalystTurn,
} from "@/lib/aiAnalyst";
import {
  hydrateFromSupabase,
  runQuery,
  type DatasetMeta,
} from "@/lib/sqlEngine";

const SCOPED_TABLE_NAMES = [
  "document_registry",
  "entity_resolution",
  "domain_registry",
  "mail_registry",
];

const SUGGESTIONS = [
  "How many documents are classified under each PARA class?",
  "List the 5 most recent documents with their type and organization.",
  "Which entities or issuers appear most frequently in the archive?",
  "Are there any documents with low classification confidence (< 80%)?",
];

export function DocumentsAnalyst() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [datasets, setDatasets] = useState<DatasetMeta[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [turn, setTurn] = useState<AnalystTurn | null>(null);
  const [liveTurn, setLiveTurn] = useState<AnalystTurn | null>(null);

  // Load and scope datasets
  useEffect(() => {
    if (!user?.id) return;
    setLoadingDatasets(true);
    hydrateFromSupabase()
      .then((tables) => {
        const scoped = tables.filter((t) =>
          SCOPED_TABLE_NAMES.includes(t.name.toLowerCase()),
        );
        setDatasets(scoped);
      })
      .catch((err) => {
        console.warn("[DocumentsAnalyst] failed to hydrate datasets:", err);
      })
      .finally(() => setLoadingDatasets(false));
  }, [user?.id]);

  const onAsk = useCallback(
    async (qText: string) => {
      const q = qText.trim();
      if (!q || busy || datasets.length === 0) return;

      setBusy(true);
      setQuestion("");
      setLiveTurn(null);

      try {
        const result = await runAnalystTurn({
          question: q,
          datasets,
          semantics: new Map(),
          metrics: [],
          priorTurns: turn ? [trimTurnForStorage(turn)] : [],
          model: "gemini-3.7-flash",
          execute: runQuery,
          dialect: "duckdb",
          onUpdate: setLiveTurn,
        });
        setTurn(result);
      } catch (e) {
        console.error("[DocumentsAnalyst] query failed:", e);
      } finally {
        setBusy(false);
        setLiveTurn(null);
      }
    },
    [busy, datasets, turn],
  );

  const activeTurn = liveTurn ?? turn;

  return (
    <Card className="border border-primary/20 bg-gradient-to-r from-primary/5 via-background to-primary/5 overflow-hidden">
      {/* Header Bar */}
      <div
        className="p-3.5 flex items-center justify-between cursor-pointer select-none"
        {...clickable(() => setIsOpen(!isOpen), "Toggle AI Analyst")}
      >
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center text-primary">
            <BrainCircuit className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight">AI Analyst</span>
              <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                document_registry scope
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Ask questions about your documents, entities, dates and filing distribution
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {/* Expanded Surface */}
      {isOpen && (
        <div className="px-3.5 pb-3.5 pt-1 space-y-3 border-t border-border/50">
          {/* Suggestion Chips */}
          {!activeTurn && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {SUGGESTIONS.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuestion(s);
                    onAsk(s);
                  }}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-left"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Active / Previous Turn Trace */}
          {activeTurn && (
            <div className="space-y-2.5 bg-background/80 rounded-lg p-3 border text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-primary">Q: {activeTurn.question}</p>
                {busy && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin" /> Analyzing…
                  </span>
                )}
              </div>

              {/* Approach & Steps */}
              {activeTurn.steps && activeTurn.steps.length > 0 && (
                <div className="space-y-1.5 text-xs text-muted-foreground border-l-2 border-primary/40 pl-2.5 py-0.5">
                  {activeTurn.steps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 font-mono">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                      <span>Step {idx + 1}: {step.goal}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Synthesized Answer */}
              {activeTurn.answer && (
                <div className="pt-1 text-sm">
                  <MarkdownMessage content={activeTurn.answer} />
                </div>
              )}
            </div>
          )}

          {/* Input Bar */}
          <div className="flex gap-2">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onAsk(question)}
              placeholder="Ask AI Analyst (e.g. 'Show total documents grouped by primary domain')…"
              className="h-8 text-sm"
              disabled={busy}
            />
            <Button
              size="sm"
              disabled={busy || !question.trim() || datasets.length === 0}
              onClick={() => onAsk(question)}
              className="gap-1 h-8 px-3"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Ask
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
