-- Lotes de importación MCP. Solo añade una tabla nueva, índices, RLS y una
-- función de inserción atómica. No altera tablas ni filas existentes.
-- Rollback: supabase/2026-11-mcp-import-rollback.sql

create table if not exists public.mcp_import_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  rows_hash text not null,
  payload jsonb not null,
  import_batch_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  result jsonb,
  constraint mcp_import_tokens_token_hash_unique unique (token_hash)
);

create index if not exists mcp_import_tokens_user_used_idx
  on public.mcp_import_tokens (user_id, used_at);

alter table public.mcp_import_tokens enable row level security;
alter table public.mcp_import_tokens force row level security;

revoke all on public.mcp_import_tokens from anon, authenticated;

create or replace function public.import_mcp_from_token(
  p_user_id uuid,
  p_token_hash text,
  p_now timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tok public.mcp_import_tokens%rowtype;
  rec jsonb;
  v_id text;
  v_cuenta text;
  v_monto numeric;
  v_fecha text;
  v_tipo text;
  v_categoria text;
  v_desc text;
  v_created timestamptz;
  acc text;
  delta numeric;
  inserted jsonb := '[]'::jsonb;
  skipped int := 0;
  n int := 0;
  result_body jsonb;
  deltas jsonb := '{}'::jsonb;
begin
  select * into tok
  from public.mcp_import_tokens
  where token_hash = p_token_hash
    and user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'status', 404, 'error', 'import_token no es válido');
  end if;

  if tok.used_at is not null then
    return jsonb_build_object('ok', true, 'idempotent', true) || coalesce(tok.result, '{}'::jsonb);
  end if;

  if tok.expires_at <= p_now then
    return jsonb_build_object('ok', false, 'status', 400, 'error', 'import_token ha caducado');
  end if;

  skipped := coalesce((tok.payload->>'skipped_duplicates')::int, 0);

  for rec in select value from jsonb_array_elements(coalesce(tok.payload->'rows', '[]'::jsonb)) as t(value)
  loop
    n := n + 1;
    if n > 200 then
      raise exception 'too many rows';
    end if;

    v_cuenta := rec->>'cuenta_id';
    v_monto := (rec->>'monto')::numeric;
    v_fecha := rec->>'fecha';
    v_tipo := rec->>'tipo';
    v_categoria := rec->>'categoria';
    v_desc := coalesce(rec->>'descripcion', '');
    v_created := p_now;
    v_id := gen_random_uuid()::text;

    if v_cuenta is null or v_fecha is null or v_tipo is null or v_categoria is null or v_monto is null then
      raise exception 'invalid row';
    end if;
    if v_tipo not in ('gasto', 'ingreso') then
      raise exception 'invalid type';
    end if;
    if not exists (
      select 1 from public.accounts a
      where a.id = v_cuenta and a.user_id = p_user_id
    ) then
      raise exception 'account mismatch';
    end if;

    insert into public.transactions (
      id, cuenta_id, monto, fecha, tipo, categoria, es_necesidad, descripcion, tags, user_id, created_at, tienda
    ) values (
      v_id,
      v_cuenta,
      v_monto,
      v_fecha,
      v_tipo,
      v_categoria,
      false,
      v_desc,
      jsonb_build_array('mcp', 'import:' || tok.import_batch_id::text),
      p_user_id,
      v_created,
      ''
    );

    delta := case when v_tipo = 'ingreso' then v_monto else -v_monto end;
    deltas := jsonb_set(
      deltas,
      array[v_cuenta],
      to_jsonb(coalesce((deltas->>v_cuenta)::numeric, 0) + delta)
    );

    inserted := inserted || jsonb_build_array(jsonb_build_object(
      'id', v_id,
      'cuenta_id', v_cuenta,
      'monto', v_monto,
      'fecha', v_fecha,
      'tipo', v_tipo,
      'categoria', v_categoria,
      'descripcion', v_desc,
      'created_at', v_created
    ));
  end loop;

  for acc, delta in
    select key, value::numeric from jsonb_each_text(deltas)
  loop
    update public.accounts
       set saldo = round((saldo + delta)::numeric, 2)
     where user_id = p_user_id
       and id = acc;
    if not found then
      raise exception 'account missing during saldo update';
    end if;
  end loop;

  result_body := jsonb_build_object(
    'imported', coalesce(jsonb_array_length(inserted), 0),
    'skipped_duplicates', skipped,
    'batch_id', tok.import_batch_id,
    'transactions', inserted
  );

  update public.mcp_import_tokens
     set used_at = p_now,
         result = result_body
   where token_hash = p_token_hash
     and user_id = p_user_id;

  return jsonb_build_object('ok', true, 'idempotent', false) || result_body;
end;
$$;

revoke all on function public.import_mcp_from_token(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.import_mcp_from_token(uuid, text, timestamptz) to service_role;
