import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { USUARIOS_DEMO } from "@/lib/datos";
import { formatearMonto, fmtFecha } from "@/lib/formato";
import type { TramoPago } from "@/lib/tesoreria";

export type LotePago = Database["public"]["Tables"]["lotes_pago"]["Row"];
export type FacturaLote = { factura_id: string; proveedor: string; banco: string | null; cuenta_beneficiario: string | null; factura: string; codigo: string | null; monto: number; moneda: string; monto_original: number; moneda_original: string };
export const lotesQuery = queryOptions({ queryKey: ["lotes-pago"], queryFn: async () => {
  const { data, error } = await supabase.from("lotes_pago").select("*").order("liberado_en", { ascending: false });
  if (error) throw error;
  return data;
} });
export function obtenerLotePendiente(tramos: TramoPago[], cuenta: string, hoy: string) {
  const pendientes = tramos.filter((t) => t.cuenta_pago === cuenta && t.estado === "programado" && !t.liberado_lote_id && t.fecha_pago >= hoy);
  const fecha = pendientes.map((t) => t.fecha_pago).sort()[0];
  const filas = pendientes.filter((t) => t.fecha_pago === fecha);
  return { fecha, filas, total: Math.round(filas.reduce((s, t) => s + t.monto_cuenta, 0) * 100) / 100, cantidad: new Set(filas.map((t) => t.decision.factura_id)).size };
}
export function validarLiberacion(total: number, saldo: number, usuario: string, comentario: string, moneda: string): string | null {
  if (!(total > 0)) return "No hay pagos por liberar.";
  if (total > saldo) return `Saldo insuficiente: faltan ${formatearMonto(total - saldo, moneda)}. Usa Pago parcial o Postergar.`;
  if (!USUARIOS_DEMO.some((u) => u === usuario)) return "Elige el usuario responsable.";
  if (!comentario.trim()) return "El comentario es obligatorio.";
  return null;
}
export function csvLote(lote: LotePago): string {
  const filas = lote.facturas_incluidas as unknown as FacturaLote[];
  const escapar = (valor: unknown) => `"${String(valor ?? "").replace(/^[=+@\-]/, "'$&").replace(/"/g, '""')}"`;
  return [["Lote", "Cuenta de origen", "Proveedor", "Banco beneficiario", "Cuenta beneficiario", "Factura", "Monto", "Moneda", "Fecha de pago", "Liberado por"], ...filas.map((f) => [lote.id, lote.cuenta, f.proveedor, f.banco, f.cuenta_beneficiario, f.factura, formatearMonto(f.monto, f.moneda), f.moneda, fmtFecha(lote.fecha_pago), lote.liberado_por])].map((f) => f.map(escapar).join(",")).join("\r\n");
}
export function descargarLote(lote: LotePago) {
  const url = URL.createObjectURL(new Blob(["\ufeff", csvLote(lote)], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a"); a.href = url; a.download = `${lote.id}.csv`; a.click(); URL.revokeObjectURL(url);
}