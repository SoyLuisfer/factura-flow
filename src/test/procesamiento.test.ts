import { describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { diaGuatemala, fechaPura, viernesRecepcion } from '@/lib/fechas';
import { evaluarEntradaSegura } from '@/lib/procesamiento';
import type { ContextoMotor, FacturaEntrada } from '@/lib/motorReglas';
const ctx: ContextoMotor = {
  politicaVersion: 'v1', parametros: { umbral_confianza_extraccion: 0.7, campos_obligatorios: ['emisor','receptor','fecha_emision','monto','moneda'], tipos_documento_validos: ['factura'], receptor_valido: 'Pollos Hermanos, S. A.', tolerancia_contrato_pct: 1, tope_por_pago_usd: 25000, presupuesto_por_categoria_usd: { Oficina: 5000 }, postergacion_automatica_max_usd: 5000, calendario_pagos: { dia_corte: 'martes', dia_pago: 'viernes' } },
  tiposCambio: [{ moneda: 'USD', por_usd: 1 }], proveedores: [{ id: 'V001', nombre: 'Proveedor', activo: true, expediente_completo: true, categoria: 'Oficina', cuenta_pago: 'BANK-USD', permite_conversion: false, banco_beneficiario: null, cuenta_beneficiario: null, tipo_relacion: 'compra_directa' }], contratos: [], cuentas: [{ id: 'BANK-USD', banco: 'Demo', numero: 'Demo', moneda: 'USD', saldo_disponible: 120000 }], pagosPrevios: [], decisionesPrevias: [], facturasRecibidas: [],
};
const f: FacturaEntrada = { emisor: 'Proveedor', receptor: 'Pollos Hermanos, S. A.', numero: 'TEST', tipo_documento: 'factura', descripcion: 'Compra', fecha_emision: '2026-10-16', moneda: 'USD', monto: 100, confianza_extraccion: 1, fecha_recepcion: '2026-10-19T17:20:00Z' };
describe('Fechas y recepción manual', () => {
  it('instante de subida usa el día de Guatemala, no el UTC', () => {
    expect(diaGuatemala('2026-10-21T04:15:00Z')).toBe('2026-10-20');
    expect(evaluarEntradaSegura({ ...f, fecha_recepcion: '2026-10-21T04:15:00Z' }, ctx).fecha_programada_pago).toBe('2026-10-23');
  });
  it.each(['2026-10-19','2026-10-20'])('lunes/martes %s pagan ese viernes', (fecha) => {
    expect(viernesRecepcion(fecha)).toBe('2026-10-23');
  });
  it.each(['2026-10-21','2026-10-22','2026-10-23','2026-10-24','2026-10-25'])('miércoles/domingo %s pagan el viernes siguiente', (fecha) => {
    expect(viernesRecepcion(fecha)).toBe('2026-10-30');
    expect(evaluarEntradaSegura({ ...f, fecha_recepcion: `${fecha}T12:00:00-06:00` }, ctx).fecha_programada_pago).toBe('2026-10-30');
  });
  it.each(['', 'no es fecha', '2026-02-30', '2026-13-19', '2026-02-30T12:00:00Z'])('recepción inválida %s no aprueba ni rompe', (fecha) => {
    const d = evaluarEntradaSegura({ ...f, fecha_recepcion: fecha }, ctx);
    expect(d.decision).toBe('ESCALAR');
    expect(d.controles).toHaveLength(11);
    expect(d.controles.find((c) => c.regla === 'R9')?.resultado).toBe('NO_EVALUABLE');
    expect(d.fecha_programada_pago).toBeNull();
  });
  it('emisión inválida no aprueba', () => {
    expect(evaluarEntradaSegura({ ...f, fecha_emision: '2026-02-30' }, ctx).decision).toBe('ESCALAR');
    expect(fechaPura('2026-02-30')).toBeNull();
  });
  it('timestamp de subida aprueba, conserva período y persiste pago sin hora', () => {
    const d = evaluarEntradaSegura(f, ctx);
    expect(d.decision).toBe('PAGAR');
    expect(d.fecha_programada_pago).toBe('2026-10-23');
    expect(d.periodo).toBe('2026-10');
  });
});