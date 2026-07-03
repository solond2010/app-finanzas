import "server-only"
import { createClient } from "@supabase/supabase-js"

// Cliente de Supabase para uso EXCLUSIVO en rutas API (servidor). La URL y la
// clave ya no llevan el prefijo NEXT_PUBLIC_, así que Next.js no las incluye
// en el bundle que se manda al navegador: antes cualquiera podía sacar estas
// credenciales inspeccionando la web desplegada y hablar con Supabase
// directamente, saltándose por completo la contraseña de la app (RLS está
// desactivado en todas las tablas). Ahora el navegador solo habla con
// nuestras propias rutas /api/data y /api/storage, protegidas por la misma
// cookie de sesión que ya usa el middleware.
const supabaseUrl = process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

export const supabaseServer = createClient(supabaseUrl, supabaseAnonKey)
