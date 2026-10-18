// Tipos compartidos de la extracción de facturas con IA.
// La IA SOLO extrae datos; la decisión la toma siempre src/lib/motorReglas.ts.

export interface ExtraccionFactura {
  tipo_documento: string | null;
  emisor: string | null;
  receptor: string | null;
  numero: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  descripcion: string | null;
  monto: number | null;
  moneda: string | null;
  pago_banco: string | null;
  pago_cuenta: string | null;
  confianza: number;
  campos_dudosos: string[];
}

export interface ResultadoExtraccion {
  extraccion: ExtraccionFactura;
  modelo: string;
  error?: string;
}

export const EXTRACCION_VACIA: ExtraccionFactura = {
  tipo_documento: null,
  emisor: null,
  receptor: null,
  numero: null,
  fecha_emision: null,
  fecha_vencimiento: null,
  descripcion: null,
  monto: null,
  moneda: null,
  pago_banco: null,
  pago_cuenta: null,
  confianza: 0,
  campos_dudosos: [],
};

export const MONEDAS_DISPONIBLES = ["USD", "GTQ"] as const;

/** Normalización de datos extraídos, no de decisiones. */
export function validarMonedaExtraida(extraccion: ExtraccionFactura): ExtraccionFactura {
  const valor = extraccion.moneda?.trim().toUpperCase();
  const moneda = valor === "Q" || valor === "GTQ" ? "GTQ"
    : valor === "$" || valor === "US$" || valor === "USD" ? "USD" : null;
  if (moneda) return { ...extraccion, moneda };
  return {
    ...extraccion,
    moneda: null,
    confianza: Math.min(extraccion.confianza, 0.3),
    campos_dudosos: [...new Set([...extraccion.campos_dudosos, "moneda"])],
  };
}
