-- Planes de pago (free / pro / founder). Solo añade cosas: no cambia ninguna
-- tabla existente. Mientras PAYMENTS_ENABLED no sea "true" la app no lo usa
-- para limitar a nadie.
-- Rollback: supabase/2026-11-planes-rollback.sql

create table if not exists public.user_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'founder')),
  -- early_access = usuarios de antes del lanzamiento (Pro para siempre)
  source text not null default 'stripe' check (source in ('early_access', 'stripe', 'manual')),
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists user_plans_plan_idx on public.user_plans (plan);
create unique index if not exists user_plans_stripe_customer_idx on public.user_plans (stripe_customer_id) where stripe_customer_id is not null;

alter table public.user_plans enable row level security;

-- Cada usuario puede leer su plan; solo el servidor (service role) escribe.
drop policy if exists "user_plans_select_own" on public.user_plans;
create policy "user_plans_select_own" on public.user_plans for select to authenticated using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.user_plans from anon, authenticated;

-- Plazas de Fundador ocupadas (público solo el número).
create or replace function public.founder_count()
returns integer
language sql
security definer
set search_path to ''
stable
as $$ select count(*)::integer from public.user_plans where plan = 'founder' $$;

revoke all on function public.founder_count() from public;
grant execute on function public.founder_count() to anon, authenticated, service_role;

-- Los usuarios que ya existen hoy: Pro para siempre.
insert into public.user_plans (user_id, plan, source)
select id, 'pro', 'early_access' from auth.users
on conflict (user_id) do nothing;
