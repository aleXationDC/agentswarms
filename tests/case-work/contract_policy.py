"""Replay additive native Case policy in one entirely rolled-back transaction."""
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[2]
psql = ["docker", "exec", "-i", "axtn-native-supabase-db", "psql",
        "-X", "-U", "postgres", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1"]
fingerprint = """
SELECT jsonb_build_object(
 'ledger',(SELECT count(*) FROM axtn_host.migration_ledger),
 'cases',(SELECT md5(coalesce(string_agg(row_to_json(r)::text,'' ORDER BY r.id),'')) FROM user_data_rows r),
 'datasets',(SELECT md5(coalesce(string_agg(row_to_json(t)::text,'' ORDER BY t.id),'')) FROM user_data_tables t),
 'events',(SELECT md5(coalesce(string_agg(row_to_json(a)::text,'' ORDER BY a.id),'')) FROM audit_events a),
 'sessions',(SELECT md5(coalesce(string_agg(row_to_json(s)::text,'' ORDER BY s.id),'')) FROM notebook_runtime_sessions s),
 'grants',(SELECT md5(coalesce(string_agg(row_to_json(g)::text,'' ORDER BY g.id),'')) FROM notebook_runtime_grants g),
 'approvals',(SELECT md5(coalesce(string_agg(row_to_json(a)::text,'' ORDER BY a.id),'')) FROM approvals a),
 'runs',(SELECT md5(coalesce(string_agg(row_to_json(r)::text,'' ORDER BY r.id),'')) FROM swarm_runs r),
 'schema',(SELECT count(*) FROM pg_trigger WHERE tgname LIKE 'guard_axtn_work_%'));
"""
def run(sql):
    result = subprocess.run(psql, input=sql, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError("Native Case policy failed: " + result.stderr.strip())
    return result.stdout.strip()

before = json.loads(run(fingerprint))
migration = "" if before["schema"] else (
    root / "supabase/migrations/20260929030000_axtn_work_contract.sql").read_text()
fixture = Path(__file__).with_name("contract-policy.sql").read_text()
run("BEGIN;\n" + migration + "\n" + fixture + "\nROLLBACK;\n")
after = json.loads(run(fingerprint))
if after != before:
    raise RuntimeError("Case policy replay changed persistent state")
print("PASS: real native Case storage/event/role boundaries, dependencies, lifecycle, "
      "replay/conflicts, promotion and native approval; all fixture/schema writes rolled back")
