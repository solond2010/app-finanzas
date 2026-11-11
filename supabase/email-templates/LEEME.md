# Plantillas de email de Supabase Auth (Garra)

Dónde: Supabase → proyecto app-finanzas → Authentication → Emails (Email Templates).
Para cada plantilla: pega el **Asunto** y, en **Body / Source**, el contenido del archivo. Pulsa **Save**.

| Plantilla en Supabase | Asunto | Archivo |
|---|---|---|
| Confirm signup | Confirma tu email en Garra | 1-confirmar-registro.html |
| Magic link | Tu enlace para entrar en Garra | 2-enlace-para-entrar.html |
| Reset password | Recupera tu acceso a Garra | 3-recuperar-acceso.html |
| Change email address | Confirma tu nuevo email en Garra | 4-cambio-de-email.html |

Los enlaces van a `{{ .SiteURL }}/auth/confirm?token_hash=…&type=…` (en producción,
https://www.migarra.app). Se verifican al pulsar el botón de esa página, así que
funcionan en cualquier navegador o móvil (el de Gmail incluido) y los escáneres de
correo no gastan el enlace. En «Reset password», el `next` es `/auth/reset` para
pedir la contraseña nueva. La Site URL del proyecto en Supabase debe ser
https://www.migarra.app.
