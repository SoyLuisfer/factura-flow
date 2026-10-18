import { describe, it, expect } from "vitest";
import { validarLiberacion, obtenerLotePendiente, csvLote, type LotePago } from "@/lib/lotes";
import { adaptarProgramacion, type TramoPago } from "@/lib/tesoreria";
import type { DecisionSalida } from "@/lib/motorReglas";
const actor = "Luis Samayoa (Finanzas)";
describe("Liberación humana de fondos", () => {
  it("requiere una persona, nunca el agente", () => expect(validarLiberacion(1000, 150000, "Agente (automático)", "Lote", "GTQ")).toBe("Elige el usuario responsable."));
  it("requiere comentario", () => expect(validarLiberacion(1000, 150000, actor, " ", "GTQ")).toBe("El comentario es obligatorio."));
  it("rechaza saldo insuficiente y calcula faltante", () => expect(validarLiberacion(151250, 150000, actor, "Lote", "GTQ")).toBe("Saldo insuficiente: faltan Q 1,250.00. Usa Pago parcial o Postergar."));
  it("permite total igual al saldo", () => expect(validarLiberacion(150000, 150000, actor, "Lote", "GTQ")).toBeNull());
  it("no permite lotes vacíos", () => expect(validarLiberacion(0, 150000, actor, "Lote", "GTQ")).toBe("No hay pagos por liberar."));
  it("reserva solo el próximo viernes y excluye liberados", () => {
    const base = { estado: "programado", cuenta_pago: "BANK-GTQ", decision: { factura_id: "f1" } };
    const filas = [{ ...base, monto_cuenta: 1000, fecha_pago: "2026-10-23" }, { ...base, monto_cuenta: 2000, fecha_pago: "2026-10-23", liberado_lote_id: "LOTE-0001" }, { ...base, monto_cuenta: 3000, fecha_pago: "2026-10-30" }] as TramoPago[];
    const lote = obtenerLotePendiente(filas, "BANK-GTQ", "2026-10-18");
    expect(lote.total).toBe(1000); expect(lote.cantidad).toBe(1); expect(lote.fecha).toBe("2026-10-23");
  });
  it("fondos liberados mantienen R9 y no se restan de nuevo en R10", () => {
    const d = { decision: "PAGAR", categoria: "Contratistas", monto_usd: 2800 } as DecisionSalida;
    const registros = adaptarProgramacion(d, [{ estado: "programado", cuenta_pago: "BANK-USD", fecha_pago: "2026-10-23", monto_cuenta: 2800, liberado_lote_id: "LOTE-0001" }]);
    expect(registros).toHaveLength(1); expect(registros[0]?.monto_usd).toBe(2800); expect(registros[0]?.monto_cuenta).toBe(0); expect(registros[0]?.fecha_programada_pago).toBeNull();
  });
  it("CSV incluye los datos bancarios y monto en moneda de la cuenta", () => {
    const lote = { id: "LOTE-0001", cuenta: "BANK-GTQ", fecha_pago: "2026-10-23", total: 2310, liberado_por: actor, liberado_en: "2026-10-18T04:00:00Z", comentario: "Lote", facturas_incluidas: [{ factura_id: "f1", proveedor: "Proveedor", banco: "Banco Demo", cuenta_beneficiario: "00123", factura: "F03", codigo: "F03", monto: 2310, moneda: "GTQ", monto_original: 300, moneda_original: "USD" }] } as unknown as LotePago;
    const csv = csvLote(lote);
    expect(csv).toContain('"LOTE-0001","BANK-GTQ","Proveedor","Banco Demo","00123","F03","Q 2,310.00","GTQ","23/10/2026"'); expect(csv).toContain(actor);
  });
});