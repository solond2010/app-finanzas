import { describe, expect, it } from "vitest"
import { buyPriceFromEurPaid, filterSearchResults, guessCurrency, isCryptoOrTokenized } from "./asset-search-helpers"

describe("buscador de activos", () => {
  it("oculta crypto/tokenizados en Acciones/ETF y prioriza EUR", () => {
    const hits = [
      { symbol: "NVDA", name: "NVIDIA Corporation", type: "EQUITY", exchange: "NMS" },
      { symbol: "NVD.DE", name: "NVIDIA Corporation", type: "EQUITY", exchange: "GER" },
      { symbol: "NVDAON-USD", name: "NVIDIA Tokenized Stock (Ondo) USD", type: "EQUITY", exchange: "CCC" },
      { symbol: "BTC-USD", name: "Bitcoin USD", type: "CRYPTOCURRENCY", exchange: "CCC" },
      { symbol: "NVDX", name: "T-Rex 2X Long NVIDIA Daily Target ETF", type: "ETF", exchange: "NGM" },
    ]
    const out = filterSearchResults(hits, ["EQUITY", "ETF"])
    expect(out.map((r) => r.symbol)).toEqual(["NVD.DE", "NVDA", "NVDX"])
    expect(out[0].currency).toBe("EUR")
  })

  it("Alphabet/Google: EUR (ABEA.DE) primero y USD visible; .F cuenta como EUR", () => {
    const hits = [
      { symbol: "GOOG", name: "Alphabet Inc.", type: "EQUITY", exchange: "NMS" },
      { symbol: "GOOGL", name: "Alphabet Inc.", type: "EQUITY", exchange: "NMS" },
      { symbol: "ABEA.DE", name: "Alphabet Inc.", type: "EQUITY", exchange: "GER" },
      { symbol: "ABEC.DE", name: "Alphabet Inc.", type: "EQUITY", exchange: "GER" },
      { symbol: "ABEA.F", name: "Alphabet Inc.", type: "EQUITY", exchange: "FRA" },
      { symbol: "RGOOGL-USD", name: "Google Tokenized Stock (Reality) USD", type: "CRYPTOCURRENCY", exchange: "CCC" },
    ]
    const out = filterSearchResults(hits, ["EQUITY", "ETF"])
    expect(out.filter((r) => r.currency === "EUR").map((r) => r.symbol)).toEqual(
      expect.arrayContaining(["ABEA.DE", "ABEC.DE", "ABEA.F"]),
    )
    expect(out.some((r) => r.symbol === "GOOGL" && r.currency === "USD")).toBe(true)
    expect(out.every((r) => r.symbol !== "RGOOGL-USD")).toBe(true)
    expect(guessCurrency({ symbol: "ABEA.F", name: "Alphabet", type: "EQUITY", exchange: "FRA" })).toBe("EUR")
    expect(isCryptoOrTokenized({ symbol: "RGOOGL-USD", name: "Google Tokenized Stock", type: "CRYPTOCURRENCY" })).toBe(true)
    expect(buyPriceFromEurPaid(100, 2, 0.92)).toBeCloseTo(54.347826, 5)
  })
})
