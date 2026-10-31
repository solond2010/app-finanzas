# Fase 1 · Cuentas de usuario

Rama `feat/multiusuario`. Nada de esto cambia producción hasta que se
active `AUTH_MODE=supabase` y se ejecute la migración SQL.

## Cómo funciona
- `AUTH_MODE=supabase` → login con email + contraseña (o enlace por email) en
  `/login`. Sin la variable → la contraseña única de siempre (`APP_PASSWORD`).
- Navegador → nuestras rutas `/api/*` → Supabase con la **sesión del usuario**
  y la clave pública: Postgres aplica RLS `user_id = auth.uid()`. Además las
  rutas filtran por `user_id` y lo fijan ellas en cada escritura.
- Atajos y copia de seguridad: clave personal `fz_…` (Configuración → Claves
  para Atajos; en la BD solo el hash) o el `SHORTCUTS_SECRET` antiguo, que
  apunta a Moha. Mismo encabezado `x-shortcuts-secret`.
- Caché local del navegador: si entra otra cuenta en el mismo navegador se
  vacía (`src/lib/local-owner.ts`).

## Archivos SQL (en `supabase/`)
1. `2026-11-fase1-multiusuario.sql` → migración (PK compuestas, FKs con
   user_id, políticas RLS, `api_tokens`). Compatible con la app actual.
2. `2026-11-fase1-asignar-datos-moha.sql` → opción B + comprobación.
3. `2026-11-fase1-multiusuario-rollback.sql` → marcha atrás.
Prueba: `npm run test:rls` (Postgres en memoria, datos inventados).

## Pasar a producción (orden)
1. Copia de seguridad fresca.
2. Probar todo en un proyecto Supabase de pruebas (mismos pasos).
3. Supabase → Authentication → URL Configuration: Site URL = la web, y
   Redirect URL `https://<web>/auth/callback`.
4. SQL Editor: ejecutar `2026-11-fase1-multiusuario.sql`.
5. `node scripts/fase1-crear-cuenta-moha.mjs mohaat68@gmail.com` (opción A:
   cuenta con el mismo id que sus datos; no se mueve ninguna fila).
6. Vercel (Production): `AUTH_MODE=supabase` (+ opcional `SITE_URL`,
   `SIGNUPS_DISABLED=true` para cerrar registros al principio). Merge a main.
7. Moha entra con "enlace por email", pone su contraseña en Configuración.
8. `node scripts/fase1-verificar.mjs "<copia pre-fase1>.json"`.
Marcha atrás rápida: quitar `AUTH_MODE` en Vercel y redeplegar (los datos y
la migración SQL son compatibles con el modo antiguo).
