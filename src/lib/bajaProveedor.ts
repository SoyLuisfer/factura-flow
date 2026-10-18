export interface HistorialProveedor {
  facturas: number;
  decisiones: number;
  pagos: number;
  contratos: number;
}

export function tieneHistorialProtegido(h: HistorialProveedor): boolean {
  return h.facturas > 0 || h.decisiones > 0 || h.pagos > 0;
}

export function leerHistorialProveedor(valor: unknown): HistorialProveedor {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) throw new Error("HISTORIAL_NO_DISPONIBLE");
  const h = valor as Record<string, unknown>;
  for (const campo of ["facturas", "decisiones", "pagos", "contratos"]) {
    if (typeof h[campo] !== "number" || !Number.isSafeInteger(h[campo]) || Number(h[campo]) < 0) throw new Error("HISTORIAL_NO_DISPONIBLE");
  }
  return { facturas: Number(h.facturas), decisiones: Number(h.decisiones), pagos: Number(h.pagos), contratos: Number(h.contratos) };
}