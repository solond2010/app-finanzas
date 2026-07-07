import { ImageResponse } from "next/og"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

// Versión grande del mismo icono (ver icon.tsx) para "Añadir a pantalla de
// inicio" en iOS. Sin bordes redondeados ni transparencia: iOS aplica su
// propia máscara de esquinas y sombra sobre el cuadrado completo.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000001",
        }}
      >
        <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#e0af3b" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
          <path d="M20 2v4" />
          <path d="M22 4h-4" />
          <circle cx="4" cy="20" r="2" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
