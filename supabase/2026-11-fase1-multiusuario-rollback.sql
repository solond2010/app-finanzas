-- =====================================================================
-- FASE 1 · MARCHA ATRÁS de 2026-11-fase1-multiusuario.sql
-- =====================================================================
-- Deja el esquema como en la fase 0 (PK simples, FKs simples, RLS activo
-- sin políticas). Antes de ejecutarlo:
--   - Vuelve a poner la app en modo contraseña única (quita AUTH_MODE en
--     Vercel y redeplega), o la app dejará de poder leer datos.
--   - Si ya se han registrado otras personas, sus filas pueden tener ids
--     repetidos con los de Moha y la PK simple no se podría recrear. El
--     paso 0 lo comprueba y PARA sin cambiar nada. En ese caso hay que
--     decidir qué hacer con esas cuentas antes.
-- La tabla api_tokens se conserva (no estorba); bórrala a mano si quieres.
-- =====================================================================

begin;

do $$
declare t text; k text; n bigint;
begin
  foreach t in array array['accounts','transactions','sinking_funds','categories','budgets','settings','watchlist','investments','investment_contributions'] loop
    k := case t when 'settings' then 'key' when 'watchlist' then 'symbol' else 'id' end;
    execute format('select count(*) from (select %I from public.%I group by %I having count(*) > 1) d', k, t, k) into n;
    if n > 0 then raise exception 'La tabla % tiene % ids repetidos entre usuarios; no se puede volver a PK simple', t, n; end if;
  end loop;
end $$;

-- Políticas por usuario fuera.
do $$
declare t text;
begin
  foreach t in array array['accounts','transactions','sinking_funds','categories','budgets','settings','watchlist','investments','investment_contributions'] loop
    execute format('drop policy if exists "propias_select" on public.%I', t);
    execute format('drop policy if exists "propias_insert" on public.%I', t);
    execute format('drop policy if exists "propias_update" on public.%I', t);
    execute format('drop policy if exists "propias_delete" on public.%I', t);
    execute format('alter table public.%I alter column user_id drop default', t);
  end loop;
end $$;

-- FKs compuestas fuera.
alter table public.transactions             drop constraint if exists transactions_cuenta_fkey;
alter table public.budgets                  drop constraint if exists budgets_category_fkey;
alter table public.investments              drop constraint if exists investments_account_fkey;
alter table public.investment_contributions drop constraint if exists investment_contributions_position_fkey;

-- PKs simples de nuevo.
alter table public.accounts                 drop constraint accounts_pkey,                 add constraint accounts_pkey                 primary key (id);
alter table public.transactions             drop constraint transactions_pkey,             add constraint transactions_pkey             primary key (id);
alter table public.sinking_funds            drop constraint sinking_funds_pkey,            add constraint sinking_funds_pkey            primary key (id);
alter table public.categories               drop constraint categories_pkey,               add constraint categories_pkey               primary key (id);
alter table public.budgets                  drop constraint budgets_pkey,                  add constraint budgets_pkey                  primary key (id);
alter table public.settings                 drop constraint settings_pkey,                 add constraint settings_pkey                 primary key (key);
alter table public.watchlist                drop constraint watchlist_pkey,                add constraint watchlist_pkey                primary key (symbol);
alter table public.investments              drop constraint investments_pkey,              add constraint investments_pkey              primary key (id);
alter table public.investment_contributions drop constraint investment_contributions_pkey, add constraint investment_contributions_pkey primary key (id);

-- FKs simples como en el esquema original (NOT VALID: no revisa filas viejas).
alter table public.transactions add constraint transactions_cuenta_id_fkey
  foreign key (cuenta_id) references public.accounts(id) on delete cascade not valid;
alter table public.budgets add constraint budgets_category_id_fkey
  foreign key (category_id) references public.categories(id) on delete cascade not valid;
alter table public.investments add constraint investments_account_id_fkey
  foreign key (account_id) references public.accounts(id) on delete set null not valid;
alter table public.investment_contributions add constraint investment_contributions_position_id_fkey
  foreign key (position_id) references public.investments(id) on delete cascade not valid;

drop index if exists public.idx_transactions_user_cuenta;
drop index if exists public.idx_transactions_user_fecha;
drop index if exists public.idx_budgets_user_category;
drop index if exists public.idx_investments_user_account;
drop index if exists public.idx_contrib_user_position;

commit;
