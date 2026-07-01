-- Clase de activo (Liquidez, Fondos Indexados, Roboadvisor, Renta Fija,
-- Criptomonedas, Oro, Acciones, Otros) para el desglose de asignación y el
-- informe X-Ray. Añade la columna a la tabla `investments`.
-- Ejecútalo en Supabase → SQL Editor. Es idempotente (puedes correrlo varias veces).

alter table public.investments
  add column if not exists asset_class text; -- 'acciones' | 'fondos_indexados' | 'cripto' | 'renta_fija' | 'roboadvisor' | 'oro' | 'liquidez' | 'otros'

-- No hace falta tocar RLS: la columna nueva hereda las políticas de la tabla.
