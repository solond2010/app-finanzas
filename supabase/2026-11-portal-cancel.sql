-- Marca si el Pro mensual está cancelado a fin de periodo.
-- Solo añade una columna; no borra ni degrada planes.
-- Rollback: supabase/2026-11-portal-cancel-rollback.sql

alter table public.user_plans
  add column if not exists cancel_at_period_end boolean not null default false;
