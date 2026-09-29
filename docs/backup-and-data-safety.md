# Copias y límites de sincronización

La copia mensual se obtiene de Supabase mediante `GET /api/backup`, protegido por `SHORTCUTS_SECRET` (la misma clave privada ya usada por el Atajo). Incluye las tablas de cuentas, movimientos, metas, categorías, presupuestos, posiciones/aportaciones de inversión, lista de seguimiento y ajustes. Las lecturas usan páginas de 500 filas y una copia falla entera si no se puede leer cualquiera de las tablas.

En este Mac, `scripts/monthly-backup.mjs` guarda un JSON íntegro, su SHA-256 y un CSV de movimientos en `~/Documents/Finanzas Backups`. La carpeta y los archivos se crean con permisos privados. El LaunchAgent se ejecuta al iniciar sesión si aún no hay copia de ese mes y los días 1 y 2 a las 09:15. No guarda la clave en el plist: la lee de `SHORTCUTS_SECRET` en `.env.local` y solo la envía por HTTPS a la ruta de solo lectura.

La copia JSON es el archivo de recuperación; el CSV solo facilita la lectura del libro de movimientos. El exportador no reemplaza copias anteriores ni guarda una instantánea vacía. Para recuperar datos, restaura el JSON en Supabase de forma controlada; no importes el CSV porque no contiene las tablas completas.

La aplicación conserva además una copia local reciente en `localStorage`, pero esta depende del navegador/dispositivo y no sustituye el archivo mensual de Mac. El indicador “Guardado en nube” solo confirma las tablas principales sincronizadas por `FinanceProvider`; las inversiones usan un sincronizador aparte. Las copias mensuales reflejan lo que ya llegó a Supabase.
