import { describe, expect, it } from "vitest"
import { VIEWPORT_COLLISION_EXTRA_PX, viewportCollisionPadding } from "./viewport-collision-padding"

describe("viewportCollisionPadding", () => {
  it("en escritorio, sin safe area, deja un margen mínimo en los cuatro lados", () => {
    expect(viewportCollisionPadding({ top: 0, right: 0, bottom: 0, left: 0 })).toEqual({
      top: VIEWPORT_COLLISION_EXTRA_PX,
      right: VIEWPORT_COLLISION_EXTRA_PX,
      bottom: VIEWPORT_COLLISION_EXTRA_PX,
      left: VIEWPORT_COLLISION_EXTRA_PX,
    })
  })

  it("en un iPhone con Dynamic Island y home indicator, el popup no invade la safe area", () => {
    // Insets típicos de un iPhone 14/15/17 Pro en vertical (viewport-fit: cover).
    const padding = viewportCollisionPadding({ top: 59, right: 0, bottom: 34, left: 0 })
    expect(padding.top).toBe(59 + VIEWPORT_COLLISION_EXTRA_PX)
    expect(padding.bottom).toBe(34 + VIEWPORT_COLLISION_EXTRA_PX)
    expect(padding.left).toBe(VIEWPORT_COLLISION_EXTRA_PX)
    expect(padding.right).toBe(VIEWPORT_COLLISION_EXTRA_PX)
    // En un viewport 390×844 el panel queda entre y=67 y y=802, lejos del notch y del indicador.
    const viewportHeight = 844
    const top = padding.top
    const bottom = viewportHeight - padding.bottom
    expect(top).toBeGreaterThanOrEqual(59)
    expect(viewportHeight - bottom).toBeGreaterThanOrEqual(34)
    expect(bottom - top).toBeGreaterThan(600)
  })
})
