"use client"

import { useEffect, useState, type ElementType } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarDays, ChartPie, ChartPieSlice, Scales, Bell, ChatText, Ellipsis, Eye, EyeOff, House, Landmark, MoonStar, ReceiptText, ShieldCheck, SlidersHorizontal, SunMedium, X } from "@/components/icons"
import { openFeedbackDialog } from "@/components/feedback/feedback-dialog"
import { cn } from "@/lib/utils"
import { usePrivacy } from "@/lib/privacy"
import { ADMIN_HREF, useAdminNav } from "@/lib/use-admin-nav"
import { useFeedbackNotifications } from "@/components/feedback/feedback-notifications"
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock"

const primaryItems = [
  { href: "/dashboard", label: "Inicio", icon: House },
  { href: "/transactions", label: "Movimientos", icon: ReceiptText },
  { href: "/cuentas", label: "Cuentas", icon: Landmark },
  { href: "/inversiones", label: "Inversiones", icon: ChartPieSlice },
]

const moreItems = [
  { href: "/patrimonio", label: "Patrimonio", description: "Bienes, deudas y patrimonio neto", icon: Scales },
  { href: "/agenda", label: "Gastos fijos", description: "Alquiler, nómina, suscripciones…", icon: CalendarDays },
  { href: "/analytics", label: "Analíticas", description: "Tu evolución financiera", icon: ChartPie },
  { href: "/configuracion", label: "Configuración", description: "Preferencias y datos", icon: SlidersHorizontal },
]

export function MobileBottomNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const { privacy, toggle: togglePrivacy } = usePrivacy()
  const admin = useAdminNav(pathname)
  const notifications = useFeedbackNotifications()
  const sheetItems = admin.isAdmin ? [...moreItems, { href: ADMIN_HREF, label: "Administración", description: "Comentarios y errores de la beta", icon: ShieldCheck }] : moreItems
  const moreActive = sheetItems.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))

  const toggleTheme = () => {
    document.documentElement.classList.add("theme-transition")
    window.setTimeout(() => document.documentElement.classList.remove("theme-transition"), 250)
    const next = !document.documentElement.classList.contains("dark")
    document.documentElement.classList.toggle("dark", next)
    const value = next ? "dark" : "light"
    localStorage.setItem("app-finanzas-theme", value)
    document.cookie = `app-finanzas-theme=${value};path=/;max-age=31536000;samesite=lax`
  }

  useEffect(() => {
    if (!moreOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [moreOpen])

  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  useBodyScrollLock(moreOpen, "#mobile-more-menu")

  return (
    <>
      {moreOpen && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            className="fixed inset-0 z-[59] bg-black/50 backdrop-blur-[2px] animate-in fade-in-0 duration-200 lg:hidden"
            onClick={() => setMoreOpen(false)}
          />
          {/* Hoja inferior real: pegada al borde de la pantalla y por encima de
              la barra (z-60 > z-50), que queda atenuada bajo el fondo. */}
          <section
            id="mobile-more-menu"
            aria-labelledby="mobile-more-title"
            aria-label="Más secciones"
            className="mobile-more-sheet fixed inset-x-0 bottom-0 z-[60] mx-auto max-h-[calc(100svh-env(safe-area-inset-top)-1rem)] max-w-lg overflow-y-auto overscroll-contain rounded-t-[28px] border border-b-0 border-border bg-card px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-6 shadow-2xl lg:hidden animate-in slide-in-from-bottom duration-300 ease-out"
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <div>
                <p className="page-section-label">Tu espacio</p>
                <h2 id="mobile-more-title" className="mt-1 text-lg font-semibold">Más secciones</h2>
              </div>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Cerrar menú" className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95">
                <X className="size-4" />
              </button>
            </div>
            <nav className="space-y-1" aria-label="Secciones adicionales">
              {sheetItems.map((item) => {
                const Icon = item.icon
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn("flex min-h-14 items-center gap-3 rounded-2xl px-3 transition-colors active:scale-[0.99]", active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted/70")}
                  >
                    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", active ? "bg-primary/10" : "bg-muted text-muted-foreground")}>
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className="block text-xs text-muted-foreground">{item.description}</span>
                    </span>
                    {item.href === ADMIN_HREF && admin.nuevos > 0 && <span aria-label={`${admin.nuevos} comentarios sin revisar`} className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground tabular-nums">{admin.nuevos > 99 ? "99+" : admin.nuevos}</span>}
                    {active && <span className="size-2 rounded-full bg-primary" />}
                  </Link>
                )
              })}
              <button
                type="button"
                onClick={() => { setMoreOpen(false); notifications.openInbox() }}
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-left text-foreground transition-colors hover:bg-muted/70 active:scale-[0.99]"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Bell className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Notificaciones</span>
                  <span className="block text-xs text-muted-foreground">Respuestas del equipo</span>
                </span>
                {notifications.unread > 0 && <span aria-label={`${notifications.unread} notificaciones sin leer`} className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground tabular-nums">{notifications.unread > 99 ? "99+" : notifications.unread}</span>}
              </button>
              <button
                type="button"
                onClick={() => { setMoreOpen(false); openFeedbackDialog() }}
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-left text-foreground transition-colors hover:bg-muted/70 active:scale-[0.99]"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <ChatText className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Enviar comentario</span>
                  <span className="block text-xs text-muted-foreground">Cuéntanos un fallo o una idea</span>
                </span>
              </button>
            </nav>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
              <button type="button" onClick={togglePrivacy} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background/60 px-2 text-xs font-medium text-foreground transition-colors hover:bg-muted active:scale-[0.98]">
                {privacy ? <EyeOff className="size-4 text-primary" /> : <Eye className="size-4 text-muted-foreground" />}
                {privacy ? "Mostrar cifras" : "Ocultar cifras"}
              </button>
              <button type="button" onClick={toggleTheme} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background/60 px-2 text-xs font-medium text-foreground transition-colors hover:bg-muted active:scale-[0.98]">
                <SunMedium className="hidden size-4 dark:block" />
                <MoonStar className="size-4 dark:hidden" />
                <span className="hidden dark:inline">Modo claro</span>
                <span className="dark:hidden">Modo oscuro</span>
              </button>
            </div>
          </section>
        </>
      )}

      <nav
        className="mobile-bottom-navigation fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-background/95 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur-2xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Navegación principal"
      >
        <div className="mx-auto grid h-[var(--bottom-nav-h)] max-w-lg grid-cols-5 items-center px-2 sm:px-5">
          {primaryItems.slice(0, 2).map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return <NavItem key={item.href} {...item} active={active} />
          })}
          {/* El «+» va flotante (QuickActionsFAB), encima de la barra. */}
          {primaryItems.slice(2).map((item) => <NavItem key={item.href} {...item} active={pathname === item.href || pathname.startsWith(`${item.href}/`)} />)}
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls="mobile-more-menu"
            onClick={() => setMoreOpen((open) => !open)}
            className={cn("flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl py-1 transition-colors active:scale-95", moreActive || moreOpen ? "text-primary" : "text-muted-foreground")}
          >
            <span className={cn("relative flex size-8 items-center justify-center rounded-xl", (moreActive || moreOpen) && "bg-primary/10")}>
              <Ellipsis className="size-5" />
              {moreActive && <span className="absolute -top-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-[var(--gold)]" />}
            </span>
            <span className="text-[10px] font-medium leading-none">Más</span>
          </button>
        </div>
      </nav>
    </>
  )
}

function NavItem({ href, label, icon, active }: { href: string; label: string; icon: ElementType; active: boolean }) {
  const Icon = icon
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn("flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl py-1 transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", active ? "text-primary" : "text-muted-foreground")}
    >
      <span className={cn("relative flex size-8 items-center justify-center rounded-xl", active && "bg-primary/10")}>
        <Icon className="size-5" />
        {active && <span className="absolute -top-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-[var(--gold)]" />}
      </span>
      <span className="max-w-full truncate px-0.5 text-[10px] font-medium leading-none">{label}</span>
    </Link>
  )
}
