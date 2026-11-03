with tabs as (
  select c.oid, c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p')
),
ddl as (
  select t.relname,
    format('create table if not exists public.%I (%s%s);', t.relname,
      (select string_agg(format('%I %s%s%s', a.attname, format_type(a.atttypid,a.atttypmod),
          case when a.attnotnull then ' not null' else '' end,
          coalesce(' default '||pg_get_expr(d.adbin,d.adrelid),'')), ', ' order by a.attnum)
       from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
       where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped),
      coalesce((select ', '||string_agg(format('constraint %I %s', co.conname, pg_get_constraintdef(co.oid)), ', ' order by co.contype desc)
       from pg_constraint co where co.conrelid=t.oid),'')) as create_sql,
    (select coalesce(json_agg(indexdef),'[]') from pg_indexes i where i.schemaname='public' and i.tablename=t.relname and indexname not in (select conname from pg_constraint where conrelid=t.oid)) as indexes,
    (select relrowsecurity from pg_class where oid=t.oid) as rls,
    (select coalesce(json_agg(format('create policy %I on public.%I as %s for %s to %s%s%s;', p.policyname, p.tablename, p.permissive, p.cmd, array_to_string(p.roles, ', '),
        coalesce(' using ('||p.qual||')',''), coalesce(' with check ('||p.with_check||')',''))),'[]') from pg_policies p where p.schemaname='public' and p.tablename=t.relname) as policies,
    (select coalesce(json_agg(pg_get_triggerdef(tg.oid)),'[]') from pg_trigger tg where tg.tgrelid=t.oid and not tg.tgisinternal) as triggers,
    (select coalesce(json_agg(json_build_object('grantee',grantee,'privilege',privilege_type)),'[]') from information_schema.role_table_grants g where g.table_schema='public' and g.table_name=t.relname and grantee in ('anon','authenticated')) as grants,
    (xpath('/row/j/text()', query_to_xml(format('select coalesce(json_agg(x),''[]'') as j from public.%I x', t.relname), false, true, '')))[1]::text::json as rows
  from tabs t
)
select json_build_object(
  'project','owehvuzuqmewcnyxkzbf',
  'taken_at', now(),
  'tables', (select json_agg(json_build_object('name',relname,'create_sql',create_sql,'indexes',indexes,'rls',rls,'policies',policies,'triggers',triggers,'grants',grants,'row_count',json_array_length(rows),'rows',rows) order by relname) from ddl),
  'functions', (select coalesce(json_agg(pg_get_functiondef(p.oid) order by p.proname),'[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'),
  'auth_users', (select coalesce(json_agg(json_build_object('id',id,'email',email,'created_at',created_at) order by created_at),'[]') from auth.users)
) as backup;
