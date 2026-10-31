-- Icono elegido por el usuario para cada categoría (nombre de un icono de la
-- lista de la app, p. ej. "PawPrint"). NULL = icono automático según el nombre,
-- como hasta ahora. No toca datos existentes. RLS de categories sin cambios.
-- Marcha atrás: alter table public.categories drop column if exists icon;
alter table public.categories add column if not exists icon text;
alter table public.categories drop constraint if exists categories_icon_check;
alter table public.categories add constraint categories_icon_check check (icon is null or icon ~ '^[A-Za-z]{1,40}$');
