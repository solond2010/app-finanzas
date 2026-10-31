# Emails con Resend (preparado, sin comprar nada)

Garra ya está lista para mandar emails con Resend. Hasta que se configure,
**no se envía nada** y todo sigue funcionando: los comentarios quedan en
Supabase (tabla `feedback`, visibles en `/admin` solo para Moha).

## 1. Avisos de comentarios a Moha (gratis, sin dominio)

1. Crea una cuenta gratuita en https://resend.com (plan Free: 3.000 emails/mes,
   100/día) con el email donde quieras recibir los avisos.
2. En Resend → API Keys → «Create API Key» (permiso *Sending access*).
3. En Vercel → proyecto `app-finanzas` → Settings → Environment Variables
   (Production), añade:
   - `RESEND_API_KEY` = la clave (empieza por `re_`)
   - `EMAIL_FROM` = `Garra <onboarding@resend.dev>`
   - `FEEDBACK_EMAIL_TO` = el mismo email con el que creaste la cuenta de Resend
4. Redeploy. Sin dominio propio, `onboarding@resend.dev` **solo puede enviar al
   email del dueño de la cuenta de Resend**; para avisos a Moha es suficiente.

## 2. Emails de acceso para usuarios (confirmar cuenta, recuperar contraseña)

Requiere un dominio propio verificado (ver la recomendación de dominio).

1. Compra el dominio y en Resend → Domains → «Add domain» (región EU,
   `eu-west-1`). Añade en el DNS del dominio los registros que te da Resend
   (MX + TXT de SPF en `send.<dominio>`, TXT DKIM `resend._domainkey`), y un
   DMARC básico: `_dmarc` TXT `v=DMARC1; p=none;`.
2. Cuando Resend marque el dominio como *Verified*:
   - Vercel: cambia `EMAIL_FROM` a `Garra <hola@<dominio>>`.
   - Supabase (proyecto `app finanzas`) → Authentication → Emails → SMTP
     Settings → «Enable custom SMTP»:
     - Host `smtp.resend.com`, puerto `465`, usuario `resend`,
       contraseña = la API key de Resend
     - Sender email `hola@<dominio>`, sender name `Garra`
   - Authentication → Rate Limits: sube «emails por hora» (con SMTP propio
     deja de aplicarse el tope de 2/hora del SMTP de prueba de Supabase).
3. Prueba: «¿Olvidaste tu contraseña?» con una cuenta de prueba.

Nada de esto cuesta dinero salvo el dominio.
