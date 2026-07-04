-- Vínculo cuenta <-> meta de ahorro en la nube.
-- Añade la columna cuenta_id a la tabla `sinking_funds`: sin ella, elegir
-- "Cuenta vinculada" al crear/editar una meta se guardaba solo en memoria y
-- se perdía en el siguiente reload (formatSinkingFund lo forzaba a "").
-- Ejecútalo en Supabase → SQL Editor. Es idempotente (puedes correrlo varias veces).

alter table public.sinking_funds
  add column if not exists cuenta_id text;

-- No hace falta tocar RLS: la columna nueva hereda las políticas de la tabla.
