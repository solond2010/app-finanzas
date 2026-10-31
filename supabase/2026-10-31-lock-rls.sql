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
