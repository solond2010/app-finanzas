-- Columna opcional de tienda en gastos de supermercado.
-- Solo añade la columna; no borra ni modifica filas existentes.
-- Rollback: supabase/2026-11-tienda-rollback.sql

alter table public.transactions
  add column if not exists tienda text not null default '';
