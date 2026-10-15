-- Fingerprint of the approval surface. Run before and after the migration and diff the output:
-- only guard_axtn_work_approval may differ.
SELECT 'function ' || p.oid::regprocedure::text || ' ' || md5(pg_get_functiondef(p.oid))
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind <> 'a'
UNION ALL
SELECT 'trigger ' || c.relname || '.' || t.tgname || ' ' || md5(pg_get_triggerdef(t.oid))
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal AND n.nspname = 'public'
UNION ALL
SELECT 'policy ' || tablename || '.' || policyname || ' ' ||
  md5(cmd || coalesce(roles::text, '') || coalesce(qual, '') || coalesce(with_check, ''))
FROM pg_policies WHERE schemaname = 'public'
UNION ALL
SELECT 'grant ' || p.oid::regprocedure::text || ' ' || md5(coalesce(p.proacl::text, ''))
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'
ORDER BY 1;
