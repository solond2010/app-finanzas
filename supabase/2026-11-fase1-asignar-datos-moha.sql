-- =====================================================================
-- FASE 1 · Pasar los datos actuales a la cuenta de Moha
-- =====================================================================
-- Ejecutar DESPUÉS de 2026-11-fase1-multiusuario.sql.
--
-- OPCIÓN A (recomendada, no mueve ni una fila):
--   Crear la cuenta de Moha con el MISMO id que ya tienen sus datos
--   (8c449806-…). Lo hace el script scripts/fase1-crear-cuenta-moha.mjs.
--   Después solo hay que ejecutar la COMPROBACIÓN de abajo.
--
-- OPCIÓN B (si Moha ya se registró desde la web con otro id):
--   Ejecuta el bloque REASIGNAR. Cambia user_id de todas sus filas del id
--   antiguo al de su cuenta nueva, en una transacción, y comprueba que no
--   se pierde ninguna fila (si algo no cuadra, se deshace todo).
--   Después pon en Vercel SHORTCUTS_SECRET_USER_ID = id nuevo (o crea una
--   clave nueva en Configuración y úsala en los Atajos).
-- =====================================================================

-- ---------- OPCIÓN B · REASIGNAR ----------
begin;
do $$
declare
  old_id constant uuid := '8c449806-d8b4-498a-98d7-28809bb7c95a';
  owner_email constant text := 'mohaat68@gmail.com';
  new_id uuid;
  t text;
  before_n bigint;
  after_n bigint;
  -- Hijas antes que padres no importa: las FKs tienen ON UPDATE CASCADE.
  tables text[] := array['accounts','categories','investments','transactions','sinking_funds','budgets','settings','watchlist','investment_contributions'];
begin
  select id into new_id from auth.users where lower(email) = owner_email;
  if new_id is null then raise exception 'No existe ningún usuario con email %', owner_email; end if;
  if new_id = old_id then raise notice 'La cuenta ya usa el id antiguo: no hay nada que mover (opción A)'; return; end if;

  foreach t in array tables loop
    execute format('select count(*) from public.%I where user_id = $1', t) into after_n using new_id;
    if after_n > 0 then
      raise exception 'La cuenta nueva ya tiene % filas en %; revisa antes de mezclar datos', after_n, t;
    end if;
  end loop;

  create temporary table _antes (tabla text primary key, n bigint) on commit drop;
  foreach t in array tables loop
    execute format('insert into _antes select %L, count(*) from public.%I where user_id = $1', t, t) using old_id;
  end loop;

  foreach t in array tables loop
    execute format('update public.%I set user_id = $1 where user_id = $2', t) using new_id, old_id;
  end loop;

  foreach t in array tables loop
    select n into before_n from _antes where tabla = t;
    execute format('select count(*) from public.%I where user_id = $1', t) into after_n using new_id;
    if after_n <> before_n then raise exception 'Recuento distinto en %: antes %, después %', t, before_n, after_n; end if;
    execute format('select count(*) from public.%I where user_id = $1', t) into after_n using old_id;
    if after_n <> 0 then raise exception 'Quedan % filas con el id antiguo en %', after_n, t; end if;
    raise notice '% → % filas movidas', t, before_n;
  end loop;
end $$;
commit;

-- ---------- COMPROBACIÓN (opciones A y B) ----------
-- Copia del 31-10-2026 (antes de la fase 1): accounts 11, transactions 185,
-- sinking_funds 3, categories 41, budgets 10, watchlist 3, investments 1,
-- investment_contributions 5, settings 5. Moha sigue usando la app, así que
-- pueden salir algunos más (nunca menos sin haber borrado él algo).
select 'accounts' tabla, count(*) from public.accounts where user_id = (select id from auth.users where lower(email) = 'mohaat68@gmail.com')
union all select 'transactions', count(*) from public.transactions where user_id = (select id from auth.users where lower(email) = 'mohaat68@gmail.com')
union all select 'sinking_funds', count(*) from public.sinking_funds where user_id = (select id from auth.users where lower(email) = 'mohaat68@gmail.com')
union all select 'categories', count(*) from public.categories where user_id = (select id from auth.users where lower(email) = 'mohaat68@gmail.com')
union all select 'budgets', count(*) from public.budgets where user_id = (select id from auth.users where lower(email) = 'mohaat68@gmail.com')
union all select 'watchlist', count(*) from public.watchlist where user_id = (select id from auth.users where lower(email) = 'mohaat68@gmail.com')
union all select 'investments', count(*) from public.investments where user_id = (select id from auth.users where lower(email) = 'mohaat68@gmail.com')
union all select 'investment_contributions', count(*) from public.investment_contributions where user_id = (select id from auth.users where lower(email) = 'mohaat68@gmail.com')
union all select 'settings', count(*) from public.settings where user_id = (select id from auth.users where lower(email) = 'mohaat68@gmail.com');
