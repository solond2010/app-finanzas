import "server-only"

export const HIDE_ADMIN_NAV_COOKIE = "garra-hide-admin-nav"

export function isHiddenAdminNavValue(value: string | null | undefined): boolean {
  return value === "1" || value === "true"
}

export const HIDE_ADMIN_NAV_COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax" as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
}
