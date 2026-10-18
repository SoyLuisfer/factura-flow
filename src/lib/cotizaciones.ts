import { supabase } from "@/integrations/supabase/client";
import type { DecisionSalida } from "@/lib/motorReglas";

/**
 * Si una decisión PAGAR consumió una cotización, la marca como utilizada
 * y registra el evento de auditoría. No hace nada en los demás casos.
 */
export async function consumirCotizacionSiAplica(
  decision: Pick<DecisionSalida, "decision" | "cotizacion_a_consumir">,
  facturaId: string,
  actor: string,
): Promise<void> {
  if (decision.decision !== "PAGAR" || !decision.cotizacion_a_consumir) return;
  const { error } = await supabase.rpc("marcar_cotizacion_utilizada", {
    p_contrato_id: decision.cotizacion_a_consumir,
    p_factura_id: facturaId,
    p_actor: actor,
  });
  // Si ya estaba utilizada (doble clic o reintento) no es un error para el usuario.
  if (error && !error.message.includes("COTIZACION_YA_UTILIZADA")) throw error;
}
