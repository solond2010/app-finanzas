-- Tokens personales para el MCP remoto y un trigger que evita que un
-- cliente con estado antiguo pise el saldo después de un movimiento
-- escrito en el servidor (MCP, Atajo, etc.).
-- Solo añade objetos; no borra ni modifica filas existentes.
-- NO aplicar en producción en la fase 1.
-- Rollback: supabase/2026-11-mcp-rollback.sql

create table if not exists public.mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null,
  name text not null default 'MCP',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  constraint mcp_tokens_token_hash_unique unique (token_hash)
);

create index if not exists mcp_tokens_user_id_idx on public.mcp_tokens (user_id);

alter table public.mcp_tokens enable row level security;
alter table public.mcp_tokens force row level security;

revoke all on public.mcp_tokens from anon, authenticated;
grant select (id, user_id, name, created_at, last_used_at, revoked_at)
  on public.mcp_tokens to authenticated;

create policy mcp_tokens_select_own
  on public.mcp_tokens
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Recalcula accounts.saldo como la suma firmada del ledger
-- (ingreso +, cualquier otro tipo −), igual que signedAmount() en el cliente.
-- Se dispara al escribir movimientos y también al actualizar el saldo de una
-- cuenta, para que un upsert sucio del cliente no borre el efecto de un
-- movimiento que solo existe en el servidor. No toca filas al crearse.

create or replace function public.reconcile_account_saldo(p_account_id text, p_user_id uuid)
returns numeric
language sql
stable
as $$
  select coalesce(sum(case when tipo = 'ingreso' then monto else -monto end), 0)
  from public.transactions
  where cuenta_id = p_account_id
    and user_id = p_user_id
$$;

create or replace function public.tg_reconcile_account_saldo_from_transaction()
returns trigger
language plpgsql
as $$
declare
  v_account_id text;
  v_user_id uuid;
begin
  if tg_op = 'DELETE' then
    v_account_id := old.cuenta_id;
    v_user_id := old.user_id;
  else
    v_account_id := new.cuenta_id;
    v_user_id := new.user_id;
  end if;

  if v_account_id is not null and v_user_id is not null then
    update public.accounts
       set saldo = public.reconcile_account_saldo(v_account_id, v_user_id)
     where id = v_account_id
       and user_id = v_user_id;
  end if;

  if tg_op = 'UPDATE'
     and (old.cuenta_id is distinct from new.cuenta_id or old.user_id is distinct from new.user_id)
  then
    if old.cuenta_id is not null and old.user_id is not null then
      update public.accounts
         set saldo = public.reconcile_account_saldo(old.cuenta_id, old.user_id)
       where id = old.cuenta_id
         and user_id = old.user_id;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reconcile_account_saldo_from_transaction on public.transactions;
create trigger trg_reconcile_account_saldo_from_transaction
  after insert or update or delete on public.transactions
  for each row
  execute function public.tg_reconcile_account_saldo_from_transaction();

-- Evita que un upsert de cuentas con saldo antiguo pise el ledger.
-- Se omite si la cuenta aún no tiene movimientos (saldo de apertura sin
-- ledger): en ese caso se respeta el saldo que envía el cliente.

create or replace function public.tg_reconcile_account_saldo_on_account()
returns trigger
language plpgsql
as $$
declare
  v_has_tx boolean;
begin
  select exists(
    select 1 from public.transactions
    where cuenta_id = new.id and user_id = new.user_id
  ) into v_has_tx;

  if v_has_tx then
    new.saldo := public.reconcile_account_saldo(new.id, new.user_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reconcile_account_saldo_on_account on public.accounts;
create trigger trg_reconcile_account_saldo_on_account
  before insert or update of saldo on public.accounts
  for each row
  execute function public.tg_reconcile_account_saldo_on_account();
