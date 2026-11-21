-- Marca idempotente del email de bienvenida al activar un Pro de pago.
-- Solo añade una tabla; no backfill, no toca planes existentes.
-- Rollback: supabase/2026-11-pro-welcome-rollback.sql

create table if not exists public.pro_welcome_emails (
  user_id uuid primary key references auth.users(id) on delete cascade,
  kind text not null check (kind in ('monthly', 'lifetime')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.pro_welcome_emails enable row level security;

revoke all on table public.pro_welcome_emails from public, anon, authenticated;
grant all on table public.pro_welcome_emails to service_role;
