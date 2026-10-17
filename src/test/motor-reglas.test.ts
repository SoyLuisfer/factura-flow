import { describe, expect, it } from "vitest";
import { evaluarFactura, normalizar, primerViernesMesSiguiente, viernesPago, type ContextoMotor, type FacturaEntrada, type ParametrosPolitica } from "@/lib/motorReglas";

const parametros: ParametrosPolitica = {
  umbral_confianza_extraccion: 0.7,
  campos_obligatorios: ["tipo_documento", "emisor", "receptor", "numero", "fecha_emision", "descripcion", "monto", "moneda"],
  tipos_documento_validos: ["factura", "cuenta de cobro", "invoice"],
  receptor_valido: "Andes Labs LLC",
  tolerancia_contrato_pct: 1,
  tope_por_pago_usd: 25000,
  presupuesto_por_categoria_usd: { Contratistas: 25000 },
  postergacion_automatica_max_usd: 5000,
  calendario_pagos: { dia_corte: "martes", dia_pago: "viernes" },
};

const ctxBase: ContextoMotor = {
  politicaVersion: "v1",
  parametros,
  tiposCambio: [{ moneda: "GTQ", por_usd: 7.7 }],
  proveedores: [
    { id: "V001", nombre: "Carlos Méndez", activo: true, expediente_completo: true, categoria: "Contratistas", cuenta_pago: "BANK-USD", permite_conversion: true, banco_beneficiario: "Banco Azteca Demo", cuenta_beneficiario: "DEMO-MX-330-1209" },
  ],
  contratos: [],
  cuentas: [{ id: "BANK-USD", banco: "Banco Andino Demo", numero: "00-11", moneda: "USD", saldo_disponible: 100000 }],
  pagosPrevios: [],
  decisionesPrevias: [],
  facturasRecibidas: [],
};

const facturaOk: FacturaEntrada = {
  codigo: "T01", canal: "correo", fecha_recepcion: "2026-10-19", tipo_documento: "invoice",
  emisor: "Carlos Méndez", receptor: "Andes Labs LLC", numero: "CM-1", fecha_emision: "2026-10-16",
  descripcion: "Desarrollo", monto: 2800, moneda: "USD", confianza_extraccion: 1,
};

describe("normalizar", () => {
  it("quita tildes, comas y puntos, y colapsa espacios", () => {
    expect(normalizar("Estudio Ceiba Diseño, S.A.")).toBe("estudio ceiba diseno s a");
  });
});

describe("calendario de pagos", () => {
  it("recibida lunes → viernes de la misma semana", () => {
    expect(viernesPago("2026-10-19")).toBe("2026-10-23");
  });
  it("recibida martes → viernes de la misma semana", () => {
    expect(viernesPago("2026-10-20")).toBe("2026-10-23");
  });
  it("recibida miércoles a domingo → viernes de la semana siguiente", () => {
    expect(viernesPago("2026-10-22")).toBe("2026-10-30");
    expect(viernesPago("2026-10-25")).toBe("2026-10-30");
  });
  it("postergación → primer viernes del mes siguiente", () => {
    expect(primerViernesMesSiguiente("2026-10-22")).toBe("2026-11-06");
  });
});

describe("evaluarFactura", () => {
  it("PAGAR cuando todos los controles pasan", () => {
    const d = evaluarFactura(facturaOk, ctxBase);
    expect(d.decision).toBe("PAGAR");
    expect(d.estado).toBe("final");
    expect(d.fecha_programada_pago).toBe("2026-10-23");
    expect(d.controles).toHaveLength(11);
  });

  it("FRENAR si la factura va a nombre de otra empresa", () => {
    const d = evaluarFactura({ ...facturaOk, receptor: "Andes Labs Guatemala, S.A." }, ctxBase);
    expect(d.decision).toBe("FRENAR");
    expect(d.controles.find((c) => c.regla === "R2")?.resultado).toBe("FALLA");
  });

  it("ESCALAR si el proveedor no está registrado", () => {
    const d = evaluarFactura({ ...facturaOk, emisor: "Desconocido SA" }, ctxBase);
    expect(d.decision).toBe("ESCALAR");
    expect(d.escalar_a).toBe("Contabilidad");
    expect(d.estado).toBe("pendiente_aprobacion");
  });

  it("ESCALAR si supera el tope por pago (con conversión a USD)", () => {
    const d = evaluarFactura({ ...facturaOk, monto: 46200, moneda: "GTQ" }, { ...ctxBase, parametros: { ...parametros, tope_por_pago_usd: 5000 } });
    expect(d.decision).toBe("ESCALAR");
    expect(d.monto_usd).toBe(6000);
    expect(d.escalar_a).toBe("Finanzas");
  });

  it("FRENAR tiene precedencia sobre ESCALAR", () => {
    const d = evaluarFactura({ ...facturaOk, receptor: "Otra Empresa", monto: 99999 }, ctxBase);
    expect(d.decision).toBe("FRENAR");
  });

  it("NO_EVALUABLE sin fallas lleva a ESCALAR, nunca a PAGAR", () => {
    // Moneda sin tipo de cambio: R8/R9/R10 quedan NO_EVALUABLE sin ninguna FALLA.
    const d = evaluarFactura({ ...facturaOk, moneda: "EUR" }, ctxBase);
    expect(d.decision).toBe("ESCALAR");
    expect(d.controles.some((c) => c.resultado === "NO_EVALUABLE")).toBe(true);
    expect(d.controles.some((c) => c.resultado === "FALLA")).toBe(false);
  });
});
