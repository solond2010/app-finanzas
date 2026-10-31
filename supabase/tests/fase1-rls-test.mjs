import { PGlite } from "@electric-sql/pglite"
import { readFileSync } from "node:fs"
// Prueba de RLS de la fase 1 contra un Postgres real en memoria (PGlite),
// simulando auth.uid() y los roles anon/authenticated de Supabase. Solo datos
// inventados. Uso (desde la raíz del repo): node supabase/tests/fase1-rls-test.mjs
const db = new PGlite()
const read = (f) => readFileSync(f, "utf8")
const LEG = "8c449806-d8b4-498a-98d7-28809bb7c95a", A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", MOHA_NEW = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log("✅", m) } else { fail++; console.log("❌", m) } }
async function expectError(sql, m) { try { await db.exec(sql); ok(false, m + " (no dio error)") } catch (e) { ok(true, m + " → " + e.message.split("\n")[0]) } }
const q = async (sql) => (await db.query(sql)).rows

// Simular Supabase: roles, esquema auth y auth.uid()
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
`)
await db.exec(read("supabase/migration.sql"))
for (const f of ["supabase-accounts-currency.sql","supabase-assetclass.sql","supabase-categorias.sql","supabase-contributions.sql","supabase-dca.sql","supabase-sinkingfunds-cuenta.sql","supabase-transactions-timestamp.sql"]) {
  try { await db.exec(read(f)) } catch (e) { console.log("(aviso)", f, e.message.split("\n")[0]) }
}
// Fase 0: RLS activado sin políticas
for (const t of ["accounts","transactions","sinking_funds","categories","budgets","settings","watchlist","investments","investment_contributions"]) await db.exec(`alter table ${t} enable row level security`)

// Datos sintéticos del dueño histórico (los ids por defecto, como en la app)
await db.exec(`
insert into accounts(id,nombre,tipo,user_id) values ('acc_emergency','Emergencias','emergencia','${LEG}'),('acc_principal','Principal','efectivo','${LEG}');
insert into transactions(id,cuenta_id,monto,fecha,tipo,categoria,user_id) values ('t1','acc_principal',10,'2026-10-01','gasto','Comida','${LEG}'),('t2','acc_emergency',50,'2026-10-02','ingreso','Nómina','${LEG}');
insert into categories(id,name,user_id) values ('cat_comida','Comida','${LEG}');
insert into budgets(id,category_id,amount,month,user_id) values ('b1','cat_comida',100,'2026-10','${LEG}');
insert into settings(key,value,user_id) values ('income-target','1000','${LEG}');
insert into watchlist(symbol,name,user_id) values ('AAPL','Apple','${LEG}');
insert into investments(id,kind,symbol,name,date,units,buy_price,account_id,user_id) values ('p1','stock','VWCE','ETF','2026-01-01',1,100,'acc_principal','${LEG}');
insert into investment_contributions(id,position_id,amount,date,user_id) values ('ct1','p1',100,'2026-01-01','${LEG}');
`)

// Aplicar la migración de la fase 1
await db.exec(read("supabase/2026-11-fase1-multiusuario.sql"))
ok(true, "migración aplicada sin errores")
const pol = await q(`select count(*)::int n from pg_policies where schemaname='public' and policyname like 'propias_%'`)
ok(pol[0].n === 39, `39 políticas creadas (hay ${pol[0].n})`)
const fks = await q(`select conname from pg_constraint where contype='f' and connamespace='public'::regnamespace order by 1`)
console.log("   FKs:", fks.map(r => r.conname).join(", "))
ok(fks.length === 5, "4 FKs compuestas + api_tokens→auth.users")

await db.exec(`insert into auth.users values ('${A}','a@test'),('${B}','b@test')`)
const as = async (uid, fn) => { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false)`); try { return await fn() } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub','',false)`) } }

// Usuario A crea sus datos con los MISMOS ids que el dueño histórico (user_id por defecto)
await as(A, async () => {
  await db.exec(`insert into accounts(id,nombre,tipo) values ('acc_principal','Principal de A','efectivo')`)
  await db.exec(`insert into transactions(id,cuenta_id,monto,fecha,tipo,categoria) values ('t1','acc_principal',3,'2026-10-05','gasto','Café')`)
  await db.exec(`insert into settings(key,value) values ('income-target','2000')`)
  const rows = await q(`select id, nombre, user_id from accounts`)
  ok(rows.length === 1 && rows[0].user_id === A, "A solo ve su cuenta (aunque el id coincide con otra)")
  ok((await q(`select * from transactions`)).length === 1, "A solo ve su movimiento")
  ok((await q(`select value from settings`))[0]?.value === "2000", "A ve solo su ajuste")
  await expectError(`insert into accounts(id,nombre,tipo,user_id) values ('x','x','efectivo','${B}')`, "A no puede crear filas a nombre de B")
  await expectError(`insert into transactions(id,cuenta_id,monto,fecha,tipo,categoria) values ('t9','acc_emergency',1,'2026-10-05','gasto','x')`, "A no puede colgar un movimiento de una cuenta ajena (acc_emergency solo existe para otro)")
  const upd = await db.query(`update accounts set saldo = 0 where id = 'acc_emergency' returning id`)
  ok(upd.rows.length === 0, "A no puede modificar cuentas ajenas")
  const del = await db.query(`delete from transactions where id = 't2' returning id`)
  ok(del.rows.length === 0, "A no puede borrar movimientos ajenos")
  await expectError(`update accounts set user_id='${B}' where id='acc_principal'`, "A no puede regalar su fila a B")
  // upsert (lo que hace la app) por PK compuesta
  await db.exec(`insert into accounts(id,nombre,tipo) values ('acc_principal','Renombrada','efectivo') on conflict (user_id,id) do update set nombre = excluded.nombre`)
  ok((await q(`select nombre from accounts`))[0].nombre === "Renombrada", "upsert por (user_id,id) funciona")
})
await as(B, async () => {
  ok((await q(`select * from accounts`)).length === 0, "B (cuenta nueva) no ve nada de nadie")
  ok((await q(`select * from api_tokens`)).length === 0, "B no ve claves ajenas")
  await db.exec(`insert into api_tokens(name,prefix,token_hash) values ('iPhone','fz_abc','hashB')`)
})
await as(A, async () => {
  ok((await q(`select * from api_tokens`)).length === 0, "A no ve la clave de B")
  const r = await db.query(`update api_tokens set revoked_at = now() returning id`)
  ok(r.rows.length === 0, "A no puede revocar la clave de B")
})
await db.exec(`set role anon`)
await expectError(`select * from accounts`, "anon (clave pública sin sesión) no puede leer nada")
await db.exec(`reset role`)

// Dato histórico intacto
const leg = await q(`select count(*)::int n from transactions where user_id='${LEG}'`)
ok(leg[0].n === 2, "las filas del dueño histórico siguen intactas")

// Borrar cuenta → cascada solo dentro del mismo usuario
await db.exec(`delete from accounts where user_id='${A}' and id='acc_principal'`)
ok((await q(`select count(*)::int n from transactions where id='t1'`))[0].n === 1, "borrar la cuenta de A no borra el t1 del histórico")
await db.exec(`delete from accounts where user_id='${LEG}' and id='acc_principal'`)
ok((await q(`select account_id from investments where id='p1'`))[0].account_id === null, "on delete set null (account_id) conserva user_id")
await db.exec(`insert into accounts(id,nombre,tipo,user_id) values ('acc_principal','Principal','efectivo','${LEG}'); insert into transactions(id,cuenta_id,monto,fecha,tipo,categoria,user_id) values ('t1','acc_principal',10,'2026-10-01','gasto','Comida','${LEG}'); update investments set account_id='acc_principal' where id='p1'`)

// Rollback debe NEGARSE porque hay ids repetidos entre usuarios
await expectError(read("supabase/2026-11-fase1-multiusuario-rollback.sql"), "rollback se niega si hay ids repetidos entre usuarios")
await db.exec("rollback").catch(() => {})

// Opción B: Moha se registra con otro id y se le asignan los datos
await db.exec(`delete from accounts where user_id in ('${A}','${B}'); delete from settings where user_id in ('${A}','${B}'); delete from transactions where user_id in ('${A}','${B}')`)
await db.exec(`insert into auth.users values ('${MOHA_NEW}','mohaat68@gmail.com')`)
const before = await q(`select (select count(*) from accounts)::int a, (select count(*) from transactions)::int t, (select count(*) from investment_contributions)::int c`)
const assign = read("supabase/2026-11-fase1-asignar-datos-moha.sql")
await db.exec(assign.slice(0, assign.indexOf("-- ---------- COMPROBACIÓN")))
const after = await q(`select (select count(*) from accounts where user_id='${MOHA_NEW}')::int a, (select count(*) from transactions where user_id='${MOHA_NEW}')::int t, (select count(*) from investment_contributions where user_id='${MOHA_NEW}')::int c, (select count(*) from transactions where user_id='${LEG}')::int left_old`)
ok(after[0].a === before[0].a && after[0].t === before[0].t && after[0].c === before[0].c && after[0].left_old === 0, `opción B mueve todo: ${JSON.stringify(before[0])} → ${JSON.stringify(after[0])}`)
const check = await db.query(assign.slice(assign.indexOf("select 'accounts'")))
console.log("   comprobación:", check.rows.map(r => `${r.tabla}=${r.count}`).join(" "))
await as(MOHA_NEW, async () => ok((await q(`select * from transactions`)).length === 2, "Moha, con su cuenta nueva, ve sus movimientos"))
// Volver a ejecutarlo no rompe (ya no quedan filas viejas: la cuenta nueva ya tiene filas → para)
await expectError(assign.slice(0, assign.indexOf("-- ---------- COMPROBACIÓN")), "re-ejecutar la reasignación se detiene sin mezclar")
await db.exec("rollback").catch(() => {})

// Rollback completo ahora que no hay duplicados
await db.exec(read("supabase/2026-11-fase1-multiusuario-rollback.sql"))
const pk = await q(`select pg_get_constraintdef(oid) d from pg_constraint where conname='accounts_pkey'`)
ok(pk[0].d === "PRIMARY KEY (id)", "rollback devuelve la PK simple")
ok((await q(`select count(*)::int n from pg_policies where policyname like 'propias_%' and tablename <> 'api_tokens'`))[0].n === 0, "rollback quita las políticas")
// Y la migración se puede volver a aplicar
await db.exec(read("supabase/2026-11-fase1-multiusuario.sql"))
ok(true, "la migración se puede re-aplicar tras el rollback")
console.log(`\n${pass} OK, ${fail} fallos`)
process.exit(fail ? 1 : 0)
