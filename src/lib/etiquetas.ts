import type { TipoDecision } from "@/lib/datos";

/**
 * Nombres de las decisiones para mostrar en pantalla (pasado).
 * Internamente se siguen guardando PAGAR / FRENAR / ESCALAR / POSTERGAR.
 * "Rechazado" se usa solo cuando una persona rechaza una factura escalada.
 */
export const ETIQUETA_DECISION: Record<TipoDecision, string> = {
  PAGAR: "Aprobado",
  FRENAR: "Frenado",
  ESCALAR: "Escalado",
  POSTERGAR: "Pospuesto",
};

/** Etiqueta de pantalla considerando el estado (rechazo humano). Acepta el string crudo de la base. */
export function etiquetaDecision(decision: string, estado?: string | null): string {
  if (estado === "rechazada_humano") return "Rechazado";
  return ETIQUETA_DECISION[decision as TipoDecision] ?? decision;
}
