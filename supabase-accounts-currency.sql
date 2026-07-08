-- Columna currency en accounts.
-- El esquema de referencia (supabase/migration.sql) ya la incluye, pero tu
-- tabla real no la tiene todavía — por eso unformatAccount() en store.tsx
-- nunca la mandaba al guardar (para no romper el guardado de cuentas
-- existentes) y por eso una cuenta creada en una divisa distinta de EUR se
-- revertía sola a EUR en el siguiente reload.
-- Ejecútalo en Supabase → SQL Editor. Es idempotente (puedes correrlo varias veces).

alter table public.accounts
  add column if not exists currency text not null default 'EUR';

-- No hace falta tocar RLS: la columna nueva hereda las políticas de la tabla.
