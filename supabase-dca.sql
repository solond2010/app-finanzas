-- Aportes programados (DCA) en la nube.
-- Añade las columnas del plan DCA a la tabla `investments`.
-- Ejecútalo en Supabase → SQL Editor. Es idempotente (puedes correrlo varias veces).

alter table public.investments
  add column if not exists dca_amount numeric,   -- importe de cada aporte
  add column if not exists dca_freq   text,       -- 'monthly' | 'weekly'
  add column if not exists dca_last   date;        -- fecha de la última aportación aplicada

-- No hace falta tocar RLS: las columnas nuevas heredan las políticas de la tabla.
