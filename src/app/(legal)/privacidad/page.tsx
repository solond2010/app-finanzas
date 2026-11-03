import type { Metadata } from "next"
import { LegalPage } from "../legal-page"

export const metadata: Metadata = { title: "Política de privacidad · Garra" }

export default function PrivacidadPage() {
  return (
    <LegalPage title="Política de privacidad" intro="Garra es una app para llevar tus finanzas personales. Aquí te contamos, sin letra pequeña, qué datos guardamos, para qué y qué puedes hacer con ellos.">
      <section>
        <h2>Quién es el responsable</h2>
        <p>Garra es un proyecto personal en fase beta, gestionado por su creador. Para cualquier cuestión sobre tus datos, escríbenos desde <strong>«Enviar comentario»</strong> dentro de la app (menú lateral o «Más» en el móvil; también funciona en la demo).</p>
      </section>
      <section>
        <h2>Qué datos guardamos</h2>
        <ul>
          <li><strong>Tu email</strong>, para crear tu cuenta y poder entrar.</li>
          <li><strong>Los datos financieros que tú apuntas</strong>: cuentas, saldos, movimientos, categorías, metas, inversiones y ajustes.</li>
          <li><strong>Los comentarios que nos envías</strong>, con la página en la que estabas y el tipo de navegador.</li>
          <li><strong>Avisos técnicos de error</strong> (sin importes, emails ni claves), para poder arreglar fallos.</li>
        </ul>
        <p><strong>Nunca te pedimos ni guardamos las claves de tu banco.</strong> Garra no se conecta a tu banco: los datos los introduces tú.</p>
      </section>
      <section>
        <h2>Para qué los usamos</h2>
        <p>Solo para que la app funcione: mostrarte tus cuentas, gráficos y resúmenes, y mejorar Garra con tus comentarios. <strong>No vendemos tus datos, no los cedemos a terceros para publicidad y no usamos herramientas de analítica ni publicidad.</strong></p>
      </section>
      <section>
        <h2>Dónde se guardan</h2>
        <p>Tus datos se guardan en <strong>Supabase</strong>, en un servidor de la Unión Europea (Estocolmo, Suecia), con acceso restringido para que cada usuario solo pueda ver lo suyo. La web se sirve desde <strong>Vercel</strong>. Ambos actúan como proveedores técnicos de Garra.</p>
      </section>
      <section>
        <h2>Importar movimientos del banco</h2>
        <p>Cuando importas un archivo CSV de tu banco, el archivo se lee <strong>en tu propio dispositivo</strong>: no se sube a ningún sitio. Solo se guardan los movimientos que eliges importar, igual que si los apuntaras a mano.</p>
      </section>
      <section>
        <h2>Cookies y almacenamiento local</h2>
        <p>Solo usamos lo imprescindible: una cookie de sesión para mantenerte conectado (y otra para la demo) y el almacenamiento local del navegador para que la app cargue rápido y funcione sin conexión. No hay cookies de publicidad ni de seguimiento.</p>
      </section>
      <section>
        <h2>Tus derechos</h2>
        <p>Puedes <strong>acceder</strong> a tus datos, <strong>corregirlos</strong> o <strong>borrarlos</strong> cuando quieras. Casi todo lo puedes editar o eliminar desde la propia app, y también puedes descargar una copia desde Configuración. Para eliminar tu cuenta y todos tus datos, pídenoslo desde «Enviar comentario» y lo haremos. También puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).</p>
      </section>
      <section>
        <h2>Cuánto tiempo</h2>
        <p>Guardamos tus datos mientras tengas la cuenta. Si la eliminas, borramos tus datos. Los avisos técnicos de error se conservan solo el tiempo necesario para arreglar fallos.</p>
      </section>
      <section>
        <h2>Cambios</h2>
        <p>Si cambiamos algo importante de esta política, te lo diremos en la app.</p>
      </section>
    </LegalPage>
  )
}
