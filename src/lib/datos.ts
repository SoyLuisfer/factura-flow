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
      tiposCambio: tiposCambio.data,
      proveedores: proveedores.data,
      contratos: contratos.data,
      cuentas: cuentas.data,
      pagosPrevios: pagosPrevios.data,
    };
  },
});
