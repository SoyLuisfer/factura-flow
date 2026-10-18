// Motor de reglas de Contralor.
// TypeScript puro y determinista: la IA nunca decide, solo extrae datos.
// Nada queda en PAGAR si algún control falla o no se puede evaluar.

export type ResultadoControl = "OK" | "FALLA" | "NO_APLICA" | "NO_EVALUABLE";
export type AccionFalla = "FRENAR" | "ESCALAR" | "POSTERGAR";
export type TipoDecision = "PAGAR" | "FRENAR" | "ESCALAR" | "POSTERGAR";

export interface Control {
  regla: string;
  control: string;
  resultado: ResultadoControl;
  detalle: string;
  si_falla: AccionFalla | null;
}

export interface FacturaEntrada {
  id?: string | undefined;
  codigo?: string | undefined;
  canal?: string | null;
  tipo_documento: string | null;
  emisor: string | null;
  receptor: string | null;
  numero: string | null;
  fecha_emision: string | null;
  fecha_vencimiento?: string | null;
  descripcion: string | null;
  monto: number | null;
  moneda: string | null;
  pago_banco?: string | null;
  pago_cuenta?: string | null;
  confianza_extraccion?: number | null;
  fecha_recepcion: string;
}

export interface ParametrosPolitica {
  umbral_confianza_extraccion: number;
  campos_obligatorios: string[];
  tipos_documento_validos: string[];
  receptor_valido: string;
  tolerancia_contrato_pct: number;
  tope_por_pago_usd: number;
  presupuesto_por_categoria_usd: Record<string, number>;
  postergacion_automatica_max_usd: number;
  calendario_pagos: { dia_corte: string; dia_pago: string };
}

export interface ProveedorLike {
  id: string;
  nombre: string;
  activo: boolean;
  expediente_completo: boolean;
  categoria: string;
  cuenta_pago: string;
  permite_conversion: boolean;
  banco_beneficiario: string | null;
  cuenta_beneficiario: string | null;
  /** compra_directa | recurrente | cotizacion (ausente = se deduce del contrato). */
  tipo_relacion?: string;
}

export interface ContratoLike {
  id: string;
  proveedor_id: string;
  concepto: string;
  monto: number;
  moneda: string;
  tipo: string;
  /** vigente | utilizada (solo cotizaciones). */
  estado?: string;
  /** Código o número de la factura que consumió la cotización. */
  factura_uso?: string | null;
}

export interface CuentaLike {
  id: string;
  banco: string;
  numero: string;
  moneda: string;
  saldo_disponible: number;
}

export interface PagoPrevioLike {
  id: string;
  proveedor_id: string;
  factura: string;
  monto: number;
  moneda: string;
  monto_usd: number;
  categoria: string;
  fecha_pago: string;
  cuenta: string;
}

export interface FacturaRecibidaLike {
  id?: string | undefined;
  codigo?: string | undefined;
  emisor: string | null;
  numero: string | null;
  fecha_recepcion: string;
  canal?: string | null | undefined;
  decision?: TipoDecision | undefined;
}

export interface ContextoMotor {
  politicaVersion: string;
  parametros: ParametrosPolitica;
  tiposCambio: { moneda: string; por_usd: number }[];
  proveedores: ProveedorLike[];
  contratos: ContratoLike[];
  cuentas: CuentaLike[];
  pagosPrevios: PagoPrevioLike[];
  decisionesPrevias: DecisionSalida[];
  facturasRecibidas: FacturaRecibidaLike[];
}

export interface DecisionSalida {
  decision: TipoDecision;
  controles: Control[];
  motivo: string;
  monto_usd: number | null;
  proveedor_id: string | null;
  categoria: string | null;
  cuenta_pago: string | null;
  fecha_programada_pago: string | null;
  escalar_a: string | null;
  factura_relacionada_id: string | null;
  politica_version: string;
  estado: "final" | "pendiente_aprobacion";
  decidido_por: string;
  // Campos internos para el procesamiento en lote (no se persisten):
  monto_cuenta: number | null;
  moneda_cuenta: string | null;
  periodo: string | null;
}

export const ACTOR_AGENTE = "Agente (automático)";

// ---------- Utilidades ----------

/** Minúsculas, sin tildes, sin comas ni puntos, espacios colapsados. */
export function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtMoneda(n: number, moneda: string): string {
  return `${moneda} ${fmt(n)}`;
}

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseFecha(s: string): Date {
  const [y = 1970, m = 1, d = 1] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** "19/10/2026" — formato de fecha para los textos de motivo y detalle. */
function fmtFechaTexto(s: string): string {
  const [y = 1970, m = 1, d = 1] = s.slice(0, 10).split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

function diaCorto(fechaIso: string): string {
  const d = parseFecha(fechaIso);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

/** Recibida lunes o martes → viernes de la misma semana; miércoles a domingo → viernes de la semana siguiente. */
export function viernesPago(fechaRecepcion: string): string {
  const d = parseFecha(fechaRecepcion);
  const dow = d.getUTCDay();
  let delta = (5 - dow + 7) % 7; // días hasta el viernes de esta semana
  // Miércoles a sábado: el viernes de esta semana ya pasó o es hoy → semana siguiente.
  // Domingo: el viernes próximo ya cae en la semana siguiente.
  if (dow >= 3) delta += 7;
  const pago = new Date(d);
  pago.setUTCDate(pago.getUTCDate() + delta);
  return iso(pago);
}

/** Primer viernes del mes siguiente al de la fecha dada. */
export function primerViernesMesSiguiente(fecha: string): string {
  const d = parseFecha(fecha);
  const primero = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  const delta = (5 - primero.getUTCDay() + 7) % 7;
  primero.setUTCDate(primero.getUTCDate() + delta);
  return iso(primero);
}

// ---------- Motor ----------

export function evaluarFactura(f: FacturaEntrada, ctx: ContextoMotor): DecisionSalida {
  const p = ctx.parametros;
  const controles: Control[] = [];
  const agregar = (regla: string, control: string, resultado: ResultadoControl, detalle: string, si_falla: AccionFalla | null) =>
    controles.push({ regla, control, resultado, detalle, si_falla });

  // Conversión a USD (solo para tope y presupuesto)
  const tasa = f.moneda ? ctx.tiposCambio.find((t) => t.moneda === f.moneda)?.por_usd : undefined;
  const monto_usd =
    f.monto != null && f.moneda
      ? f.moneda === "USD"
        ? redondear2(f.monto)
        : tasa
          ? redondear2(f.monto / tasa)
          : null
      : null;

  // Proveedor por nombre normalizado
  const emisorNorm = f.emisor ? normalizar(f.emisor) : null;
  const proveedor = emisorNorm ? ctx.proveedores.find((pr) => normalizar(pr.nombre) === emisorNorm) : undefined;
  const cuenta = proveedor ? ctx.cuentas.find((c) => c.id === proveedor.cuenta_pago) : undefined;

  // R0 Lectura confiable
  const confianza = f.confianza_extraccion ?? 1;
  if (confianza < p.umbral_confianza_extraccion) {
    agregar("R0", "Lectura confiable", "FALLA", `Confianza de extracción ${confianza} < ${p.umbral_confianza_extraccion}. La lectura del documento no es confiable; revisar datos extraídos.`, "ESCALAR");
  } else {
    agregar("R0", "Lectura confiable", "OK", `Confianza de extracción ${confianza} ≥ ${p.umbral_confianza_extraccion}.`, null);
  }

  // R1 Documento válido y completo
  const faltantes = p.campos_obligatorios.filter((campo) => {
    const v = (f as unknown as Record<string, unknown>)[campo];
    return v == null || v === "";
  });
  const tipoValido = f.tipo_documento != null && p.tipos_documento_validos.map(normalizar).includes(normalizar(f.tipo_documento));
  if (faltantes.length > 0 || !tipoValido) {
    const partes: string[] = [];
    if (faltantes.length > 0) partes.push(`Faltan campos obligatorios: ${faltantes.join(", ")}`);
    if (!tipoValido && f.tipo_documento) partes.push(`Tipo de documento '${f.tipo_documento}' no es válido (válidos: ${p.tipos_documento_validos.join(", ")})`);
    agregar("R1", "Documento válido y completo", "FALLA", partes.join(". ") + ".", "FRENAR");
  } else {
    agregar("R1", "Documento válido y completo", "OK", `Documento '${f.tipo_documento}' con todos los campos obligatorios.`, null);
  }

  // R2 Emitida a nombre de la empresa
  if (!f.receptor) {
    agregar("R2", "Emitida a nombre de la empresa", "NO_EVALUABLE", "La factura no indica receptor.", null);
  } else if (normalizar(f.receptor) !== normalizar(p.receptor_valido)) {
    agregar("R2", "Emitida a nombre de la empresa", "FALLA", `Emitida a nombre de '${f.receptor}', no de ${p.receptor_valido}.`, "FRENAR");
  } else {
    agregar("R2", "Emitida a nombre de la empresa", "OK", `Emitida a nombre de ${p.receptor_valido}.`, null);
  }

  // R3 No es duplicado
  let facturaRelacionada: string | null = null;
  if (!f.numero) {
    agregar("R3", "No es duplicado", "NO_EVALUABLE", "La factura no tiene número; no se puede verificar duplicidad.", null);
  } else {
    const pagoPrevio = proveedor
      ? ctx.pagosPrevios.find((pp) => pp.proveedor_id === proveedor.id && pp.factura === f.numero)
      : undefined;
    const recibida = ctx.facturasRecibidas.find(
      (fr) => fr.numero === f.numero && fr.emisor && emisorNorm && normalizar(fr.emisor) === emisorNorm && fr.decision !== "FRENAR",
    );
    if (pagoPrevio) {
      agregar("R3", "No es duplicado", "FALLA", `La factura ${f.numero} ya se pagó el ${fmtFechaTexto(pagoPrevio.fecha_pago)} (pago ${pagoPrevio.id}, USD ${fmt(pagoPrevio.monto_usd)}).`, "FRENAR");
    } else if (recibida) {
      facturaRelacionada = recibida.id ?? null;
      agregar("R3", "No es duplicado", "FALLA", `La factura ${f.numero} ya fue recibida el ${fmtFechaTexto(recibida.fecha_recepcion)} por ${recibida.canal ?? "otro canal"} (${recibida.codigo ?? "sin código"}, decisión: ${recibida.decision}).`, "FRENAR");
    } else {
      agregar("R3", "No es duplicado", "OK", `No hay pagos previos ni recepciones de la factura ${f.numero}.`, null);
    }
  }

  // R4 Proveedor registrado y autorizado
  if (!f.emisor) {
    agregar("R4", "Proveedor registrado y autorizado", "NO_EVALUABLE", "La factura no indica emisor.", null);
  } else if (!proveedor) {
    agregar("R4", "Proveedor registrado y autorizado", "FALLA", `'${f.emisor}' no está en el registro de proveedores.`, "ESCALAR");
  } else if (!proveedor.activo) {
    agregar("R4", "Proveedor registrado y autorizado", "FALLA", `El proveedor ${proveedor.nombre} (${proveedor.id}) está inactivo.`, "ESCALAR");
  } else if (!proveedor.expediente_completo) {
    agregar("R4", "Proveedor registrado y autorizado", "FALLA", `El proveedor ${proveedor.nombre} (${proveedor.id}) tiene el expediente incompleto.`, "ESCALAR");
  } else {
    agregar("R4", "Proveedor registrado y autorizado", "OK", `${proveedor.nombre} (${proveedor.id}) activo y con expediente completo.`, null);
  }

  // R5 Datos de pago coinciden
  if (!proveedor) {
    agregar("R5", "Datos de pago coinciden", "NO_APLICA", "Sin proveedor identificado no se puede comparar la cuenta.", null);
  } else if (!f.pago_cuenta) {
    agregar("R5", "Datos de pago coinciden", "NO_APLICA", "La factura no trae cuenta de pago; se usará la cuenta registrada.", null);
  } else if (normalizar(f.pago_cuenta) !== normalizar(proveedor.cuenta_beneficiario ?? "")) {
    agregar("R5", "Datos de pago coinciden", "FALLA", `La factura pide pagar a ${f.pago_banco ?? "banco desconocido"} ${f.pago_cuenta}; la cuenta registrada es ${proveedor.banco_beneficiario} ${proveedor.cuenta_beneficiario}.`, "ESCALAR");
  } else {
    agregar("R5", "Datos de pago coinciden", "OK", `La cuenta de la factura coincide con la registrada (${proveedor.banco_beneficiario} ${proveedor.cuenta_beneficiario}).`, null);
  }

  // R6 Coincide con contrato o cotización
  const contrato = proveedor ? ctx.contratos.find((c) => c.proveedor_id === proveedor.id) : undefined;
  const tipoRelacion = proveedor ? (proveedor.tipo_relacion ?? (contrato ? (contrato.tipo === "unica" ? "cotizacion" : "recurrente") : "compra_directa")) : null;
  if (!proveedor || !contrato || tipoRelacion === "compra_directa") {
    agregar("R6", "Coincide con contrato o cotización", "NO_APLICA", "Compra directa: sin contrato ni cotización de referencia.", null);
  } else if (tipoRelacion === "cotizacion" && contrato.estado === "utilizada") {
    agregar("R6", "Coincide con contrato o cotización", "FALLA", `La cotización ${contrato.id} ya fue utilizada por la factura ${contrato.factura_uso ?? "registrada"}.`, "ESCALAR");
  } else if (f.moneda !== contrato.moneda) {
    agregar("R6", "Coincide con contrato o cotización", "FALLA", `La factura es en ${f.moneda} y el contrato ${contrato.id} es en ${contrato.moneda}.`, "ESCALAR");
  } else if (f.monto == null) {
    agregar("R6", "Coincide con contrato o cotización", "NO_EVALUABLE", "La factura no tiene monto para comparar con el contrato.", null);
  } else {
    const difPct = ((f.monto - contrato.monto) / contrato.monto) * 100;
    if (Math.abs(difPct) <= p.tolerancia_contrato_pct) {
      const detalle =
        difPct === 0
          ? `Coincide exactamente con el contrato ${contrato.id} (${fmtMoneda(contrato.monto, contrato.moneda)}).`
          : `Diferencia de ${difPct > 0 ? "+" : ""}${difPct.toFixed(2)}% dentro de la tolerancia de ${p.tolerancia_contrato_pct}% (contrato ${contrato.id}: ${fmtMoneda(contrato.monto, contrato.moneda)}).`;
      agregar("R6", "Coincide con contrato o cotización", "OK", detalle, null);
    } else {
      agregar("R6", "Coincide con contrato o cotización", "FALLA", `${fmtMoneda(f.monto, f.moneda ?? "")} vs ${contrato.id} ${fmtMoneda(contrato.monto, contrato.moneda)}: diferencia de ${fmtMoneda(Math.abs(f.monto - contrato.monto), f.moneda ?? "")} (${difPct > 0 ? "+" : ""}${difPct.toFixed(2)}%), supera la tolerancia de ${p.tolerancia_contrato_pct}%.`, "ESCALAR");
    }
  }

  // R7 Moneda compatible con la cuenta de pago
  if (!proveedor || !cuenta) {
    agregar("R7", "Moneda compatible con la cuenta de pago", "NO_APLICA", "Sin proveedor identificado no hay cuenta de pago que verificar.", null);
  } else if (f.moneda === cuenta.moneda) {
    agregar("R7", "Moneda compatible con la cuenta de pago", "OK", `Factura en ${f.moneda} y cuenta ${cuenta.id} en ${cuenta.moneda}.`, null);
  } else if (proveedor.permite_conversion) {
    const conv = monto_usd != null && f.moneda !== "USD" ? ` (${fmtMoneda(f.monto ?? 0, f.moneda ?? "")} ÷ ${tasa} = USD ${fmt(monto_usd)})` : "";
    agregar("R7", "Moneda compatible con la cuenta de pago", "OK", `Factura en ${f.moneda} pagada desde ${cuenta.id} (${cuenta.moneda}) con conversión autorizada${conv}.`, null);
  } else {
    agregar("R7", "Moneda compatible con la cuenta de pago", "FALLA", `Factura en ${f.moneda} y el proveedor se paga desde ${cuenta.id} (${cuenta.moneda}) sin conversión autorizada: requiere ajuste manual.`, "ESCALAR");
  }

  // R8 Bajo el tope por pago
  if (monto_usd == null) {
    agregar("R8", "Bajo el tope por pago", "NO_EVALUABLE", "Sin monto o sin tipo de cambio no se puede evaluar el tope.", null);
  } else if (monto_usd <= p.tope_por_pago_usd) {
    const detalle =
      f.moneda === "USD"
        ? `USD ${fmt(monto_usd)} ≤ USD ${fmt(p.tope_por_pago_usd)}.`
        : `${fmtMoneda(f.monto ?? 0, f.moneda ?? "")} ÷ ${tasa} = USD ${fmt(monto_usd)} ≤ USD ${fmt(p.tope_por_pago_usd)}.`;
    agregar("R8", "Bajo el tope por pago", "OK", detalle, null);
  } else {
    const detalle =
      f.moneda === "USD"
        ? `USD ${fmt(monto_usd)} supera el tope por pago de USD ${fmt(p.tope_por_pago_usd)}.`
        : `${fmtMoneda(f.monto ?? 0, f.moneda ?? "")} ÷ ${tasa} = USD ${fmt(monto_usd)}, supera el tope de USD ${fmt(p.tope_por_pago_usd)}.`;
    agregar("R8", "Bajo el tope por pago", "FALLA", detalle, "ESCALAR");
  }

  // R9 Presupuesto del periodo
  const periodo = f.fecha_recepcion.slice(0, 7);
  let consumidoPeriodo = 0;
  let disponiblePresupuesto: number | null = null;
  if (!proveedor) {
    agregar("R9", "Presupuesto del periodo", "NO_APLICA", "Sin proveedor no hay categoría de presupuesto.", null);
  } else {
    const presupuesto = p.presupuesto_por_categoria_usd[proveedor.categoria];
    if (presupuesto == null) {
      agregar("R9", "Presupuesto del periodo", "NO_EVALUABLE", `No hay presupuesto configurado para la categoría '${proveedor.categoria}'.`, null);
    } else if (monto_usd == null) {
      agregar("R9", "Presupuesto del periodo", "NO_EVALUABLE", "Sin monto en USD no se puede evaluar el presupuesto.", null);
    } else {
      const dePagosPrevios = ctx.pagosPrevios
        .filter((pp) => pp.categoria === proveedor.categoria && pp.fecha_pago.startsWith(periodo))
        .reduce((s, pp) => s + pp.monto_usd, 0);
      const deDecisiones = ctx.decisionesPrevias
        .filter((d) => d.decision === "PAGAR" && d.categoria === proveedor.categoria && d.periodo === periodo)
        .reduce((s, d) => s + (d.monto_usd ?? 0), 0);
      consumidoPeriodo = redondear2(dePagosPrevios + deDecisiones);
      disponiblePresupuesto = redondear2(presupuesto - consumidoPeriodo);
      if (monto_usd <= disponiblePresupuesto) {
        agregar("R9", "Presupuesto del periodo", "OK", `Categoría ${proveedor.categoria}: presupuesto USD ${fmt(presupuesto)}, consumido en ${periodo} USD ${fmt(consumidoPeriodo)}, disponible USD ${fmt(disponiblePresupuesto)} ≥ USD ${fmt(monto_usd)}.`, null);
      } else if (monto_usd <= p.postergacion_automatica_max_usd) {
        agregar("R9", "Presupuesto del periodo", "FALLA", `Categoría ${proveedor.categoria}: disponible en ${periodo} USD ${fmt(disponiblePresupuesto)} < USD ${fmt(monto_usd)}. El monto es ≤ USD ${fmt(p.postergacion_automatica_max_usd)}, se posterga al siguiente periodo.`, "POSTERGAR");
      } else {
        agregar("R9", "Presupuesto del periodo", "FALLA", `Categoría ${proveedor.categoria}: disponible en ${periodo} USD ${fmt(disponiblePresupuesto)} < USD ${fmt(monto_usd)} y el monto supera el máximo de postergación automática (USD ${fmt(p.postergacion_automatica_max_usd)}).`, "ESCALAR");
      }
    }
  }

  // R10 Saldo suficiente
  let montoCuenta: number | null = null;
  if (!cuenta) {
    agregar("R10", "Saldo suficiente", "NO_APLICA", "Sin cuenta de pago no se puede verificar saldo.", null);
  } else if (f.monto == null || !f.moneda) {
    agregar("R10", "Saldo suficiente", "NO_EVALUABLE", "Sin monto o moneda no se puede verificar saldo.", null);
  } else {
    const tasaCuenta = cuenta.moneda === "USD" ? 1 : ctx.tiposCambio.find((t) => t.moneda === cuenta.moneda)?.por_usd;
    if (f.moneda === cuenta.moneda) {
      montoCuenta = f.monto;
    } else if (monto_usd != null && tasaCuenta) {
      montoCuenta = redondear2(monto_usd * tasaCuenta);
    }
    if (montoCuenta == null) {
      agregar("R10", "Saldo suficiente", "NO_EVALUABLE", `No hay tipo de cambio para convertir a ${cuenta.moneda}.`, null);
    } else {
      const programado = ctx.decisionesPrevias
        .filter((d) => d.decision === "PAGAR" && d.cuenta_pago === cuenta.id && d.fecha_programada_pago)
        .reduce((s, d) => s + (d.monto_cuenta ?? 0), 0);
      const disponibleCuenta = redondear2(cuenta.saldo_disponible - programado);
      if (montoCuenta <= disponibleCuenta) {
        agregar("R10", "Saldo suficiente", "OK", `${cuenta.id}: saldo ${fmtMoneda(cuenta.saldo_disponible, cuenta.moneda)} − pagos programados ${fmtMoneda(redondear2(programado), cuenta.moneda)} = ${fmtMoneda(disponibleCuenta, cuenta.moneda)} ≥ ${fmtMoneda(montoCuenta, cuenta.moneda)}.`, null);
      } else {
        agregar("R10", "Saldo suficiente", "FALLA", `${cuenta.id}: disponible ${fmtMoneda(disponibleCuenta, cuenta.moneda)} (saldo ${fmtMoneda(cuenta.saldo_disponible, cuenta.moneda)} − programados ${fmtMoneda(redondear2(programado), cuenta.moneda)}) no cubre ${fmtMoneda(montoCuenta, cuenta.moneda)}.`, "ESCALAR");
      }
    }
  }

  // Decisión final por precedencia
  const fallas = controles.filter((c) => c.resultado === "FALLA");
  const hayNoEvaluable = controles.some((c) => c.resultado === "NO_EVALUABLE");
  let decision: TipoDecision;
  if (fallas.some((c) => c.si_falla === "FRENAR")) decision = "FRENAR";
  else if (fallas.some((c) => c.si_falla === "ESCALAR") || hayNoEvaluable) decision = "ESCALAR";
  else if (fallas.some((c) => c.si_falla === "POSTERGAR")) decision = "POSTERGAR";
  else decision = "PAGAR";

  const escalarA = decision === "ESCALAR" ? (controles.find((c) => c.regla === "R4" && c.resultado === "FALLA") ? "Contabilidad" : "Finanzas") : null;

  let fechaProgramada: string | null = null;
  let motivo: string;
  if (decision === "PAGAR") {
    fechaProgramada = viernesPago(f.fecha_recepcion);
    motivo = `Cumple los controles. Recibida el ${diaCorto(f.fecha_recepcion)}: se paga el ${diaCorto(fechaProgramada)} desde ${cuenta?.id ?? "la cuenta registrada"}.`;
  } else if (decision === "POSTERGAR") {
    fechaProgramada = primerViernesMesSiguiente(f.fecha_recepcion);
    const detallePresupuesto = fallas.find((c) => c.si_falla === "POSTERGAR")?.detalle ?? "";
    motivo = `${detallePresupuesto} Reprogramada al ${diaCorto(fechaProgramada)}.`;
  } else if (decision === "FRENAR") {
    motivo = fallas
      .filter((c) => c.si_falla === "FRENAR")
      .map((c) => c.detalle)
      .join(" ");
  } else {
    const detalles = fallas.filter((c) => c.si_falla === "ESCALAR").map((c) => c.detalle);
    if (hayNoEvaluable) {
      detalles.push(...controles.filter((c) => c.resultado === "NO_EVALUABLE").map((c) => `No se pudo evaluar ${c.control}: ${c.detalle}`));
    }
    motivo = detalles.join(" ");
  }

  return {
    decision,
    controles,
    motivo,
    monto_usd,
    proveedor_id: proveedor?.id ?? null,
    categoria: proveedor?.categoria ?? null,
    cuenta_pago: cuenta?.id ?? null,
    fecha_programada_pago: fechaProgramada,
    escalar_a: escalarA,
    factura_relacionada_id: facturaRelacionada,
    politica_version: ctx.politicaVersion,
    estado: decision === "ESCALAR" ? "pendiente_aprobacion" : "final",
    decidido_por: decision === "ESCALAR" ? "Pendiente de aprobación humana" : ACTOR_AGENTE,
    monto_cuenta: montoCuenta,
    moneda_cuenta: cuenta?.moneda ?? null,
    periodo,
  };
}

export interface ResultadoLote {
  factura: FacturaEntrada;
  decision: DecisionSalida;
}

/** Procesa facturas una por una en orden de recepción; cada decisión alimenta el contexto de la siguiente. */
export function procesarLote(facturas: FacturaEntrada[], ctxBase: ContextoMotor): ResultadoLote[] {
  const ordenadas = [...facturas].sort((a, b) => {
    const porFecha = a.fecha_recepcion.localeCompare(b.fecha_recepcion);
    return porFecha !== 0 ? porFecha : (a.codigo ?? "").localeCompare(b.codigo ?? "");
  });
  const ctx: ContextoMotor = {
    ...ctxBase,
    decisionesPrevias: [...ctxBase.decisionesPrevias],
    facturasRecibidas: [...ctxBase.facturasRecibidas],
  };
  const resultados: ResultadoLote[] = [];
  for (const factura of ordenadas) {
    const decision = evaluarFactura(factura, ctx);
    ctx.decisionesPrevias.push(decision);
    ctx.facturasRecibidas.push({
      id: factura.id,
      codigo: factura.codigo,
      emisor: factura.emisor,
      numero: factura.numero,
      fecha_recepcion: factura.fecha_recepcion,
      canal: factura.canal,
      decision: decision.decision,
    });
    resultados.push({ factura, decision });
  }
  return resultados;
}
