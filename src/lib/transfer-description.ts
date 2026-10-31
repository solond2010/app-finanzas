// Texto de los dos movimientos de un traspaso: legible y sin flechas
// («Traspaso de Cuenta nómina a Ahorro viaje»). Si el usuario escribió una
// descripción propia, se mantiene delante («Viaje · de Cuenta nómina a …»).
// Solo se usa para traspasos nuevos; los ya guardados no se tocan.
export function transferDescription(descripcion: string | null | undefined, origen: string, destino: string): string {
  const own = (descripcion ?? "").trim()
  const route = `de ${origen} a ${destino}`
  if (!own || /^traspaso$/i.test(own)) return `Traspaso ${route}`
  return `${own} · ${route}`
}
