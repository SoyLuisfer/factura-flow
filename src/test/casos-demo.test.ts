import { describe, expect, it } from "vitest";
import { CASOS_PRUEBA } from "@/lib/casosPrueba";

describe("Datos de los 18 casos nuevos", () => {
  it("usa solo USD/GTQ y el receptor válido salvo los casos inválidos F15/F16", () => {
    expect(CASOS_PRUEBA).toHaveLength(18);
    for (const caso of CASOS_PRUEBA) {
      expect(["USD", "GTQ"]).toContain(caso.moneda);
      if (!["F15", "F16"].includes(caso.codigo)) expect(caso.receptor).toBe("Pollos Hermanos, S. A.");
    }
    expect(CASOS_PRUEBA.find((c) => c.codigo === "F15")?.receptor).toBe("Pollos Hermanos Honduras, S. A.");
    expect(CASOS_PRUEBA.find((c) => c.codigo === "F16")?.receptor).toBeNull();
  });
  it("Quetzal factura USD 300 y Ríos factura USD 1,500", () => {
    expect(CASOS_PRUEBA.find((c) => c.codigo === "F03")).toMatchObject({ monto: 300, moneda: "USD", esperado: "PAGAR" });
    expect(CASOS_PRUEBA.find((c) => c.codigo === "F13")).toMatchObject({ monto: 1500, moneda: "USD", esperado: "ESCALAR" });
  });
});