-- Bienes y deudas (aditivo). Rollback: supabase/2026-11-04-assets-debts-rollback.sql
create table if not exists public.assets (
  user_id uuid not null default auth.uid() references auth.users(id),
  id text not null,
  nombre text not null,
  tipo text not null default 'otro' check (tipo in ('vivienda','coche','relojes','joyas','arte','otro')),
  icono text,
  valor numeric not null default 0 check (valor >= 0),
  valor_fecha date,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create table if not exists public.debts (
  user_id uuid not null default auth.uid() references auth.users(id),
  id text not null,
  nombre text not null,
  tipo text not null default 'otra' check (tipo in ('hipoteca','prestamo_coche','personal','tarjeta','otra')),
  pendiente numeric not null default 0 check (pendiente >= 0),
  principal_inicial numeric check (principal_inicial is null or principal_inicial >= 0),
  cuota_mensual numeric check (cuota_mensual is null or cuota_mensual >= 0),
  tin numeric check (tin is null or (tin >= 0 and tin <= 100)),
  fecha_fin date,
  asset_id text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.assets enable row level security;
alter table public.debts enable row level security;
do $$ declare t text; begin
  foreach t in array array['assets','debts'] loop
    execute format('create policy propias_select on public.%I for select using (user_id = (select auth.uid()))', t);
    execute format('create policy propias_insert on public.%I for insert with check (user_id = (select auth.uid()))', t);
    execute format('create policy propias_update on public.%I for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy propias_delete on public.%I for delete using (user_id = (select auth.uid()))', t);
  end loop;
end $$;
