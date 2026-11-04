-- Cuota de la deuda como gasto fijo (aditivo). Rollback: 2026-11-04-debts-cuota-rollback.sql
alter table public.debts add column if not exists cuota_gasto_fijo boolean not null default false;
alter table public.debts add column if not exists cuota_dia smallint check (cuota_dia is null or (cuota_dia between 1 and 31));
alter table public.debts add column if not exists cuota_cuenta_id text;
