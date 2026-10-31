import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Id de la versión desplegada (commit en Vercel). El cliente lo compara con
  // /api/version para recargarse solo tras cada despliegue (ver version-check).
  env: { NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || "dev" },
  // Solo se empaquetan los iconos de Phosphor que se usan.
  experimental: { optimizePackageImports: ["@phosphor-icons/react"] },
  // Cabeceras de seguridad estándar para toda la app. Es una app financiera
  // con login por contraseña: X-Frame-Options evita que la página de login se
  // enmarque en un iframe ajeno (clickjacking), y las otras dos son
  // endurecimiento sin coste que no dependen de nada externo para funcionar
  // (a diferencia de una CSP, que aquí tocaría afinar contra Supabase/Yahoo/
  // Google Fonts y arriesga romper algo si se hace deprisa).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      // Atajo de iPhone compartido (firmado, sin claves dentro): se descarga
      // con su nombre bonito para que al importarlo se llame «Apuntar en Garra».
      {
        source: "/atajos/apuntar-en-garra.shortcut",
        headers: [
          { key: "Content-Type", value: "application/octet-stream" },
          { key: "Content-Disposition", value: "attachment; filename=\"Apuntar en Garra.shortcut\"" },
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
  // /objetivos se fusionó dentro de /cuentas (misma página, sección "Metas de
  // ahorro" al final); redirige por si queda algún enlace o marcador antiguo.
  async redirects() {
    return [{ source: "/objetivos", destination: "/cuentas", permanent: true }];
  },
};

export default nextConfig;
