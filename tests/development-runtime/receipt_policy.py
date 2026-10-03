"""Native database-role policy proof; all candidate schema and fixture writes rollback."""
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[2]
psql = ["docker", "exec", "-i", "axtn-native-supabase-db", "psql", "-X",
        "-U", "postgres", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1"]
fingerprint = """
SELECT jsonb_build_object(
 'sessions',(SELECT count(*) FROM public.notebook_runtime_sessions),
 'grants',(SELECT count(*) FROM public.notebook_runtime_grants),
 'ledger',(SELECT count(*) FROM axtn_host.migration_ledger),
 'settings',(SELECT md5(row_to_json(s)::text) FROM public.notebook_runtime_settings s),
 'rows',(SELECT md5(coalesce(string_agg(row_to_json(s)::text,'' ORDER BY id),''))
         FROM public.notebook_runtime_sessions s),
 'guard',(SELECT count(*) FROM pg_trigger
          WHERE tgname='protect_development_runtime_receipts'));
"""
def run(sql):
    result = subprocess.run(psql, input=sql, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError("Native receipt policy SQL failed: " + result.stderr.strip())
    return result.stdout.strip()

before = json.loads(run(fingerprint))
migration = "" if before["guard"] else (
    root / "supabase/migrations/20260929020000_development_runtime.sql").read_text()
fixture = (Path(__file__).with_name("receipt-policy.sql")).read_text()
run("BEGIN;\n" + migration + "\n" + fixture + "\nROLLBACK;\n")
after = json.loads(run(fingerprint))
if after != before:
    raise RuntimeError("Native receipt policy transaction changed persistent state")
print("PASS: duplicate identity, four authenticated write denials, forged role denial, "
      "real service-role receipt write; schema/settings/grants/sessions/ledger unchanged")
