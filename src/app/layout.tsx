import type { Metadata, Viewport } from "next"
import { Bricolage_Grotesque, Geist_Mono, Inter } from "next/font/google"
import { cookies } from "next/headers"
import "./globals.css"
import { VersionWatcher } from "@/components/shared/version-watcher"
import { ErrorReporter } from "@/components/shared/error-reporter"

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
})

// Tipografía de titulares de la marca Garra.
const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  metadataBase: new URL("https://www.migarra.app"),
  title: { default: "Garra · Tus finanzas, con garra", template: "%s · Garra" },
  description: "Garra: tus cuentas, gastos e inversiones en un solo lugar.",
  applicationName: "Garra",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Garra",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Sin esto, env(safe-area-inset-*) vale 0 siempre: el padding de seguridad
  // que ya usa la barra inferior móvil (mobile-bottom-nav.tsx) no hacía nada.
  viewportFit: "cover",
  themeColor: "#0B0F14",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // El tema se lee de una cookie en el servidor para renderizar la clase "dark"
  // directamente en el HTML. Así no hay flash ni desincronización: React hidrata
  // con la misma clase que ya trae el <html>, sin necesidad de un script previo
  // (que además generaba avisos de "script tag" y podía ser borrado al hidratar).
  // Midnight premium es el tema inicial. Quienes ya eligieron un tema
  // explícitamente conservan esa preferencia en su cookie.
  const isDark = (await cookies()).get("app-finanzas-theme")?.value !== "light"

  return (
    <html
      lang="es"
      className={`${inter.variable} ${bricolage.variable} ${geistMono.variable}${isDark ? " dark" : ""}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <VersionWatcher />
        <ErrorReporter />
      </body>
    </html>
  )
}
