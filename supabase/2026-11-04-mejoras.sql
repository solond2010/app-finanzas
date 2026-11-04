-- Mejoras 04-11 (aditivo). Rollback: supabase/2026-11-04-mejoras-rollback.sql
-- 1) Momento en que el pendiente guardado era correcto: las cuotas marcadas
--    «Ya se realizó» después de esto lo reducen (se calcula en la app).
alter table public.debts add column if not exists pendiente_at timestamptz not null default now();
-- 2) Historial de valor de los bienes.
create table if not exists public.asset_values (
  user_id uuid not null default auth.uid() references auth.users(id),
  id text not null,
  asset_id text not null,
  valor numeric not null check (valor >= 0),
  fecha date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists asset_values_asset_idx on public.asset_values (user_id, asset_id, fecha);
alter table public.asset_values enable row level security;
create policy propias_select on public.asset_values for select using (user_id = (select auth.uid()));
create policy propias_insert on public.asset_values for insert with check (user_id = (select auth.uid()));
create policy propias_update on public.asset_values for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy propias_delete on public.asset_values for delete using (user_id = (select auth.uid()));
-- Punto de partida: el valor actual de cada bien, con su fecha (o la de alta).
insert into public.asset_values (user_id, id, asset_id, valor, fecha)
select user_id, 'av_init_' || id, id, valor, coalesce(valor_fecha, created_at::date) from public.assets
on conflict do nothing;
