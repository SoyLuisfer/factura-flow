import { describe, expect, it } from "vitest";
import { leerHistorialProveedor, tieneHistorialProtegido } from "@/lib/bajaProveedor";

const vacio = { facturas: 0, decisiones: 0, pagos: 0, contratos: 0 };
describe("protección del historial de proveedores", () => {
  it("permite eliminar sin historial", () => expect(tieneHistorialProtegido(vacio)).toBe(false));
  it("impide eliminar con una factura", () => expect(tieneHistorialProtegido({ ...vacio, facturas: 1 })).toBe(true));
  it("impide eliminar con una decisión", () => expect(tieneHistorialProtegido({ ...vacio, decisiones: 1 })).toBe(true));
  it("impide eliminar con un pago previo", () => expect(tieneHistorialProtegido({ ...vacio, pagos: 1 })).toBe(true));
  it("permite eliminar el contrato propio cuando no hay historial", () => expect(tieneHistorialProtegido({ ...vacio, contratos: 1 })).toBe(false));
  it("no permite asumir que no hay historial cuando la consulta es inválida", () => {
    expect(() => leerHistorialProveedor(null)).toThrow();
    expect(() => leerHistorialProveedor({ ...vacio, pagos: -1 })).toThrow();
  });
});