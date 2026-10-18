import { supabase } from "@/integrations/supabase/client";
import type { ContextoMotor, DecisionSalida, FacturaRecibidaLike, ParametrosPolitica, TipoDecision } from "@/lib/motorReglas";
import { adaptarProgramacion } from "@/lib/tesoreria";
import { diaGuatemala } from "@/lib/fechas";

/**
 * Construye el contexto del motor leyendo la base de datos.
 * Con incluirHistorial (por defecto) incluye TODAS las facturas y decisiones
 * ya guardadas, para que R3 (duplicados), R9 (presupuesto) y R10 (saldo)
 * consideren lo que ya existe y no solo el lote en curso.
 */
export async function construirContexto(opciones?: { incluirHistorial?: boolean; pruebaId?: string }): Promise<ContextoMotor> {
  const incluirHistorial = opciones?.incluirHistorial ?? true;

  const [politica, tiposCambio, proveedores, contratos, cuentas, pagosPrevios, facturas, decisiones, programacion] = await Promise.all([
    supabase.from("politicas").select("*").eq("vigente", true).limit(1).maybeSingle(),
    supabase.from("tipos_cambio").select("*"),
    supabase.from("proveedores").select("*"),
    supabase.from("contratos").select("*"),
    supabase.from("cuentas_bancarias").select("*"),
    supabase.from("pagos_previos").select("*"),
    incluirHistorial
      ? (opciones?.pruebaId
          ? supabase.from("facturas").select("id, codigo, emisor, numero, fecha_recepcion, canal, monto, moneda").eq("prueba_flujo_id", opciones.pruebaId)
          : supabase.from("facturas").select("id, codigo, emisor, numero, fecha_recepcion, canal, monto, moneda").is("prueba_flujo_id", null))
      : Promise.resolve({ data: [], error: null }),
    incluirHistorial
      ? supabase.from("decisiones").select("*, factura:facturas!decisiones_factura_id_fkey(id, numero, fecha_recepcion, monto, moneda)")
      : Promise.resolve({ data: [], error: null }),
    incluirHistorial ? supabase.from("programacion_pagos").select("*") : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [politica, tiposCambio, proveedores, contratos, cuentas, pagosPrevios, facturas, decisiones, programacion]) {
    if (r.error) throw r.error;
  }
  if (!politica.data) throw new Error("No hay política vigente");

  const tasas = tiposCambio.data ?? [];
  const cuentasLista = cuentas.data ?? [];

  // Última decisión por factura (para saber si una recepción previa sigue viva)
  type FilaDecision = {
    id: string;
    factura_id: string;
    decision: TipoDecision;
    estado: string;
    decidido_en: string;
    monto_usd: number | null;
    categoria: string | null;
    cuenta_pago: string | null;
    fecha_programada_pago: string | null;
    proveedor_id: string | null;
    factura: { id: string; numero: string | null; fecha_recepcion: string | null; monto: number | null; moneda: string | null } | null;
  };
  const idsVisibles = new Set((facturas.data ?? []).map((f) => f.id));
  const filas = ((decisiones.data ?? []) as unknown as FilaDecision[]).filter((d) => idsVisibles.has(d.factura_id));
  const ultimaPorFactura = new Map<string, FilaDecision>();
  for (const d of filas) {
    const prev = ultimaPorFactura.get(d.factura_id);
    if (!prev || d.decidido_en > prev.decidido_en) ultimaPorFactura.set(d.factura_id, d);
  }

  const facturasRecibidas: FacturaRecibidaLike[] = (facturas.data ?? []).map((f) => ({
    id: f.id,
    codigo: f.codigo ?? undefined,
    emisor: f.emisor,
    numero: f.numero,
    fecha_recepcion: diaGuatemala(f.fecha_recepcion) ?? "",
    canal: f.canal,
    decision: ultimaPorFactura.get(f.id)?.decision,
  }));

  const decisionesPrevias: DecisionSalida[] = [...ultimaPorFactura.values()].flatMap((d): DecisionSalida[] => {
    const cuenta = d.cuenta_pago ? cuentasLista.find((c) => c.id === d.cuenta_pago) : undefined;
    const f = d.factura;
    let montoCuenta: number | null = null;
    if (cuenta && f?.monto != null && f.moneda) {
      if (f.moneda === cuenta.moneda) montoCuenta = f.monto;
      else if (d.monto_usd != null) {
        const tasa = cuenta.moneda === "USD" ? 1 : tasas.find((t) => t.moneda === cuenta.moneda)?.por_usd;
        if (tasa) montoCuenta = Math.round(d.monto_usd * tasa * 100) / 100;
      }
    }
    const registro: DecisionSalida = {
      decision: d.decision,
      controles: [],
      motivo: "",
      monto_usd: d.monto_usd,
      proveedor_id: d.proveedor_id,
      categoria: d.categoria,
      cuenta_pago: d.cuenta_pago,
      fecha_programada_pago: d.fecha_programada_pago,
      escalar_a: null,
      factura_relacionada_id: null,
      politica_version: "",
      estado: d.estado === "pendiente_aprobacion" ? "pendiente_aprobacion" : "final",
      decidido_por: "",
      monto_cuenta: montoCuenta,
      moneda_cuenta: cuenta?.moneda ?? null,
      periodo: (diaGuatemala(f?.fecha_recepcion) ?? '').slice(0, 7),
    };
    const pagos = (programacion.data ?? []).filter((p) => p.decision_id === d.id);
    return pagos.length ? adaptarProgramacion(registro, pagos) : [registro];
  });

  const codigoPorFactura = new Map((facturas.data ?? []).map((f) => [f.id, f.codigo ?? f.numero ?? f.id]));

  return {
    politicaVersion: politica.data.version,
    parametros: politica.data.parametros as unknown as ParametrosPolitica,
    tiposCambio: tasas,
    proveedores: proveedores.data ?? [],
    contratos: (contratos.data ?? []).map((c) => ({
      ...c,
      factura_uso: c.factura_id_uso ? (codigoPorFactura.get(c.factura_id_uso) ?? null) : null,
    })),
    cuentas: cuentasLista,
    pagosPrevios: pagosPrevios.data ?? [],
    decisionesPrevias,
    facturasRecibidas,
  };
}
