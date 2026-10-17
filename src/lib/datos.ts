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
