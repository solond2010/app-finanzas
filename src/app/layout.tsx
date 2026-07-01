import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { cookies } from "next/headers"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Finanzas - Panel de Control",
  description: "Dashboard financiero personal",
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
  const isDark = (await cookies()).get("app-finanzas-theme")?.value === "dark"

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable}${isDark ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
