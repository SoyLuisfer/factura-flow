import { describe, expect, it } from "vitest";
import { adaptarProgramacion, siguienteViernes, validarAccion } from "@/lib/tesoreria";
import { formatearMonto, formatearPorcentaje, formatearTipoCambio } from "@/lib/formato";
import { evaluarFactura, type DecisionSalida, type ContextoMotor } from "@/lib/motorReglas";

describe("Formatos numéricos", () => {
  it("quetzales con coma de miles y dos decimales", () => expect(formatearMonto(9240, "GTQ")).toBe("Q 9,240.00"));
  it("dólares con símbolo US$", () => expect(formatearMonto(2800, "USD")).toBe("US$ 2,800.00"));
  it("negativos entre paréntesis", () => expect(formatearMonto(-1250, "GTQ")).toBe("(Q 1,250.00)"));
  it("porcentajes enteros sin decimal", () => expect(formatearPorcentaje(67)).toBe("67 %"));
  it("porcentajes fraccionarios con un decimal", () => expect(formatearPorcentaje(66.666)).toBe("66.7 %"));
  it("tipo de cambio con dos decimales", () => expect(formatearTipoCambio(7.7)).toBe("Q 7.70 por US$ 1.00"));
});
const tramo = { monto: 2800, fecha_pago: "2026-10-23" };
describe("Acciones de tesorería", () => {
  it.each([0, -1, 2800, 3000])("rechaza parcial %s", (monto) => expect(validarAccion(tramo, "parcial", monto, "2026-10-30", "Luis", "Prueba")).not.toBeNull());
  it("acepta parcial estrictamente menor al total", () => expect(validarAccion(tramo, "parcial", 1000, "2026-10-30", "Luis", "Prueba")).toBeNull());
  it("postergación debe ser posterior", () => expect(validarAccion(tramo, "postergar", 0, "2026-10-23", "Luis", "Prueba")).not.toBeNull());
  it("exige usuario", () => expect(validarAccion(tramo, "postergar", 0, "2026-10-30", "", "Prueba")).not.toBeNull());
  it("exige comentario", () => expect(validarAccion(tramo, "postergar", 0, "2026-10-30", "Luis", " ")).not.toBeNull());
  it("saldo parcial por defecto al viernes siguiente", () => expect(siguienteViernes("2026-10-23", true)).toBe("2026-10-30"));
  it("reprogramación al próximo viernes", () => expect(siguienteViernes("2026-10-17")).toBe("2026-10-23"));
});
describe("R9 devengado y R10 caja, motor sin cambios", () => {
  const d: DecisionSalida = { decision: "PAGAR", controles: [], motivo: "", monto_usd: 2800, proveedor_id: "V003", categoria: "Contratistas", cuenta_pago: "BANK-USD", fecha_programada_pago: "2026-10-23", escalar_a: null, factura_relacionada_id: null, politica_version: "v1", estado: "final", decidido_por: "Agente", monto_cuenta: 2800, moneda_cuenta: "USD", periodo: "2026-10" };
  it("parcial mantiene 2800 de presupuesto y reserva 1000 de caja", () => {
    const registros = adaptarProgramacion(d, [{ estado: "programado", cuenta_pago: "BANK-USD", fecha_pago: "2026-10-23", monto_cuenta: 1000 }, { estado: "pospuesto", cuenta_pago: "BANK-USD", fecha_pago: "2026-10-30", monto_cuenta: 1800 }]);
    expect(registros.filter((r) => r.categoria === "Contratistas").reduce((s,r) => s+(r.monto_usd ?? 0),0)).toBe(2800);
    expect(registros.filter((r) => r.fecha_programada_pago).reduce((s,r) => s+(r.monto_cuenta ?? 0),0)).toBe(1000);
    const ctx: ContextoMotor = { politicaVersion: "v1", parametros: { umbral_confianza_extraccion: 0.7, campos_obligatorios: [], tipos_documento_validos: ["invoice"], receptor_valido: "Pollos Hermanos, S. A.", tolerancia_contrato_pct: 1, tope_por_pago_usd: 25000, presupuesto_por_categoria_usd: { Contratistas: 3000 }, postergacion_automatica_max_usd: 5000, calendario_pagos: {dia_corte:"martes",dia_pago:"viernes"} }, tiposCambio:[], proveedores:[{id:"V003",nombre:"Carlos",activo:true,expediente_completo:true,categoria:"Contratistas",cuenta_pago:"BANK-USD",permite_conversion:false,tipo_relacion:"compra_directa",banco_beneficiario:null,cuenta_beneficiario:null}], contratos:[],cuentas:[{id:"BANK-USD",moneda:"USD",saldo_disponible:1500,banco:"Demo",numero:"Demo"}],pagosPrevios:[],decisionesPrevias:registros,facturasRecibidas:[] };
    const resultado=evaluarFactura({emisor:"Carlos",receptor:"Pollos Hermanos, S. A.",tipo_documento:"invoice",numero:"NUEVA",fecha_emision:"2026-10-19",descripcion:"Compra",monto:400,moneda:"USD",fecha_recepcion:"2026-10-20",confianza_extraccion:1},ctx);
    expect(resultado.controles.find((c) => c.regla === "R9")?.resultado).toBe("FALLA");
    expect(resultado.controles.find((c) => c.regla === "R10")?.resultado).toBe("OK");
  });
  it("postergación reserva cero y no libera presupuesto", () => {
    const registros = adaptarProgramacion(d,[{estado:"pospuesto",cuenta_pago:"BANK-USD",fecha_pago:"2026-10-30",monto_cuenta:2800}]);
    expect(registros[0]?.monto_usd).toBe(2800);
    expect(registros[0]?.fecha_programada_pago).toBeNull();
    expect(registros[0]?.monto_cuenta).toBe(0);
  });
});