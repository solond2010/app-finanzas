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

  it("calcula precio en USD desde un aporte en EUR", () => {
    expect(guessCurrency({ symbol: "NVD.DE", name: "NVIDIA", type: "EQUITY", exchange: "GER" })).toBe("EUR")
    expect(isCryptoOrTokenized({ symbol: "WNVDAX-USD", name: "Wrapped NVIDIA Tokenized stock", type: "EQUITY" })).toBe(true)
    // 100 €, 2 títulos, 0,92 € por 1 USD → total 108,6956 USD → 54,3478 / título
    expect(buyPriceFromEurPaid(100, 2, 0.92)).toBeCloseTo(54.347826, 5)
  })
})
