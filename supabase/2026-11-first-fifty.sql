-- Pro vitalicio para los 50 primeros usuarios (por created_at, desempate id).
-- Idempotente: no degrada early_access, manual, founder ni un Pro ya concedido.
-- También registra eventos de webhook para idempotencia; los de test no deben
-- aplicarse al ledger en producción (lo decide la API).
-- Rollback: no borra planes concedidos; ver 2026-11-first-fifty-rollback.sql.

alter table public.user_plans drop constraint if exists user_plans_source_check;
alter table public.user_plans add constraint user_plans_source_check
  check (source in ('early_access', 'stripe', 'manual', 'first_fifty'));

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  livemode boolean not null default false,
  applied boolean not null default false,
  ignored_reason text,
  created_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;
revoke all on public.stripe_webhook_events from public, anon, authenticated;
grant select, insert, update on public.stripe_webhook_events to service_role;

create or replace function public.grant_first_fifty_if_eligible(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rank integer;
begin
  if p_user_id is null then
    return;
  end if;

  select count(*)::integer into rank
    from auth.users u
    join auth.users target on target.id = p_user_id
   where (u.created_at, u.id) <= (target.created_at, target.id);

  if rank is null or rank = 0 or rank > 50 then
    return;
  end if;

  insert into public.user_plans (user_id, plan, source)
  values (p_user_id, 'pro', 'first_fifty')
  on conflict (user_id) do update
    set plan = 'pro',
        source = 'first_fifty',
        updated_at = now()
    where public.user_plans.plan = 'free'
      and public.user_plans.source not in ('early_access', 'first_fifty', 'manual');
end;
$$;

revoke all on function public.grant_first_fifty_if_eligible(uuid) from public, anon, authenticated;
grant execute on function public.grant_first_fifty_if_eligible(uuid) to service_role;

-- Backfill: los 50 primeros por fecha de registro.
insert into public.user_plans (user_id, plan, source)
select id, 'pro', 'first_fifty'
  from (
    select id
      from auth.users
     order by created_at asc, id asc
     limit 50
  ) first_fifty
on conflict (user_id) do update
  set plan = 'pro',
      source = 'first_fifty',
      updated_at = now()
  where public.user_plans.plan = 'free'
    and public.user_plans.source not in ('early_access', 'first_fifty', 'manual');

notify pgrst, 'reload schema';
