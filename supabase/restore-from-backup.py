#!/usr/bin/env python3
"""Genera restore.sql a partir de un backup.json de Garra (ver supabase/RESTORE.md).
Uso: python3 supabase/restore-from-backup.py backup.json > restore.sql
"""
import json, sys

b = json.load(open(sys.argv[1]))
assert "$garra$" not in json.dumps(b)
names = [t["name"] for t in b["tables"]]
out = ["set session_replication_role = replica;  -- sin FKs ni triggers durante la carga"]
out.append("truncate " + ", ".join(f"public.{n}" for n in names) + " cascade;")
# Usuarios de marcador para que los user_id existan (los reales se recrean con Supabase Auth).
out.append(f"""insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', (u->>'id')::uuid, 'authenticated', 'authenticated', 'restore+' || left(u->>'id', 8) || '@example.invalid', (u->>'created_at')::timestamptz, now(), '{{}}'::jsonb, '{{"restore_placeholder":true}}'::jsonb
from json_array_elements($garra${json.dumps(b['auth_users'])}$garra$::json) u
on conflict (id) do nothing;""")
for t in b["tables"]:
    if t["row_count"]:
        out.append(f"insert into public.{t['name']} overriding system value select * from json_populate_recordset(null::public.{t['name']}, $garra${json.dumps(t['rows'], ensure_ascii=False)}$garra$::json);")
out.append("""do $$ declare r record; begin
  for r in select table_name, column_name from information_schema.columns where table_schema='public' and is_identity='YES' loop
    execute format('select setval(pg_get_serial_sequence(%L, %L), coalesce((select max(%I) from public.%I), 0) + 1, false)', 'public.'||r.table_name, r.column_name, r.column_name, r.table_name);
  end loop; end $$;
set session_replication_role = origin;""")
print("\n".join(out))
