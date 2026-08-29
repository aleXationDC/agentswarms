// Auto-close activity heartbeat for the Maintenance Gate (System Extensions
// → Maintenance Access). Deliberately narrow:
//
//   - Only runs when the page was loaded from the Maintenance Path itself
//     (checked via window.location matching the configured maintenance_path
//     origin, fetched once per mount) — a Tailscale/ops.alexation.com
//     session never counts as "maintenance activity".
//   - Only counts REAL user input (pointerdown/keydown), not every render,
//     not fetch/XHR, not background polling by the browser or by other
//     open tabs — this is what makes it robust against Gitea/n8n/browser
//     prefetch keeping Maintenance artificially open (see task requirement:
//     "Nicht jeden beliebigen HTTP-Request als Aktivität werten").
//   - Debounced to at most one heartbeat call per 60s of continued activity,
//     and only while document.hasFocus() — a backgrounded/inactive tab does
//     not keep extending the session.
//   - The actual 30-minute close decision is enforced server-side by the
//     native pg_cron job `auto-close-maintenance`
//     (see supabase/migrations/20260837000000_human_access_system_extensions.sql);
//     this hook only ever *extends* last_activity_at, it never opens or
//     closes Maintenance itself. Fail-closed: if this hook never fires
//     (e.g. JS blocked), Maintenance still auto-closes on schedule.
import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";

import { useAuth } from "@/hooks/use-auth";
import { sysExtTouchActivity } from "@/utils/systemExtensions.functions";

const HEARTBEAT_MIN_INTERVAL_MS = 60_000;

export function useMaintenanceActivityHeartbeat() {
  const { session } = useAuth();
  const touchFn = useServerFn(sysExtTouchActivity);
  const lastSentRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = session?.access_token;
    if (!token) return;

    // Fetch the configured Maintenance Path once and compare against the
    // current origin — never hardcode a domain here. If it can't be
    // determined (offline, not superadmin, etc.) we simply never send a
    // heartbeat, which is the fail-closed default.
    let cancelled = false;
    let onMaintenanceOrigin = false;

    fetch("/api/system-extensions/maintenance-path-check")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { isMaintenanceOrigin?: boolean } | null) => {
        if (!cancelled && data) onMaintenanceOrigin = !!data.isMaintenanceOrigin;
      })
      .catch(() => {
        onMaintenanceOrigin = false;
      });

    const maybeSend = () => {
      if (!onMaintenanceOrigin) return;
      if (!document.hasFocus()) return;
      const now = Date.now();
      if (now - lastSentRef.current < HEARTBEAT_MIN_INTERVAL_MS) return;
      lastSentRef.current = now;
      touchFn({ data: { access_token: token } }).catch(() => {
        // Best-effort: a failed heartbeat just means the session ages out
        // slightly earlier than 30 minutes; it never opens/extends anything
        // incorrectly.
      });
    };

    window.addEventListener("pointerdown", maybeSend, { passive: true });
    window.addEventListener("keydown", maybeSend, { passive: true });

    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", maybeSend);
      window.removeEventListener("keydown", maybeSend);
    };
  }, [session?.access_token, touchFn]);
}
