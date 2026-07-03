import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    ];
  },
};

export default nextConfig;
