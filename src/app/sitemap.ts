import type { MetadataRoute } from "next"

const pages = ["/", "/login", "/precios", "/mcp", "/privacidad", "/terminos"] as const

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map((path) => ({
    url: `https://www.migarra.app${path === "/" ? "/" : path}`,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.6,
  }))
}
