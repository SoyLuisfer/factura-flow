import { describe, expect, it } from "vitest";
import { EXTRACCION_VACIA, MONEDAS_DISPONIBLES, validarMonedaExtraida } from "@/lib/extraccion";

describe("Monedas de la demo", () => {
  it("solo ofrece USD y GTQ", () => {
    expect(MONEDAS_DISPONIBLES).toEqual(["USD", "GTQ"]);
  });
  it.each(["Q", "GTQ"])("normaliza %s a GTQ", (moneda) => {
    expect(validarMonedaExtraida({ ...EXTRACCION_VACIA, moneda, confianza: 1 }).moneda).toBe("GTQ");
  });
  it.each(["$", "US$", "USD"])("normaliza %s a USD", (moneda) => {
    expect(validarMonedaExtraida({ ...EXTRACCION_VACIA, moneda, confianza: 1 }).moneda).toBe("USD");
  });
  it.each(["EUR", "JPY"])("rechaza %s con confianza baja", (moneda) => {
    const datos = validarMonedaExtraida({ ...EXTRACCION_VACIA, moneda, confianza: 1 });
    expect(datos.moneda).toBeNull();
    expect(datos.confianza).toBeLessThan(0.7);
    expect(datos.campos_dudosos).toContain("moneda");
  });
});