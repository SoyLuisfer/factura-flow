import type { TipoDecision } from "@/lib/datos";

/** Formato único de importes, también para CSV y campos. */
export function formatearMonto(n: number | null | undefined, moneda?: string | null): string {
  if (n == null) return "—";
  const v = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const prefijo = moneda === "GTQ" ? "Q " : moneda === "USD" ? "US$ " : moneda ? `${moneda} ` : "";
  return n < 0 ? `(${prefijo}${v})` : `${prefijo}${v}`;
}

export const fmtMonto = formatearMonto;
export function leerMonto(valor: string): number { return Number(valor.replace(/,/g, "").trim()); }
export function formatearPorcentaje(valor: number): string { return `${Number(valor.toFixed(1))} %`; }
export function formatearTipoCambio(valor: number): string { return `${formatearMonto(valor, "GTQ")} por ${formatearMonto(1, "USD")}`; }
/** Solo presentación de textos de reglas/auditoría: el motor no se modifica. */
export function formatearTextoNumerico(texto: string): string {
  return texto.replace(/\b(USD|GTQ)\s+(-?\d[\d,]*(?:\.\d+)?)/g, (_, moneda: string, valor: string) => formatearMonto(leerMonto(valor), moneda))
    .replace(/(-?\d+(?:\.\d+)?)%/g, (_, valor: string) => formatearPorcentaje(Number(valor)));
}

/** "23/10/2026" */
export function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00Z" : iso);
  return d.toLocaleDateString("es-GT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

/** "viernes 23/10" */
export function fmtFechaCorta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00Z" : iso);
  const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  return `${dias[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

/** "17/10/2026 19:52" — hora de Guatemala (UTC-6). */
export function fmtFechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-GT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Guatemala" });
}

/** Clases de insignia por decisión: PAGAR verde, FRENAR rojo, ESCALAR ámbar, POSTERGAR azul. */
export const ESTILO_DECISION: Record<TipoDecision, string> = {
  PAGAR: "bg-decision-pagar text-decision-pagar-foreground",
  FRENAR: "bg-decision-frenar text-decision-frenar-foreground",
  ESCALAR: "bg-decision-escalar text-decision-escalar-foreground",
  POSTERGAR: "bg-decision-postergar text-decision-postergar-foreground",
};

// Las etiquetas de decisión en pantalla viven en src/lib/etiquetas.ts (fuente única).
export { ETIQUETA_DECISION, etiquetaDecision } from "@/lib/etiquetas";
