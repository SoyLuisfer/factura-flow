import { supabase } from '@/integrations/supabase/client';
import { CASOS_PRUEBA } from '@/lib/casosPrueba';
import { procesarFacturaExtraida } from '@/lib/procesamiento';
import { obtenerTramos } from '@/lib/tesoreria';
import { obtenerLotePendiente } from '@/lib/lotes';
import { construirContexto } from '@/lib/contexto';
import type { DecisionConRelaciones } from '@/lib/datos';
import type { ExtraccionFactura } from '@/lib/extraccion';

export async function verificarFlujoReal(): Promise<{ ok: boolean; detalle: string }> {
  const pruebaId = crypto.randomUUID();
  let cantidad = 0;
  try {
    const casos = [...CASOS_PRUEBA].sort((a,b) => a.fecha_recepcion.localeCompare(b.fecha_recepcion) || a.codigo.localeCompare(b.codigo));
    for (const c of casos) {
      const ex: ExtraccionFactura = { ...c, fecha_vencimiento: c.fecha_vencimiento ?? null, pago_banco: c.pago_banco ?? null, pago_cuenta: c.pago_cuenta ?? null, confianza: 1, campos_dudosos: [] };
      // Instante con zona, no fecha pura: reproduce exactamente el contrato de subida.
      const entrada = { ...c, confianza_extraccion: 1, fecha_recepcion: `${c.fecha_recepcion}T12:00:00-06:00` };
      const { facturaId, decision } = await procesarFacturaExtraida({ entrada, extraccion: ex, modelo: 'Datos de prueba', pruebaId });
      const [factura, decisiones, pagos, eventos] = await Promise.all([
        supabase.from('facturas').select('*').eq('id', facturaId).single(),
        supabase.from('decisiones').select('*').eq('factura_id', facturaId).single(),
        supabase.from('programacion_pagos').select('*').eq('factura_id', facturaId),
        supabase.from('registro_eventos').select('*').eq('factura_id', facturaId),
      ]);
      for (const r of [factura, decisiones, pagos, eventos]) if (r.error) throw r.error;
      if (decision.decision !== c.esperado || decisiones.data?.decision !== c.esperado || decisiones.data?.fecha_programada_pago !== c.fecha_esperada) throw new Error(`${c.codigo}: ${decision.decision}/${decisiones.data?.decision}, fecha ${decisiones.data?.fecha_programada_pago}; esperado ${c.esperado}/${c.fecha_esperada}.`);
      if (!factura.data || !decisiones.data || eventos.data?.length !== 3) throw new Error(`${c.codigo}: guardado incompleto.`);
      if (['PAGAR','POSTERGAR'].includes(c.esperado)) {
        const ctx = await construirContexto({ pruebaId });
        const tramos = obtenerTramos([{ ...decisiones.data, factura: factura.data, proveedor: null } as DecisionConRelaciones], pagos.data ?? [], ctx.cuentas, ctx.tiposCambio);
        if (tramos.length !== 1 || tramos[0]?.fecha_pago !== c.fecha_esperada || !(tramos[0]?.monto_cuenta > 0)) throw new Error(`${c.codigo}: tesorería inválida.`);
        if (c.esperado === 'PAGAR' && !obtenerLotePendiente(tramos, decision.cuenta_pago ?? '', c.fecha_recepcion).fecha) throw new Error(`${c.codigo}: falta en calendario.`);
      } else if (pagos.data?.length) throw new Error(`${c.codigo}: pago no autorizado.`);
      cantidad++;
    }
    return { ok: cantidad === 18, detalle: `${cantidad}/18 con decisión, fecha, tesorería y calendario correctos.` };
  } catch (e) {
    return { ok: false, detalle: e instanceof Error ? e.message : 'No se pudo completar el guardado temporal.' };
  } finally {
    const { error } = await supabase.rpc('limpiar_prueba_flujo', { p_prueba: pruebaId });
    if (error) throw new Error('No se pudieron limpiar los datos temporales.');
    const { count, error: lectura } = await supabase.from('facturas').select('id', { count: 'exact', head: true }).eq('prueba_flujo_id', pruebaId);
    if (lectura || count !== 0) throw new Error('La limpieza de datos temporales no se confirmó.');
  }
}