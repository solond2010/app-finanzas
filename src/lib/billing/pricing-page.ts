// Textos y enlaces de la página pública /precios.
// Precios y límites salen de PRICES_EUR y entitlementsFor; no se copian a mano.

import { publicLifetimeOffer, type PublicLifetimeOffer } from "./black-friday"
import { entitlementsFor, PRICES_EUR, type Entitlements } from "./plans"
import { MONTHLY_NOTE_WITHOUT_TRIAL, MONTHLY_TRIAL_BADGE, monthlyTrialNote } from "./monthly-trial"

export const PRICING_SIGNUP_HREF = "/login?modo=registro"
export const PRICING_PLAN_HREF = "/configuracion#plan"

export type PricingFeature = { label: string; included: boolean }

export type PricingPlanId = "free" | "pro_monthly" | "pro_lifetime"

export function formatPriceEur(amount: number): string {
  return amount.toLocaleString("es-ES", { style: "currency", currency: "EUR" })
}

/** Qué incluye un plan, según las reglas reales de entitlementsFor (pagos activos). */
export function pricingFeaturesFor(plan: "free" | "pro"): PricingFeature[] {
  const entitlements = entitlementsFor(plan, true)
  return featuresFromEntitlements(entitlements)
}

export function featuresFromEntitlements(entitlements: Entitlements): PricingFeature[] {
  return [
    {
      label: entitlements.maxAccounts === null ? "Cuentas ilimitadas" : `Hasta ${entitlements.maxAccounts} cuentas`,
      included: true,
    },
    {
      label: entitlements.maxGoals === null ? "Metas de ahorro ilimitadas" : `Hasta ${entitlements.maxGoals} metas de ahorro`,
      included: true,
    },
    {
      label: entitlements.investments ? "Inversiones" : "Sin inversiones",
      included: entitlements.investments,
    },
    {
      label: entitlements.netWorthHistory ? "Historial de patrimonio" : "Sin historial de patrimonio",
      included: entitlements.netWorthHistory,
    },
    {
      label: entitlements.advancedAnalytics ? "Análisis avanzado" : "Sin análisis avanzado",
      included: entitlements.advancedAnalytics,
    },
    {
      label: entitlements.export ? "Exportación" : "Sin exportación",
      included: entitlements.export,
    },
  ]
}

export function pricingStartHref(signedIn: boolean): string {
  return signedIn ? "/dashboard" : PRICING_SIGNUP_HREF
}

/** «Hazte Pro»: a la tarjeta de plan si hay sesión; si no, a registrarse y volver ahí. */
export function pricingProHref(signedIn: boolean): string {
  if (signedIn) return PRICING_PLAN_HREF
  return `${PRICING_SIGNUP_HREF}&redirect=${encodeURIComponent(PRICING_PLAN_HREF)}`
}

export function pricingFaqItems(free: Entitlements = entitlementsFor("free", true), offerMonthlyTrial = true): { q: string; a: string }[] {
  const accounts = free.maxAccounts
  const goals = free.maxGoals
  const limits =
    accounts !== null && goals !== null
      ? ` En Gratis no podrás añadir más de ${accounts} cuentas o ${goals} metas, ni usar inversiones, historial, análisis avanzado o exportación, pero nada de lo que ya tienes se elimina.`
      : " Nada de lo que ya tienes se elimina."
  return [
    ...(offerMonthlyTrial
      ? [{
          q: "¿El primer mes del Pro mensual es gratis?",
          a: "Sí. Dejas la tarjeta, no se cobra nada el primer mes y a partir del 2.º mes se cobra " + formatPriceEur(PRICES_EUR.pro_monthly) + " al mes. Puedes cancelar cuando quieras; si lo haces durante la prueba, no hay cobro.",
        }]
      : []),
    {
      q: "¿Puedo cancelar cuando quiera?",
      a: offerMonthlyTrial
        ? "Sí. Después del mes de prueba, la suscripción se renueva cada mes a " + formatPriceEur(PRICES_EUR.pro_monthly) + " y puedes cancelarla cuando quieras. Si cancelas durante la prueba, no se realiza el cobro."
        : "Sí. La suscripción mensual se renueva cada mes y puedes cancelarla cuando quieras. Sigues con Pro hasta el final del periodo ya pagado.",
    },
    {
      q: "Si bajo a Gratis, ¿se borra algo?",
      a: `No. Tus cuentas, movimientos y metas se quedan.${limits}`,
    },
    {
      q: "¿El pago es seguro?",
      a: "Sí. El cobro lo procesa Stripe. Garra no guarda los datos de tu tarjeta.",
    },
    {
      q: "¿Puedo probarla antes de registrarme?",
      a: "Sí. La demo funciona sin cuenta, con datos de ejemplo, y nada se guarda.",
    },
  ]
}

export function pricingCatalog(options?: { offerMonthlyTrial?: boolean; now?: Date | number }) {
  const offerMonthlyTrial = options?.offerMonthlyTrial !== false
  const now = options?.now ?? Date.now()
  const free = entitlementsFor("free", true)
  const pro = entitlementsFor("pro", true)
  const offer = publicLifetimeOffer(now)
  return {
    monthlyPrice: formatPriceEur(PRICES_EUR.pro_monthly),
    lifetimePrice: formatPriceEur(PRICES_EUR.pro_lifetime),
    lifetimeSalePrice: offer ? formatPriceEur(offer.salePrice) : null,
    lifetimeOffer: offer as PublicLifetimeOffer | null,
    offerMonthlyTrial,
    monthlyBadge: offerMonthlyTrial ? MONTHLY_TRIAL_BADGE : "Recomendado",
    monthlyNote: offerMonthlyTrial ? monthlyTrialNote() : MONTHLY_NOTE_WITHOUT_TRIAL,
    freeFeatures: featuresFromEntitlements(free),
    proFeatures: featuresFromEntitlements(pro),
    faq: pricingFaqItems(free, offerMonthlyTrial),
  }
}
