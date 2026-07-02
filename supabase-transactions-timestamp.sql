-- Hora exacta de creación de cada transacción, para poder ordenar y graficar
-- movimientos del mismo día (hasta ahora `fecha` solo guarda el día, así que
-- varios movimientos del mismo día eran indistinguibles en el histórico).
-- Ejecútalo en Supabase → SQL Editor. Es idempotente (puedes correrlo varias veces).

alter table public.transactions
  add column if not exists created_at timestamptz not null default now();

-- No hace falta tocar RLS: la columna nueva hereda las políticas de la tabla.
-- Las transacciones ya existentes tomarán como created_at el momento en que
-- ejecutes esta migración (no hay forma de recuperar retroactivamente la hora
-- real en la que se crearon) — a partir de ahora, las nuevas sí quedarán bien
-- ordenadas por hora real de creación.
