"use client"

import Link from "next/link"
import { useState, type ReactNode } from "react"
import { ArrowRight, CalendarClock, ChartLineUp, Flame, HandCoins, Lightbulb, PiggyBank, Receipt, Target, TrendingDown, TrendingUp, Wallet } from "@/components/icons"
import { Sensitive } from "@/components/shared/sensitive"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"

const eur = (v: number) => formatMoney(v, "EUR")
const TILE = "rounded-2xl border border-border/80 bg-card transition-colors hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

// ── Hero: lo que te queda + tu dinero ───────────────────────────────────────
export function MoneyHero(props: {
  periodLabel: string
  isCurrentMonth: boolean
  net: number
  income: number
  expenses: number
  comparable: number | null // gasto del periodo anterior hasta el mismo día
  comparableLabel: string
  daysLeft: number
  netWorth: number
  available: number
  invested: number
  accountsTotal: number
  accountsWithBalance: number
  sparkline: number[]
  netWorthDelta: number
  netWorthDeltaLabel: string
}) {
  const { net, income, expenses, comparable } = props
  const diffPct = comparable && comparable > 0 ? Math.round((1 - expenses / comparable) * 100) : null
  const other = props.netWorth - props.available - props.invested
  const title = props.isCurrentMonth ? (net >= 0 ? "Te quedan este mes" : "Este mes vas en negativo") : net >= 0 ? `Te sobró en ${props.periodLabel}` : `Gastaste de más en ${props.periodLabel}`
  const spentPct = income > 0 ? Math.min(100, (expenses / income) * 100) : expenses > 0 ? 100 : 0
  const tickPct = income > 0 && comparable ? Math.min(100, (comparable / income) * 100) : null
  return (
    <section aria-label="Tu dinero" className="hero-panel grid overflow-hidden rounded-[22px] border border-[color-mix(in_oklch,var(--gold),transparent_70%)] lg:grid-cols-[1.25fr_1fr]">
      <div className="p-5 sm:p-7">
        <p className="page-section-label">{title}</p>
        <p className={cn("mt-2 text-[2.6rem] font-bold leading-none tracking-tight tabular-nums sm:text-6xl", net < 0 && "text-red-500")}><Sensitive>{eur(net)}</Sensitive></p>
        <p className="mt-3 max-w-xl text-sm text-foreground/85 sm:text-[15px]">
          {diffPct === null
            ? income === 0 && expenses === 0 ? "Todavía no hay movimientos en este periodo. Apunta el primero y verás aquí cómo vas." : `Has ingresado ${eur(income)} y gastado ${eur(expenses)}.`
            : diffPct >= 0
              ? <>Vas bien: llevas un <b className="font-semibold text-emerald-500">{diffPct} % menos de gasto</b> que {props.comparableLabel}.</>
              : <>Ojo: llevas un <b className="font-semibold text-red-500">{-diffPct} % más de gasto</b> que {props.comparableLabel}.</>}
          {props.isCurrentMonth && net > 0 && props.daysLeft > 0 && <> Puedes gastar unos <b className="font-semibold"><Sensitive>{eur(net / props.daysLeft)}</Sensitive> al día</b> hasta fin de mes.</>}
        </p>
        {(income > 0 || expenses > 0) && (
          <div className="mt-5">
            <div className="relative h-2.5 rounded-full bg-muted">
              <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[var(--gold)] to-[color-mix(in_oklch,var(--gold),white_25%)] transition-[width] duration-500" style={{ width: `${spentPct}%` }} />
              {tickPct !== null && <div className="absolute -top-1.5 h-[22px] w-0.5 rounded bg-foreground/70" style={{ left: `${tickPct}%` }} title={`Lo gastado ${props.comparableLabel}`} />}
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span><Sensitive>{eur(expenses)}</Sensitive> gastados de <Sensitive>{eur(income)}</Sensitive> ingresados</span>
              {comparable !== null && <span>│ {props.comparableLabel}: <Sensitive>{eur(comparable)}</Sensitive></span>}
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3 border-t border-border/70 bg-background/30 p-5 sm:p-6 lg:border-l lg:border-t-0">
        <div className="flex items-start justify-between gap-3">
          <Link href="/cuentas" className="min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <p className="page-section-label">Tu dinero · patrimonio</p>
            <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums"><Sensitive>{eur(props.netWorth)}</Sensitive></p>
            <p className="mt-0.5 text-xs text-muted-foreground">{props.accountsTotal} {props.accountsTotal === 1 ? "cuenta" : "cuentas"} ({props.accountsWithBalance} con saldo)</p>
          </Link>
          {props.netWorthDelta !== 0 && (
            <span className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", props.netWorthDelta > 0 ? "bg-emerald-500/12 text-emerald-500" : "bg-red-500/12 text-red-500")}>
              {props.netWorthDelta > 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
              <Sensitive>{props.netWorthDelta > 0 ? "+" : "−"}{eur(Math.abs(props.netWorthDelta))}</Sensitive> {props.netWorthDeltaLabel}
            </span>
          )}
        </div>
        {props.sparkline.length > 1 && <Sparkline values={props.sparkline} />}
        <div className="grid grid-cols-2 gap-2">
          <Link href="/cuentas" className={cn(TILE, "bg-background/40 p-3")}>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Wallet className="size-3.5 text-[var(--accent-blue)]" />Disponible</span>
            <span className="mt-0.5 block text-lg font-bold tabular-nums text-[var(--accent-blue)]"><Sensitive>{eur(props.available)}</Sensitive></span>
          </Link>
          <Link href="/inversiones" className={cn(TILE, "bg-background/40 p-3")}>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><ChartLineUp className="size-3.5 text-[var(--accent-violet)]" />Invertido</span>
            <span className="mt-0.5 block text-lg font-bold tabular-nums text-[var(--accent-violet)]"><Sensitive>{eur(props.invested)}</Sensitive></span>
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          <Sensitive>{eur(props.available)}</Sensitive> disponibles + <Sensitive>{eur(props.invested)}</Sensitive> invertidos
          {Math.abs(other) >= 1 && <> {other > 0 ? "+" : "−"} <Sensitive>{eur(Math.abs(other))}</Sensitive> en ahorro y otras cuentas</>}
        </p>
      </div>
    </section>
  )
}

function Sparkline({ values }: { values: number[] }) {
  const w = 300, h = 48
  const min = Math.min(...values), max = Math.max(...values)
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 4 - ((v - min) / (max - min || 1)) * (h - 10)])
  const d = "M" + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" L")
  const up = values[values.length - 1] >= values[0]
  const col = up ? "var(--accent-green)" : "var(--accent-red)"
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-12 w-full" aria-hidden>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={col} opacity={0.12} />
      <path d={d} fill="none" stroke={col} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

// ── Este mes: tres bloques ──────────────────────────────────────────────────
export function MonthTiles({ label, income, expenses, net, incomeCount, expenseCount, savingsRate, expenseChange, onOpen }: {
  label: string; income: number; expenses: number; net: number; incomeCount: number; expenseCount: number; savingsRate: number; expenseChange: number | null
  onOpen: (k: "ingresos" | "gastos" | "neto") => void
}) {
  const tiles = [
    { k: "ingresos" as const, title: "Ingresos", icon: HandCoins, color: "var(--accent-green)", value: income, bar: income > 0 ? 100 : 0, foot: `${incomeCount} ${incomeCount === 1 ? "movimiento" : "movimientos"}`, pill: null as ReactNode },
    { k: "gastos" as const, title: "Gastos", icon: Receipt, color: "var(--accent-red)", value: expenses, bar: income > 0 ? Math.min(100, (expenses / income) * 100) : expenses > 0 ? 100 : 0, foot: `${expenseCount} ${expenseCount === 1 ? "movimiento" : "movimientos"}${income > 0 ? ` · ${Math.round((expenses / income) * 100)} % de lo ingresado` : ""}`,
      pill: expenseChange === null ? null : <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", expenseChange <= 0 ? "bg-emerald-500/12 text-emerald-500" : "bg-red-500/12 text-red-500")}>{expenseChange > 0 ? "+" : ""}{expenseChange} %</span> },
    { k: "neto" as const, title: "Ahorro neto", icon: PiggyBank, color: net >= 0 ? "var(--gold)" : "var(--accent-red)", value: net, bar: Math.max(0, Math.min(100, savingsRate)), foot: income > 0 ? `Ahorras el ${savingsRate} % de lo que ingresas` : "Sin ingresos en el periodo",
      pill: income > 0 ? <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">{savingsRate} %</span> : null },
  ]
  return (
    <section aria-label={`Resumen de ${label}`}>
      <div className="mb-2.5 flex items-baseline justify-between gap-2 px-0.5">
        <h2 className="text-base font-semibold text-foreground first-letter:uppercase">{label}</h2>
        <span className="hidden text-xs text-muted-foreground sm:inline">Toca un bloque para ver el detalle</span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {tiles.map((t) => (
          <button key={t.k} type="button" onClick={() => onOpen(t.k)} className={cn(TILE, "flex min-w-0 flex-col gap-2 p-3 text-left sm:p-4")}>
            <span className="flex items-center justify-between gap-1 text-xs font-medium text-muted-foreground sm:text-sm">
              <span className="flex min-w-0 items-center gap-1.5"><t.icon className="hidden size-4 shrink-0 sm:block" style={{ color: t.color }} /><span className="truncate">{t.title}</span></span>
              <span className="hidden sm:inline">{t.pill}</span>
            </span>
            <span className="truncate text-base font-bold tabular-nums sm:text-2xl" style={{ color: t.color }}><Sensitive>{eur(t.value)}</Sensitive></span>
            <span className="h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${t.bar}%`, background: t.color }} /></span>
            <span className="line-clamp-2 text-[10.5px] leading-tight text-muted-foreground sm:text-xs">{t.foot}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

// ── Lo importante hoy ───────────────────────────────────────────────────────
export interface Insight { key: string; kind: "fijo" | "dispara" | "paso"; eyebrow: string; title: ReactNode; detail: ReactNode; href: string; cta: string; meta?: ReactNode }
const KIND = {
  fijo: { icon: CalendarClock, color: "var(--accent-blue)" },
  dispara: { icon: Flame, color: "var(--accent-red)" },
  paso: { icon: Target, color: "var(--accent-green)" },
}
export function ImportantToday({ items }: { items: Insight[] }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <section aria-label="Lo importante hoy">
      <div className="mb-2.5 flex items-baseline justify-between px-0.5">
        <h2 className="text-base font-semibold text-foreground">Lo importante hoy</h2>
        {items.length > 0 && <span className="text-xs text-muted-foreground">{items.length} {items.length === 1 ? "aviso" : "avisos"}</span>}
      </div>
      {items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Lightbulb className="size-5" /></span>
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">Todo en orden. Aquí verás tus próximos gastos fijos, categorías que se disparan y tu siguiente paso.</p>
          <Link href="/agenda" className="shrink-0 rounded-full bg-primary/12 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20">Gastos fijos</Link>
        </div>
      ) : (
        <div className={cn("grid gap-2.5 sm:gap-3", items.length >= 3 ? "md:grid-cols-3" : items.length === 2 ? "md:grid-cols-2" : "")}>
          {items.map((it) => {
            const K = KIND[it.kind]
            const isOpen = open === it.key
            return (
              <div key={it.key} className={cn(TILE, "flex min-w-0 flex-col gap-2.5 p-4")}>
                <button type="button" onClick={() => setOpen(isOpen ? null : it.key)} aria-expanded={isOpen} className="flex min-w-0 flex-col gap-2.5 text-left">
                  <span className="flex items-center gap-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ color: K.color, background: `color-mix(in oklch, ${K.color}, transparent 86%)` }}><K.icon className="size-[18px]" /></span>
                    <span className="page-section-label">{it.eyebrow}</span>
                  </span>
                  <span className="text-[15px] font-semibold leading-snug text-foreground">{it.title}</span>
                  <span className={cn("text-xs text-muted-foreground", !isOpen && "line-clamp-1 md:line-clamp-none")}>{it.detail}</span>
                </button>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <Link href={it.href} className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-primary hover:underline">{it.cta}<ArrowRight className="size-3.5" /></Link>
                  {it.meta && <span className="text-xs tabular-nums text-muted-foreground">{it.meta}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ── Gráfico: barras de ingresos/gastos + línea de ahorro ────────────────────
export interface ComboBucket { key: string; label: string; Ingresos: number; Gastos: number; "Ahorro neto": number }
export function CashflowComboChart({ data, activeKey, onSelect, showSavings }: { data: ComboBucket[]; activeKey?: string | null; onSelect: (key: string) => void; showSavings: boolean }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 640, H = 240, top = 12, bottom = 26
  const max = Math.max(1, ...data.map((b) => Math.max(b.Ingresos, b.Gastos))) * 1.08
  const min = Math.min(0, ...(showSavings ? data.map((b) => b["Ahorro neto"]) : [0]))
  const y = (v: number) => top + (H - top - bottom) * (1 - (v - min) / (max - min))
  const gw = W / data.length
  const bw = Math.min(30, gw * 0.27)
  const line = data.map((b, i) => [gw * i + gw / 2, y(b["Ahorro neto"])] as const)
  const h = hover !== null ? data[hover] : null
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-56 w-full sm:h-64" role="img" aria-label="Ingresos, gastos y ahorro por periodo">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1={0} x2={W} y1={y(min + (max - min) * f)} y2={y(min + (max - min) * f)} stroke="var(--border)" strokeOpacity={0.6} vectorEffect="non-scaling-stroke" />)}
        {min < 0 && <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--muted-foreground)" strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />}
        {data.map((b, i) => {
          const x = gw * i + gw / 2
          const dim = (activeKey && activeKey !== b.key) || (hover !== null && hover !== i)
          return (
            <g key={b.key} className="cursor-pointer" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => onSelect(b.key)}>
              <rect x={x - gw / 2 + 3} y={0} width={gw - 6} height={H - bottom + 4} rx={10} fill={hover === i || activeKey === b.key ? "color-mix(in oklch, var(--gold), transparent 92%)" : "transparent"} />
              <rect x={x - bw - 2} y={y(b.Ingresos)} width={bw} height={Math.max(0, y(0) - y(b.Ingresos))} rx={5} fill="var(--accent-green)" opacity={dim ? 0.35 : 0.9} />
              <rect x={x + 2} y={y(b.Gastos)} width={bw} height={Math.max(0, y(0) - y(b.Gastos))} rx={5} fill="var(--accent-red)" opacity={dim ? 0.35 : 0.9} />
            </g>
          )
        })}
        {showSavings && data.length > 1 && <path d={"M" + line.map((p) => p.join(",")).join(" L")} fill="none" stroke="var(--gold)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" pointerEvents="none" />}
      </svg>
      {showSavings && (
        <div className="pointer-events-none absolute inset-0 h-56 sm:h-64">
          {line.map((p, i) => <span key={i} className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--gold)] bg-background" style={{ left: `${(p[0] / W) * 100}%`, top: `${(p[1] / H) * 100}%` }} />)}
        </div>
      )}
      <div className="flex text-[11px] text-muted-foreground">{data.map((b) => <span key={b.key} className={cn("flex-1 truncate text-center first-letter:uppercase", activeKey === b.key && "font-semibold text-primary")}>{b.label}</span>)}</div>
      {h && hover !== null && (
        <div className="pointer-events-none absolute top-2 z-10 w-44 rounded-xl border border-border bg-popover p-2.5 text-xs shadow-lg" style={{ left: `clamp(0px, calc(${((hover + 0.5) / data.length) * 100}% - 88px), calc(100% - 176px))` }}>
          <p className="mb-1 font-semibold first-letter:uppercase">{h.label}</p>
          <p className="flex justify-between"><span className="text-emerald-500">Ingresos</span><Sensitive className="tabular-nums">{eur(h.Ingresos)}</Sensitive></p>
          <p className="flex justify-between"><span className="text-red-500">Gastos</span><Sensitive className="tabular-nums">{eur(h.Gastos)}</Sensitive></p>
          <p className="flex justify-between"><span className="text-primary">Ahorro</span><Sensitive className="tabular-nums">{eur(h["Ahorro neto"])}</Sensitive></p>
          <p className="mt-1 text-muted-foreground">Toca para ver el desglose</p>
        </div>
      )}
    </div>
  )
}
