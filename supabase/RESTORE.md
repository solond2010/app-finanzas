# Copias de seguridad y restauración (Garra)

## Copia diaria
- Se hace con el MCP de Supabase (solo lectura), ejecutando `supabase/backup-query.sql`
  en producción (`owehvuzuqmewcnyxkzbf`). Devuelve un único JSON con, por cada tabla de
  `public`: `create_sql`, índices, RLS, políticas, triggers, permisos, `row_count` y `rows`;
  además todas las funciones de `public` y `auth_users` (id, email, created_at).
- Se guarda como `backups/garra/<AAAA-MM-DD>/backup.json` + `manifest.json` (recuentos)
  en el almacén del bot y en `/workspace/backups/garra/`. Se borran las de más de 30 días.
- Las copias contienen datos personales: no se suben al repositorio.

## Restaurar (primero SIEMPRE en el proyecto de prueba `rtownuughpkrlgkvnerf`)
1. Si el esquema no existe (proyecto nuevo): aplica las migraciones de `supabase/*.sql`
   (o los `create_sql`, índices, políticas, funciones y triggers del backup, en ese orden).
2. Genera el SQL de datos: `python3 supabase/restore-from-backup.py backup.json > restore.sql`.
3. Ejecútalo (MCP `execute_sql` o el editor SQL de Supabase). El script:
   - desactiva FKs y triggers durante la carga (`session_replication_role = replica`),
   - **vacía** todas las tablas de `public` (¡borra lo que haya!),
   - crea usuarios de marcador en `auth.users` con los mismos `id`
     (email `restore+<id>@example.invalid`, sin contraseña) para que los `user_id` cuadren,
   - inserta las filas (respetando ids) y reajusta las secuencias.
4. Comprueba que los recuentos por tabla coinciden con `manifest.json`.

## Usuarios (auth)
Las contraseñas y sesiones no se pueden copiar por SQL. En una restauración real:
- si el proyecto de Supabase sigue siendo el mismo, los usuarios ya existen y no hay que tocar `auth`;
- si es un proyecto nuevo, los marcadores mantienen los datos enlazados; después hay que
  cambiar el email de cada marcador por el real (`auth_users` del backup) desde el panel de
  Supabase y que cada persona use «¿Olvidaste la contraseña?».

## Simulacro
4 nov 2026: copia de producción restaurada en el proyecto de prueba; los 15 recuentos coinciden.
