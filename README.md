# App Finanzas

Panel personal de finanzas (Next.js + Supabase).

## Desarrollo

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Variables de entorno

Crea `.env.local` (local) y configura las mismas claves en Vercel (Production/Preview).
**No subas secretos al repo.**

| Variable | Obligatoria | Uso |
|---|---|---|
| `APP_PASSWORD` | Sí | Contraseña de acceso a la app. Sin ella el proxy responde **503** (fail-closed). El login verifica esta contraseña y guarda en la cookie `app-auth` un **token HMAC opaco**, no la contraseña en claro. |
| `SUPABASE_URL` | Sí | URL del proyecto Supabase. |
| `SUPABASE_ANON_KEY` | Sí | Anon key de Supabase. |
| `SHORTCUTS_SECRET` | Para Atajos iOS | Protege `/api/shortcuts/*` (independiente de `APP_PASSWORD` / cookie). Header: `x-shortcuts-secret`. |

Tras cambiar `APP_PASSWORD` hay que volver a iniciar sesión (las cookies antiguas dejan de valer).

## Scripts

- `npm run dev` — desarrollo
- `npm run build` / `npm start` — producción
- `npm run lint` — ESLint
- `npm test` — Vitest
