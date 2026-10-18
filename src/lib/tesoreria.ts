import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { DecisionConRelaciones } from "@/lib/datos";
import type { DecisionSalida } from "@/lib/motorReglas";

export type ProgramacionPago = Database["public"]["Tables"]["programacion_pagos"]["Row"];
export type TramoPago = { id: string | null; decision: DecisionConRelaciones; monto: number; moneda: string; monto_usd: number; monto_cuenta: number; cuenta_pago: string; fecha_pago: string; estado: "programado" | "pospuesto" };
export const programacionQuery = queryOptions({ queryKey: ["programacion-pagos"], queryFn: async () => {
  const { data, error } = await supabase.from("programacion_pagos").select("*");
  if (error) throw error;
  return data;
} });

export function siguienteViernes(fecha: string, siguiente = false): string {
  const d = new Date(`${fecha.slice(0, 10)}T12:00:00Z`);
  const delta = (5 - d.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + (delta === 0 || siguiente ? (delta || 7) : delta));
  return d.toISOString().slice(0, 10);
}
export function hoyGuatemala(): string { return new Date().toLocaleDateString("en-CA", { timeZone: "America/Guatemala" }); }

export function obtenerTramos(decisiones: DecisionConRelaciones[], programaciones: ProgramacionPago[], cuentas: { id: string; moneda: string }[], tasas: { moneda: string; por_usd: number }[]): TramoPago[] {
  const ultimas = new Map<string, DecisionConRelaciones>();
  for (const d of decisiones) {
    const previa = ultimas.get(d.factura_id);
    if (!previa || d.decidido_en > previa.decidido_en) ultimas.set(d.factura_id, d);
  }
  return [...ultimas.values()].flatMap((d): TramoPago[] => {
    if (!["PAGAR", "POSTERGAR"].includes(d.decision) || d.estado === "rechazada_humano") return [];
    const propias = programaciones.filter((p) => p.decision_id === d.id);
    if (propias.length) return propias.map((p) => ({ ...p, decision: d, estado: p.estado === "programado" ? "programado" : "pospuesto" }));
    const cuenta = cuentas.find((c) => c.id === d.cuenta_pago);
    if (!cuenta || !d.fecha_programada_pago || d.factura?.monto == null || !d.factura.moneda) return [];
    const tasa = cuenta.moneda === "USD" ? 1 : tasas.find((t) => t.moneda === cuenta.moneda)?.por_usd;
    let montoCuenta = cuenta.moneda === d.factura.moneda ? d.factura.monto : Math.round((d.monto_usd ?? 0) * (tasa ?? 0) * 100) / 100;
    const ajuste = d.ajuste as { conversion?: { monto_final?: number } } | null;
    if (typeof ajuste?.conversion?.monto_final === "number") montoCuenta = Math.min(montoCuenta, ajuste.conversion.monto_final);
    return [{ id: null, decision: d, monto: d.factura.monto, moneda: d.factura.moneda, monto_usd: d.monto_usd ?? 0, monto_cuenta: montoCuenta, cuenta_pago: cuenta.id, fecha_pago: d.fecha_programada_pago, estado: d.decision === "PAGAR" ? "programado" : "pospuesto" }];
  });
}

/** Un registro devengado R9 y registros de caja R10 sin categoría para no contar presupuesto dos veces. */
export function adaptarProgramacion(decision: DecisionSalida, pagos: Pick<ProgramacionPago, "estado" | "cuenta_pago" | "fecha_pago" | "monto_cuenta">[]): DecisionSalida[] {
  if (decision.decision !== "PAGAR" && !(decision.decision === "POSTERGAR" && pagos.length)) return [decision];
  const devengado = { ...decision, decision: "PAGAR" as const, monto_cuenta: 0, fecha_programada_pago: null };
  const caja = pagos.filter((p) => p.estado === "programado").map((p) => ({ ...decision, decision: "PAGAR" as const, categoria: null, periodo: null, monto_usd: 0, cuenta_pago: p.cuenta_pago, monto_cuenta: p.monto_cuenta, fecha_programada_pago: p.fecha_pago }));
  return [devengado, ...caja];
}

export function validarAccion(tramo: Pick<TramoPago, "monto" | "fecha_pago">, accion: string, monto: number, fecha: string, actor: string, comentario: string): string | null {
  if (!actor) return "Elige el usuario responsable.";
  if (!comentario.trim()) return "El comentario es obligatorio.";
  if (accion === "parcial" && (!Number.isFinite(monto) || monto <= 0 || monto >= tramo.monto || Math.round(monto * 100) !== monto * 100)) return "El pago parcial debe ser mayor que cero y menor que el total, con máximo dos decimales.";
  if (accion !== "reprogramar" && (!fecha || fecha <= tramo.fecha_pago)) return "La nueva fecha debe ser posterior a la fecha programada actual.";
  return null;
}