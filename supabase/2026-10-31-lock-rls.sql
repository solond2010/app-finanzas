-- Cierra el acceso directo a la base de datos con la clave pública (anon).
-- Requisito: la app en producción ya usa SUPABASE_SERVICE_ROLE_KEY en el
-- servidor (commit 38b3510), que no se ve afectada por RLS.
-- Ejecútalo UNA vez en Supabase → SQL Editor → New query → pegar → Run.
-- Es idempotente. Para deshacerlo: ver bloque "MARCHA ATRÁS" al final.

begin;

-- 1) Activar RLS en las 9 tablas SIN políticas para anon/authenticated:
--    la clave pública deja de poder leer o escribir; la clave secreta sigue funcionando.
alter table public.accounts                  enable row level security;
alter table public.transactions              enable row level security;
alter table public.sinking_funds             enable row level security;
alter table public.categories                enable row level security;
alter table public.budgets                   enable row level security;
alter table public.settings                  enable row level security;
alter table public.watchlist                 enable row level security;
alter table public.investments               enable row level security;
alter table public.investment_contributions  enable row level security;

-- 2) Logos de bancos: lectura pública sí; subir/cambiar/borrar solo desde el servidor.
drop policy if exists "Anon upload bank logos" on storage.objects;
drop policy if exists "Anon update bank logos" on storage.objects;
drop policy if exists "Anon delete bank logos" on storage.objects;

commit;

-- 3) Comprobación: debe salir rowsecurity = true en todas, y ninguna tabla pública con false.
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by rowsecurity, tablename;
-- Políticas que quedan en el bucket (debe quedar solo "Public read bank logos"):
select policyname, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname ilike '%bank logos%';

-- MARCHA ATRÁS (solo si algo se rompe; vuelve al estado anterior, inseguro):
-- alter table public.accounts disable row level security;  -- (repetir para las 9 tablas)
-- create policy "Anon upload bank logos" on storage.objects for insert with check (bucket_id = 'bank-logos');
-- create policy "Anon update bank logos" on storage.objects for update using (bucket_id = 'bank-logos');
-- create policy "Anon delete bank logos" on storage.objects for delete using (bucket_id = 'bank-logos');

-- ---------------------------------------------------------------------------
-- APLICADO el 2026-10-31 (~18:30 Europe/Madrid). Además del bloque anterior,
-- se borraron TODAS las políticas del esquema public (10), que eran permisivas
-- y anulaban el efecto de RLS. Comprobado: la clave anon devuelve 0 filas en
-- las 9 tablas y la app sigue funcionando (usa la clave secreta en el servidor).
--
-- MARCHA ATRÁS de esas políticas (solo en emergencia; vuelve a abrir la BD a
-- cualquiera con la clave pública). Nombres, comando y rol son los originales;
-- la expresión exacta no se guardó y se asume using (true) / with check (true).
-- Ojo: "Solo mi usuario puede acceder a presupuestos" podría haber usado una
-- condición por usuario (p. ej. auth.uid() = user_id); revisa antes de recrearla.
--
-- create policy "Acceso temporal" on public.accounts      for all to public using (true) with check (true);
-- create policy "Acceso temporal" on public.sinking_funds for all to public using (true) with check (true);
-- create policy "Acceso temporal" on public.transactions  for all to public using (true) with check (true);
-- create policy "Solo mi usuario puede acceder a presupuestos" on public.budgets for all to public using (true) with check (true);
-- create policy "Modificar categorias"        on public.categories for all    to public using (true) with check (true);
-- create policy "Publicar lectura categorias" on public.categories for select to public using (true);
-- create policy "Acceso temporal"             on public.categories for all    to public using (true) with check (true);
-- create policy "investments anon all" on public.investments for all to anon using (true) with check (true);
-- create policy "settings anon all"    on public.settings    for all to anon using (true) with check (true);
-- create policy "watchlist anon all"   on public.watchlist   for all to anon using (true) with check (true);
