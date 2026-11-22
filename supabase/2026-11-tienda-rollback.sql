-- Rollback de 2026-11-tienda.sql. No se aplica en producción salvo necesidad.

alter table public.transactions
  drop column if exists tienda;
