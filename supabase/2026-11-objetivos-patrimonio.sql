-- =====================================================================
-- Objetivos de patrimonio por usuario (antes «hitos» fijos cada 2.500 €)
-- =====================================================================
-- Cada usuario guarda sus propios objetivos (importe + nombre opcional).
-- RLS: cada usuario conectado solo ve/crea/cambia/borra los suyos; anon sin
-- acceso. Máximo 100 objetivos por usuario.
--
-- A Moha (8c449806-…) se le guardan los mismos hitos que veía hasta ahora
-- (escalones de 2.500 € hasta 25.000, 5.000 hasta 100.000, 10.000 hasta
-- 250.000, 25.000 hasta 500.000, 50.000 hasta 1.000.000 y 100.000 hasta
-- 2.000.000), así que su
-- pantalla queda igual. El resto empieza sin objetivos (la app le sugiere
-- unos según su patrimonio).
-- Marcha atrás: 2026-11-objetivos-patrimonio-rollback.sql
-- =====================================================================
begin;

create table if not exists public.wealth_goals (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 80),
  amount numeric(14,2) not null check (amount > 0 and amount <= 100000000000),
  name text check (name is null or char_length(name) <= 40),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.wealth_goals enable row level security;
revoke all on public.wealth_goals from anon, authenticated;
grant select, insert, update, delete on public.wealth_goals to authenticated;

drop policy if exists "propias_select" on public.wealth_goals;
drop policy if exists "propias_insert" on public.wealth_goals;
drop policy if exists "propias_update" on public.wealth_goals;
drop policy if exists "propias_delete" on public.wealth_goals;
create policy "propias_select" on public.wealth_goals for select to authenticated using (user_id = (select auth.uid()));
create policy "propias_insert" on public.wealth_goals for insert to authenticated with check (user_id = (select auth.uid()));
create policy "propias_update" on public.wealth_goals for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "propias_delete" on public.wealth_goals for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.wealth_goals_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- (un upsert de un objetivo que ya existe no cuenta como nuevo)
  if not exists (select 1 from public.wealth_goals where user_id = new.user_id and id = new.id)
     and (select count(*) from public.wealth_goals where user_id = new.user_id) >= 100 then
    raise exception 'Máximo 100 objetivos por usuario';
  end if;
  return new;
end $$;
revoke all on function public.wealth_goals_limit() from public, anon, authenticated;
drop trigger if exists wealth_goals_limit on public.wealth_goals;
create trigger wealth_goals_limit before insert on public.wealth_goals for each row execute function public.wealth_goals_limit();

-- Moha: mismos escalones que la escalera fija anterior.
insert into public.wealth_goals (user_id, id, amount)
select '8c449806-d8b4-498a-98d7-28809bb7c95a'::uuid, 'obj_' || v::bigint, v
from (
  select generate_series(2500, 25000, 2500) v
  union select generate_series(30000, 100000, 5000)
  union select generate_series(110000, 250000, 10000)
  union select generate_series(275000, 500000, 25000)
  union select generate_series(550000, 1000000, 50000)
  union select generate_series(1100000, 2000000, 100000)
) s
where exists (select 1 from auth.users where id = '8c449806-d8b4-498a-98d7-28809bb7c95a')
on conflict do nothing;

commit;
