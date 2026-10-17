import type { TipoDecision } from "@/lib/datos";

/** "USD 7,550.65" — monto con separador de miles y moneda visible. */
export function fmtMonto(n: number | null | undefined, moneda?: string | null): string {
  if (n == null) return "—";
  const v = n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return moneda ? `${moneda} ${v}` : v;
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

/** "17/10/2026 13:52" */
export function fmtFechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-GT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
}

/** Clases de insignia por decisión: PAGAR verde, FRENAR rojo, ESCALAR ámbar, POSTERGAR azul. */
export const ESTILO_DECISION: Record<TipoDecision, string> = {
  PAGAR: "bg-decision-pagar text-decision-pagar-foreground",
  FRENAR: "bg-decision-frenar text-decision-frenar-foreground",
  ESCALAR: "bg-decision-escalar text-decision-escalar-foreground",
  POSTERGAR: "bg-decision-postergar text-decision-postergar-foreground",
};

export const ETIQUETA_DECISION: Record<TipoDecision, string> = {
  PAGAR: "PAGAR",
  FRENAR: "FRENAR",
  ESCALAR: "ESCALAR",
  POSTERGAR: "POSTERGAR",
};
