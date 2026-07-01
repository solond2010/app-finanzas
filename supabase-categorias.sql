-- Categorías por tipo (ingreso / gasto / ambos).
-- Añade la columna `kind` a la tabla `categories`.
-- Ejecútalo en Supabase → SQL Editor. Es idempotente.

alter table public.categories
  add column if not exists kind text;

-- La app rellena automáticamente el tipo de las categorías existentes y siembra
-- todas las predeterminadas al cargar, así que no hace falta insertar nada a mano.
-- Las columnas nuevas heredan las políticas RLS de la tabla.
