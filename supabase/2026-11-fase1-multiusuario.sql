-- =====================================================================
-- FASE 1 · Cuentas de usuario (multiusuario) — MIGRACIÓN
-- =====================================================================
-- Qué hace (todo en UNA transacción: o se aplica entero o nada):
--   1. user_id pasa a rellenarse solo con el usuario conectado (auth.uid()).
--   2. Claves primarias compuestas (user_id, id): dos usuarios pueden tener
--      una fila con el mismo id (p. ej. las cuentas por defecto
--      "acc_emergency") sin chocar. settings → (user_id, key) y
--      watchlist → (user_id, symbol).
--   3. Las relaciones entre tablas (FK) pasan a incluir user_id: un
--      movimiento solo puede apuntar a una cuenta DEL MISMO usuario.
--   4. Políticas RLS: cada usuario conectado solo ve/crea/cambia/borra sus
--      filas (user_id = auth.uid()). El rol anon sigue sin acceso.
--   5. Tabla api_tokens (claves de Atajos; solo el hash).
--
-- NO mueve ni borra datos. Las filas actuales siguen siendo del dueño
-- histórico 8c449806-d8b4-498a-98d7-28809bb7c95a. Para que pasen a la
-- cuenta de Moha ver 2026-11-fase1-asignar-datos-moha.sql.
--
-- Es compatible con la app actual (modo contraseña única): el servidor
-- usa la clave secreta (se salta RLS) y PostgREST hace upsert por la clave
-- primaria, sea simple o compuesta.
--
-- Requisitos: Postgres 15+ (Supabase lo es) por "on delete set null (col)".
-- Marcha atrás: 2026-11-fase1-multiusuario-rollback.sql
-- =====================================================================

begin;

-- 0. Seguridad: no seguir si hay filas sin dueño.
do $$
declare t text; n bigint;
begin
  foreach t in array array['accounts','transactions','sinking_funds','categories','budgets','settings','watchlist','investments','investment_contributions'] loop
    execute format('select count(*) from public.%I where user_id is null', t) into n;
    if n > 0 then raise exception 'La tabla % tiene % filas sin user_id; revisa antes de migrar', t, n; end if;
  end loop;
end $$;

-- 1. user_id por defecto = usuario conectado.
alter table public.accounts                 alter column user_id set default auth.uid();
alter table public.transactions             alter column user_id set default auth.uid();
alter table public.sinking_funds            alter column user_id set default auth.uid();
alter table public.categories               alter column user_id set default auth.uid();
alter table public.budgets                  alter column user_id set default auth.uid();
alter table public.settings                 alter column user_id set default auth.uid();
alter table public.watchlist                alter column user_id set default auth.uid();
alter table public.investments              alter column user_id set default auth.uid();
alter table public.investment_contributions alter column user_id set default auth.uid();

-- 2 y 3. Quitar FKs antiguas (anotando cuáles existían), cambiar PKs a
-- compuestas y recrear las FKs incluyendo user_id.
create temporary table _fase1_fks (child text primary key) on commit drop;

do $$
declare r record;
begin
  for r in
    select c.conname, c.conrelid::regclass::text as child, c.confrelid::regclass::text as parent
    from pg_constraint c
    where c.contype = 'f'
      and c.connamespace = 'public'::regnamespace
      and c.conrelid::regclass::text in ('transactions','budgets','investments','investment_contributions','sinking_funds')
      and c.confrelid::regclass::text in ('accounts','categories','investments')
  loop
    insert into _fase1_fks(child) values (r.child) on conflict do nothing;
    execute format('alter table public.%I drop constraint %I', r.child, r.conname);
  end loop;

  -- PKs: quitar la simple y poner la compuesta.
  for r in
    select c.conname, c.conrelid::regclass::text as tbl
    from pg_constraint c
    where c.contype = 'p'
      and c.connamespace = 'public'::regnamespace
      and c.conrelid::regclass::text in ('accounts','transactions','sinking_funds','categories','budgets','settings','watchlist','investments','investment_contributions')
  loop
    execute format('alter table public.%I drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

alter table public.accounts                 add constraint accounts_pkey                 primary key (user_id, id);
alter table public.transactions             add constraint transactions_pkey             primary key (user_id, id);
alter table public.sinking_funds            add constraint sinking_funds_pkey            primary key (user_id, id);
alter table public.categories               add constraint categories_pkey               primary key (user_id, id);
alter table public.budgets                  add constraint budgets_pkey                  primary key (user_id, id);
alter table public.settings                 add constraint settings_pkey                 primary key (user_id, key);
alter table public.watchlist                add constraint watchlist_pkey                primary key (user_id, symbol);
alter table public.investments              add constraint investments_pkey              primary key (user_id, id);
alter table public.investment_contributions add constraint investment_contributions_pkey primary key (user_id, id);

-- FKs compuestas (solo donde ya había FK, para no cambiar el comportamiento).
-- "on update cascade" permite reasignar el dueño de todas sus filas de golpe.
do $$
begin
  if exists (select 1 from _fase1_fks where child = 'transactions') then
    alter table public.transactions add constraint transactions_cuenta_fkey
      foreign key (user_id, cuenta_id) references public.accounts(user_id, id) on delete cascade on update cascade;
  end if;
  if exists (select 1 from _fase1_fks where child = 'budgets') then
    alter table public.budgets add constraint budgets_category_fkey
      foreign key (user_id, category_id) references public.categories(user_id, id) on delete cascade on update cascade;
  end if;
  if exists (select 1 from _fase1_fks where child = 'investments') then
    alter table public.investments add constraint investments_account_fkey
      foreign key (user_id, account_id) references public.accounts(user_id, id) on delete set null (account_id) on update cascade;
  end if;
  if exists (select 1 from _fase1_fks where child = 'investment_contributions') then
    alter table public.investment_contributions add constraint investment_contributions_position_fkey
      foreign key (user_id, position_id) references public.investments(user_id, id) on delete cascade on update cascade;
  end if;
end $$;

-- Índices útiles por usuario (las PK ya empiezan por user_id).
create index if not exists idx_transactions_user_cuenta on public.transactions(user_id, cuenta_id);
create index if not exists idx_transactions_user_fecha  on public.transactions(user_id, fecha);
create index if not exists idx_budgets_user_category    on public.budgets(user_id, category_id);
create index if not exists idx_investments_user_account on public.investments(user_id, account_id);
create index if not exists idx_contrib_user_position    on public.investment_contributions(user_id, position_id);

-- 4. RLS: cada usuario, solo lo suyo. (RLS ya estaba activado en la fase 0.)
do $$
declare t text;
begin
  foreach t in array array['accounts','transactions','sinking_funds','categories','budgets','settings','watchlist','investments','investment_contributions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "propias_select" on public.%I', t);
    execute format('drop policy if exists "propias_insert" on public.%I', t);
    execute format('drop policy if exists "propias_update" on public.%I', t);
    execute format('drop policy if exists "propias_delete" on public.%I', t);
    execute format('create policy "propias_select" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy "propias_insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "propias_update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "propias_delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- 5. Claves personales de Atajos (solo se guarda el hash SHA-256).
create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default 'Atajo de iPhone',
  prefix text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists idx_api_tokens_user on public.api_tokens(user_id);
alter table public.api_tokens enable row level security;
drop policy if exists "propias_select" on public.api_tokens;
drop policy if exists "propias_insert" on public.api_tokens;
drop policy if exists "propias_update" on public.api_tokens;
create policy "propias_select" on public.api_tokens for select to authenticated using (user_id = (select auth.uid()));
create policy "propias_insert" on public.api_tokens for insert to authenticated with check (user_id = (select auth.uid()));
-- Solo para revocar (poner revoked_at). Sin política de delete: queda rastro.
create policy "propias_update" on public.api_tokens for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update on public.api_tokens to authenticated;
revoke all on public.api_tokens from anon;

commit;

-- Comprobación rápida (debe salir 9 tablas × 4 políticas + 3 de api_tokens = 39):
-- select count(*) from pg_policies where schemaname = 'public' and policyname like 'propias_%';
