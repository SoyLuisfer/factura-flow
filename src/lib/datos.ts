import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type T = Database["public"]["Tables"];
export type Empresa = T["empresa"]["Row"];
export type CuentaBancaria = T["cuentas_bancarias"]["Row"];
export type Politica = T["politicas"]["Row"];
export type TipoCambio = T["tipos_cambio"]["Row"];
export type Proveedor = T["proveedores"]["Row"];
export type Contrato = T["contratos"]["Row"];
export type PagoPrevio = T["pagos_previos"]["Row"];
export type Factura = T["facturas"]["Row"];
export type Decision = T["decisiones"]["Row"];
export type EventoRegistro = T["registro_eventos"]["Row"];

export type TipoDecision = "PAGAR" | "FRENAR" | "ESCALAR" | "POSTERGAR";
export type EstadoDecision = "final" | "pendiente_aprobacion" | "aprobada_humano" | "rechazada_humano";
export type ResultadoControl = "OK" | "FALLA" | "NO_EVALUABLE" | "NO_APLICA";

export const USUARIOS_DEMO = ["Luis Samayoa (Finanzas)", "Ana Morales (Contabilidad)"] as const;
export const ACTOR_AGENTE = "Agente (automático)";

/** Carga los datos maestros solo si la base está vacía. Devuelve true si cargó. */
export async function seedDemo(): Promise<boolean> {
  const { data, error } = await supabase.rpc("seed_demo_si_vacio");
  if (error) throw error;
  return Boolean(data);
}

/** Borra facturas, decisiones y eventos, y recarga los datos maestros. */
export async function reiniciarDemo(): Promise<void> {
  const { error } = await supabase.rpc("reiniciar_demo");
  if (error) throw error;
}

export const proveedoresQuery = queryOptions({
  queryKey: ["proveedores"],
  queryFn: async () => {
    await seedDemo();
    const { data, error } = await supabase.from("proveedores").select("*").order("id");
    if (error) throw error;
    return data;
  },
});

export const empresaQuery = queryOptions({
  queryKey: ["empresa"],
  queryFn: async () => {
    await seedDemo();
    const { data, error } = await supabase.from("empresa").select("*").limit(1).maybeSingle();
    if (error) throw error;
    return data;
  },
});

export const facturasQuery = queryOptions({
  queryKey: ["facturas"],
  queryFn: async () => {
    await seedDemo();
const { data, error } = await supabase.from("facturas").select("*").is("prueba_flujo_id", null).order("fecha_recepcion").order("codigo");
    if (error) throw error;
    return data;
  },
});

export type DecisionConRelaciones = Decision & { factura: Factura | null; proveedor: Proveedor | null };

/** Decisiones con su factura y proveedor, más recientes primero. */
export const decisionesQuery = queryOptions({
  queryKey: ["decisiones"],
  queryFn: async () => {
    await seedDemo();
    const { data, error } = await supabase
      .from("decisiones")
      .select("*, factura:facturas!decisiones_factura_id_fkey(*), proveedor:proveedores(*)")
      .order("decidido_en", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as unknown as DecisionConRelaciones[]).filter((d) => d.factura && !d.factura.prueba_flujo_id);
  },
});

export const eventosQuery = queryOptions({
  queryKey: ["eventos"],
  queryFn: async () => {
    await seedDemo();
    const { data, error } = await supabase.from("registro_eventos").select("*").order("fecha_hora", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const politicasQuery = queryOptions({
  queryKey: ["politicas"],
  queryFn: async () => {
    await seedDemo();
    const { data, error } = await supabase.from("politicas").select("*").order("creada_en");
    if (error) throw error;
    return data;
  },
});

export const contratosQuery = queryOptions({
  queryKey: ["contratos"],
  queryFn: async () => {
    await seedDemo();
    const { data, error } = await supabase.from("contratos").select("*").order("id");
    if (error) throw error;
    return data;
  },
});

/** Detalle de una factura: factura, sus decisiones (más reciente primero) y sus eventos. */
export function facturaDetalleQuery(id: string) {
  return queryOptions({
    queryKey: ["factura", id],
    queryFn: async () => {
      const [factura, decisiones, eventos] = await Promise.all([
        supabase.from("facturas").select("*").eq("id", id).maybeSingle(),
        supabase.from("decisiones").select("*, proveedor:proveedores(*)").eq("factura_id", id).order("decidido_en", { ascending: false }),
        supabase.from("registro_eventos").select("*").eq("factura_id", id).order("fecha_hora"),
      ]);
      if (factura.error) throw factura.error;
      if (decisiones.error) throw decisiones.error;
      if (eventos.error) throw eventos.error;
      if (!factura.data) throw new Error("Factura no encontrada");
      // Factura original cuando la decisión más reciente la marcó como duplicado (R3)
      const relacionadaId = (decisiones.data ?? [])[0]?.factura_relacionada_id ?? null;
      let relacionada: { id: string; codigo: string | null; numero: string | null } | null = null;
      if (relacionadaId) {
        const { data: rel } = await supabase.from("facturas").select("id, codigo, numero").eq("id", relacionadaId).maybeSingle();
        relacionada = rel;
      }
      return { factura: factura.data, decisiones: decisiones.data ?? [], eventos: eventos.data ?? [], relacionada };
    },
  });
}

/** Carga todos los datos maestros que necesita el motor de reglas. */
export const datosMaestrosQuery = queryOptions({
  queryKey: ["datos-maestros"],
  queryFn: async () => {
    await seedDemo();
    const [politica, tiposCambio, proveedores, contratos, cuentas, pagosPrevios] = await Promise.all([
      supabase.from("politicas").select("*").eq("vigente", true).limit(1).maybeSingle(),
      supabase.from("tipos_cambio").select("*"),
      supabase.from("proveedores").select("*"),
      supabase.from("contratos").select("*"),
      supabase.from("cuentas_bancarias").select("*"),
      supabase.from("pagos_previos").select("*"),
    ]);
    for (const r of [politica, tiposCambio, proveedores, contratos, cuentas, pagosPrevios]) {
      if (r.error) throw r.error;
    }
    if (!politica.data) throw new Error("No hay política vigente");
    return {
      politica: politica.data,
      tiposCambio: tiposCambio.data ?? [],
      proveedores: proveedores.data ?? [],
      contratos: contratos.data ?? [],
      cuentas: cuentas.data ?? [],
      pagosPrevios: pagosPrevios.data ?? [],
    };
  },
});
