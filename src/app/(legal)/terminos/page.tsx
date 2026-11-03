import type { Metadata } from "next"
import { LegalPage } from "../legal-page"

export const metadata: Metadata = { title: "Condiciones de uso · Garra" }

export default function TerminosPage() {
  return (
    <LegalPage title="Condiciones de uso" intro="Al crear tu cuenta o usar Garra aceptas estas condiciones. Son cortas a propósito.">
      <section>
        <h2>Garra está en beta</h2>
        <p>Garra está en fase de pruebas y es <strong>gratis por ahora</strong>. Puede tener fallos, cambiar de aspecto o de funciones, o dejar de estar disponible en algún momento. Si algún día pasa a ser de pago, te avisaremos antes y podrás decidir.</p>
      </section>
      <section>
        <h2>No es asesoramiento financiero</h2>
        <p>Los resúmenes, puntuaciones, objetivos y gráficos son orientativos. <strong>Garra no ofrece asesoramiento financiero, fiscal ni de inversión.</strong> Las decisiones sobre tu dinero son tuyas.</p>
      </section>
      <section>
        <h2>Tus datos, tu responsabilidad</h2>
        <p>Los datos los introduces tú (a mano o importando archivos de tu banco). Eres responsable de que sean correctos y de revisar lo que importas. Usa una contraseña segura y no compartas tu cuenta.</p>
      </section>
      <section>
        <h2>Uso adecuado</h2>
        <p>No uses Garra para fines ilegales ni intentes acceder a datos de otras personas o dañar el servicio. Podemos suspender cuentas que lo hagan.</p>
      </section>
      <section>
        <h2>El servicio, tal cual</h2>
        <p>Garra se ofrece «tal cual», sin garantías. Hacemos lo posible para que funcione bien y para no perder datos, pero te recomendamos descargar de vez en cuando una copia desde Configuración. No respondemos de pérdidas derivadas de errores de cálculo, interrupciones del servicio o datos incorrectos.</p>
      </section>
      <section>
        <h2>Cambios y contacto</h2>
        <p>Podemos actualizar estas condiciones; si el cambio es importante, te lo diremos en la app. Para cualquier duda, escríbenos desde «Enviar comentario». El tratamiento de tus datos se explica en la <a className="text-primary hover:underline" href="/privacidad">Política de privacidad</a>.</p>
      </section>
    </LegalPage>
  )
}
