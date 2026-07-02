-- Histórico de aportaciones mensuales por fondo/posición ("Aportaciones mensuales").
-- Cada fila es un aporte individual (compra inicial, aporte DCA aplicado o aporte
-- manual) que alimenta la tabla mes a mes de /inversiones.
-- Ejecútalo en Supabase → SQL Editor. Es idempotente (puedes correrlo varias veces).

create table if not exists public.investment_contributions (
  id text primary key,
  position_id text not null references public.investments(id) on delete cascade,
  amount numeric not null,
  date date not null,
  user_id uuid not null,
  created_at timestamptz default now()
);

create index if not exists idx_investment_contributions_position_id on public.investment_contributions(position_id);

alter table public.investment_contributions disable row level security;
