import { supabase } from '@/integrations/supabase/client';
import { construirContexto } from '@/lib/contexto';
import { diaGuatemala, fechaPura, viernesRecepcion } from '@/lib/fechas';
import { evaluarFactura, type FacturaEntrada, type ContextoMotor, type DecisionSalida } from '@/lib/motorReglas';
import type { ExtraccionFactura } from '@/lib/extraccion';
import type { Json } from '@/integrations/supabase/types';

/** Adaptación del contrato de fechas; las once reglas permanecen intactas. */
export function evaluarEntradaSegura(entrada: FacturaEntrada, ctx: ContextoMotor): DecisionSalida {
  const dia = diaGuatemala(entrada.fecha_recepcion);
  const fechaInvalida = !dia || Boolean(entrada.fecha_emision && !fechaPura(entrada.fecha_emision)) || Boolean(entrada.fecha_vencimiento && !fechaPura(entrada.fecha_vencimiento));
  const d = evaluarFactura({ ...entrada, fecha_recepcion: dia ?? '2000-01-01', ...(fechaInvalida ? { confianza_extraccion: 0 } : {}) }, ctx);
  if (!fechaInvalida) {
    if (d.decision !== 'PAGAR') return d;
    const fecha = viernesRecepcion(dia);
    return { ...d, fecha_programada_pago: fecha,
      motivo: fecha === d.fecha_programada_pago ? d.motivo : `Cumple los controles. Pago el viernes ${fecha?.split('-').reverse().join('/')} desde ${d.cuenta_pago}.` };
  }
  return { ...d, decision: 'ESCALAR', estado: 'pendiente_aprobacion', fecha_programada_pago: null, escalar_a: 'Finanzas', cotizacion_a_consumir: null,
    decidido_por: 'Pendiente de aprobación humana', motivo: 'No se pudo evaluar la fecha de recepción, emisión o vencimiento. Requiere revisión de Finanzas.',
    controles: d.controles.map((c) => c.regla === 'R9' ? { ...c, resultado: 'NO_EVALUABLE', si_falla: 'ESCALAR', detalle: 'Fecha vacía o inválida: no se puede determinar el período ni el calendario de pago.' } : c) };
}

export function errorProcesamiento(e: unknown): string {
  const mensaje = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? '');
  if (/duplicado|PAGO_DUPLICADO/i.test(mensaje)) return 'Esta factura ya tiene un pago aprobado. Vuelve a procesarla para revisar el duplicado.';
  if (/fecha|time value/i.test(mensaje)) return 'No se pudo procesar la fecha de la factura. Revisa las fechas e inténtalo de nuevo.';
  return 'No se pudo guardar la factura completa. No se guardaron cambios; inténtalo de nuevo.';
}

export async function guardarFacturaProcesada(params: {
  entrada: FacturaEntrada; decision: DecisionSalida; extraccion: ExtraccionFactura; modelo: string;
  archivoPath?: string | null; nombreArchivo?: string | null; textoOriginal?: string | null; pruebaId?: string;
}): Promise<string> {
  const { entrada, extraccion: ex, decision: d } = params;
  const { data, error } = await supabase.rpc('guardar_factura_procesada', {
    p_factura: { codigo: entrada.codigo ?? null, canal: entrada.canal ?? null, nombre_archivo: params.nombreArchivo ?? null, archivo_url: params.archivoPath ?? null,
      texto_original: params.textoOriginal ?? null, ...ex, confianza_extraccion: ex.confianza,
      fecha_emision: fechaPura(ex.fecha_emision), fecha_vencimiento: fechaPura(ex.fecha_vencimiento),
      fecha_recepcion: diaGuatemala(entrada.fecha_recepcion) ? (entrada.fecha_recepcion.length === 10 ? `${entrada.fecha_recepcion}T12:00:00-06:00` : entrada.fecha_recepcion) : null,
      prueba_flujo_id: params.pruebaId ?? null } as Json,
    p_decision: { ...d, fecha_programada_pago: fechaPura(d.fecha_programada_pago) } as unknown as Json,
    ...(d.cotizacion_a_consumir && !params.pruebaId ? { p_cotizacion: d.cotizacion_a_consumir } : {}),
    p_eventos: [
      { evento: 'recibida', actor: 'Agente (automático)', detalle: `Recibida por ${entrada.canal ?? 'carga manual'}` },
      { evento: 'extraida', actor: 'Agente (automático)', detalle: `Extraída con ${params.modelo} (confianza ${ex.confianza.toFixed(2)})` },
      { evento: 'decidida', actor: d.decidido_por, detalle: `${d.decision} — ${d.motivo}` },
    ],
  });
  if (error) throw error;
  return data;
}

// Serializa evaluar+guardar, no solo la extracción: cada siguiente ve el contexto confirmado.
let cola: Promise<unknown> = Promise.resolve();
export function procesarFacturaExtraida(params: Omit<Parameters<typeof guardarFacturaProcesada>[0], 'decision'>) {
  const trabajo = cola.catch(() => undefined).then(async () => {
    const ctx = await construirContexto(params.pruebaId ? { pruebaId: params.pruebaId } : undefined);
    const decision = evaluarEntradaSegura(params.entrada, ctx);
    const facturaId = await guardarFacturaProcesada({ ...params, decision });
    return { facturaId, decision };
  });
  cola = trabajo;
  return trabajo;
}