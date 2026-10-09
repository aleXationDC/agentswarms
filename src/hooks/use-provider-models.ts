// Live model catalogue for connected providers, fetched once per app session.
//
// Provider catalogues move — OpenRouter in particular adds and removes free
// models continuously — so a hard-coded list is wrong within weeks. This
// refreshes on app open instead: one call per provider, cached in memory for
// the session and mirrored to sessionStorage so a page navigation or reload
// doesn't re-fetch.
import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { listProviderModels, type ProviderModelInfo } from "@/utils/providerModels.functions";

const CACHE_PREFIX = "as:provider-models:";

/** Deduplicated per caller, provider and explicit gateway route. */
const inflight = new Map<string, Promise<ProviderModelInfo[]>>();
const memory = new Map<string, ProviderModelInfo[]>();

function readSession(key: string): ProviderModelInfo[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    return raw ? (JSON.parse(raw) as ProviderModelInfo[]) : null;
  } catch {
    return null;
  }
}

function writeSession(key: string, models: ProviderModelInfo[]): void {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(models));
  } catch {
    /* private mode / quota — the in-memory cache still works */
  }
}

/**
 * Fetch a provider's models, deduped across callers and cached for the session.
 *
 * Failed discovery is surfaced to the picker, not cached as a valid catalogue.
 */
export async function loadProviderModels(
  provider: string,
  opts: { force?: boolean; routeThroughGateway?: boolean } = {},
): Promise<ProviderModelInfo[]> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) throw new Error("Sign in to load provider models.");
  const key = `${provider}:${opts.routeThroughGateway ? "gateway" : "default"}:${session.user.id}`;
  if (!opts.force) {
    const mem = memory.get(key);
    if (mem) return mem;
    const cached = readSession(key);
    if (cached) {
      memory.set(key, cached);
      return cached;
    }
    const pending = inflight.get(key);
    if (pending) return pending;
  }

  const run = (async () => {
    try {
      const res = await listProviderModels({
        data: {
          access_token: session.access_token,
          provider,
          routeThroughGateway: opts.routeThroughGateway,
        },
      });
      if (!res.ok) throw new Error(res.error);
      const models = res.models;
      memory.set(key, models);
      writeSession(key, models);
      return models;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, run);
  return run;
}

/** Drop the cache so the next read re-fetches (after connecting a provider). */
export function invalidateProviderModels(provider?: string): void {
  if (provider) {
    for (const key of memory.keys()) {
      if (key.startsWith(`${provider}:`)) memory.delete(key);
    }
    try {
      for (const key of Object.keys(sessionStorage)) {
        if (key.startsWith(`${CACHE_PREFIX}${provider}:`)) sessionStorage.removeItem(key);
      }
    } catch {
      /* ignore */
    }
    return;
  }
  memory.clear();
  try {
    for (const k of Object.keys(sessionStorage)) {
      if (k.startsWith(CACHE_PREFIX)) sessionStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Warm the catalogue for every connected provider, once per app session.
 *
 * Called from the authenticated layout so pickers open with a current list
 * instead of fetching (or showing something stale) on first use. Providers
 * already cached are skipped, so this costs nothing after the first mount.
 */
export function usePrefetchProviderModels(): void {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from("integrations").select("provider, type, is_active");
      if (cancelled || !data) return;
      const providers = Array.from(
        new Set(
          data
            .filter(
              (r) =>
                r.is_active !== false &&
                (r.type === "llm_provider" || r.type === "llm" || r.type === null),
            )
            .map((r) => r.provider)
            .filter((p): p is string => Boolean(p)),
        ),
      );
      // Sequential, not parallel: this runs in the background behind whatever
      // the user is actually doing, and a burst of provider calls on every app
      // open is rude to both the browser and the providers.
      for (const p of providers) {
        if (cancelled) return;
        try {
          await loadProviderModels(p);
        } catch (error) {
          console.warn(
            "[models] Prefetch failed:",
            error instanceof Error ? error.message : "Discovery failed",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}

/** The live catalogue for one provider. `null` while the first load is in flight. */
export function useProviderModels(
  provider: string | null | undefined,
  routeThroughGateway = false,
): {
  models: ProviderModelInfo[] | null;
  free: ProviderModelInfo[];
  refresh: () => void;
  error: string | null;
} {
  const [models, setModels] = useState<ProviderModelInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (force = false) => {
      setModels(provider ? null : []);
      setError(null);
      if (!provider) {
        setModels([]);
        return;
      }
      let cancelled = false;
      void loadProviderModels(provider, { force, routeThroughGateway }).then(
        (m) => {
          if (!cancelled) setModels(m);
        },
        (e: unknown) => {
          if (!cancelled) {
            setModels([]);
            setError(e instanceof Error ? e.message : "Model discovery failed.");
          }
        },
      );
      return () => {
        cancelled = true;
      };
    },
    [provider, routeThroughGateway],
  );

  useEffect(() => load(), [load]);

  return {
    models,
    error,
    free: (models ?? []).filter((m) => m.free),
    refresh: () => {
      if (provider) invalidateProviderModels(provider);
      load(true);
    },
  };
}
