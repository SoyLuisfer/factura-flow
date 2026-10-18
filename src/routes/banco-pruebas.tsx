import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Play, DatabaseZap } from "lucide-react";
import { PanelControles } from "@/components/panel-controles";
import { ETIQUETA_DECISION } from "@/lib/etiquetas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { datosMaestrosQuery, reiniciarDemo } from "@/lib/datos";
import { construirContexto } from "@/lib/contexto";
import { consumirCotizacionSiAplica } from "@/lib/cotizaciones";
import { supabase } from "@/integrations/supabase/client";
import { CASOS_PRUEBA } from "@/lib/casosPrueba";
import { formatearMonto, formatearPorcentaje, formatearTextoNumerico, fmtFecha } from "@/lib/formato";
import { procesarLote, type ResultadoLote, type TipoDecision } from "@/lib/motorReglas";

export const Route = createFileRoute("/banco-pruebas")({
  head: () => ({
    meta: [
      { title: "Banco de pruebas — Contralor" },
      { name: "description", content: "Casos de prueba del motor de reglas y reinicio de datos demo." },
      { property: "og:title", content: "Banco de pruebas — Contralor" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:description", content: "Casos de prueba del motor de reglas." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(datosMaestrosQuery),
  component: BancoPruebas,
});

const VARIANTES_DECISION: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  PAGAR: "default",
  FRENAR: "destructive",
  ESCALAR: "secondary",
  POSTERGAR: "outline",
};

type ResultadoDobleCarga = { ok: boolean; detalle: string };

/** Segunda pasada en memoria: todo lo decidido en la primera debe salir FRENAR por duplicado y ningún presupuesto debe sobregirarse. */
function verificarDobleCarga(primera: ResultadoLote[], ctx: Parameters<typeof procesarLote>[1]): ResultadoDobleCarga {
  const ctx2 = {
    ...ctx,
    decisionesPrevias: [...ctx.decisionesPrevias, ...primera.map((r) => r.decision)],
    facturasRecibidas: [
      ...ctx.facturasRecibidas,
      ...primera.map((r) => ({
        id: r.factura.id,
        codigo: r.factura.codigo,
        emisor: r.factura.emisor,
        numero: r.factura.numero,
        fecha_recepcion: r.factura.fecha_recepcion,
        canal: r.factura.canal,
        decision: r.decision.decision,
      })),
    ],
  };
  const segunda = procesarLote(CASOS_PRUEBA, ctx2);

  for (let i = 0; i < primera.length; i++) {
    const d1 = primera[i]!.decision.decision;
    const d2 = segunda[i]!.decision.decision;
    if (d1 !== "FRENAR" && d2 !== "FRENAR") {
      return { ok: false, detalle: `${primera[i]!.factura.codigo}: primera pasada ${d1}, segunda ${d2} (debía ser FRENAR por duplicado)` };
    }
  }

  // Presupuesto: consumo PAGAR por categoría y periodo en ambas pasadas ≤ presupuesto
  const presupuestos = ctx.parametros.presupuesto_por_categoria_usd;
  const consumo = new Map<string, number>();
  for (const r of [...primera, ...segunda]) {
    const d = r.decision;
    if (d.decision !== "PAGAR" || !d.categoria || !d.periodo) continue;
    const clave = `${d.categoria}|${d.periodo}`;
    consumo.set(clave, (consumo.get(clave) ?? 0) + (d.monto_usd ?? 0));
  }
  for (const [clave, total] of consumo) {
    const cat = clave.split("|")[0]!;
    const presupuesto = presupuestos[cat];
    if (presupuesto != null && total > presupuesto + 0.005) {
      return { ok: false, detalle: `Categoría ${cat}: consumido USD ${total.toFixed(2)} > presupuesto USD ${presupuesto}` };
    }
  }
  return { ok: true, detalle: "Toda factura reenviada se frenó por duplicado y ningún presupuesto se sobregiró." };
}

function BancoPruebas() {
  const qc = useQueryClient();
  useSuspenseQuery(datosMaestrosQuery);
  const [resultados, setResultados] = useState<ResultadoLote[] | null>(null);
  const [dobleCarga, setDobleCarga] = useState<ResultadoDobleCarga | null>(null);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [corriendo, setCorriendo] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [reiniciando, setReiniciando] = useState(false);
  const [confirmacion, setConfirmacion] = useState<"cargar" | "reiniciar" | null>(null);

  /** Contexto limpio (solo datos maestros): la regresión corre como si la bandeja estuviera vacía. */
  async function contextoLimpio() {
    return construirContexto({ incluirHistorial: false });
  }

  async function correrPruebas() {
    setCorriendo(true);
    try {
      const ctx = await contextoLimpio();
      const res = procesarLote(CASOS_PRUEBA, ctx);
      setResultados(res);
      setDobleCarga(verificarDobleCarga(res, ctx));
      toast.success("Pruebas ejecutadas en memoria (sin tocar la base)");
    } catch (e) {
      toast.error("Error al correr pruebas: " + (e as Error).message);
    } finally {
      setCorriendo(false);
    }
  }

  async function cargarEnBandeja() {
    setCargando(true);
    try {
      // Idempotente: primero deja la base como "Reiniciar datos demo"
      await reiniciarDemo();

      // Contexto con el historial recién reiniciado (vacío), ANTES de insertar,
      // para que las facturas del lote no se detecten como duplicados de sí mismas.
      const ctx = await construirContexto();

      // 1. Insertar las facturas
      const facturasInsert = CASOS_PRUEBA.map((c) => ({
        codigo: c.codigo,
        canal: c.canal,
        nombre_archivo: c.archivo,
        tipo_documento: c.tipo_documento,
        emisor: c.emisor,
        receptor: c.receptor,
        numero: c.numero,
        fecha_emision: c.fecha_emision,
        fecha_vencimiento: c.fecha_vencimiento,
        fecha_recepcion: c.fecha_recepcion,
        descripcion: c.descripcion,
        monto: c.monto,
        moneda: c.moneda,
        pago_banco: c.pago_banco ?? null,
        pago_cuenta: c.pago_cuenta ?? null,
        confianza_extraccion: 1,
      }));
      const { data: facturas, error: errF } = await supabase.from("facturas").insert(facturasInsert).select("id, codigo");
      if (errF) throw errF;
      const idPorCodigo = new Map(facturas.map((f) => [f.codigo, f.id]));

      // 2. Procesar con el motor (con los ids reales para enlazar duplicados)
      const casosConId = CASOS_PRUEBA.map((c) => ({ ...c, id: idPorCodigo.get(c.codigo) }));
      const res = procesarLote(casosConId, ctx);

      // 3. Guardar decisiones y eventos
      const ahora = new Date().toISOString();
      const decisionesInsert = res.map(({ factura, decision: d }) => ({
        factura_id: idPorCodigo.get(factura.codigo!)!,
        decision: d.decision,
        estado: d.estado,
        motivo: d.motivo,
        controles: d.controles as unknown as import("@/integrations/supabase/types").Json,
        monto_usd: d.monto_usd,
        proveedor_id: d.proveedor_id,
        categoria: d.categoria,
        cuenta_pago: d.cuenta_pago,
        fecha_programada_pago: d.fecha_programada_pago,
        escalar_a: d.escalar_a,
        factura_relacionada_id: d.factura_relacionada_id,
        politica_version: d.politica_version,
        decidido_por: d.decidido_por,
        decidido_en: ahora,
      }));
      const { error: errD } = await supabase.from("decisiones").insert(decisionesInsert);
      if (errD) throw errD;

      const eventosInsert = res.map(({ factura, decision: d }) => ({
        evento: "decidida",
        actor: d.decidido_por,
        factura_id: idPorCodigo.get(factura.codigo!)!,
        detalle: `${factura.codigo}: ${d.decision} — ${d.motivo}`,
        fecha_hora: ahora,
      }));
      const { error: errE } = await supabase.from("registro_eventos").insert(eventosInsert);
      if (errE) throw errE;

      // 4. Consumir cotizaciones de las facturas aprobadas
      for (const { factura, decision: d } of res) {
        await consumirCotizacionSiAplica(d, idPorCodigo.get(factura.codigo!)!, d.decidido_por);
      }

      setResultados(res);
      setDobleCarga(verificarDobleCarga(res, ctx));
      await qc.invalidateQueries();
      toast.success("18 casos cargados en la bandeja y procesados");
    } catch (e) {
      toast.error("No se pudo cargar: " + (e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  async function reiniciar() {
    setReiniciando(true);
    try {
      await reiniciarDemo();
      setResultados(null);
      setDobleCarga(null);
      await qc.invalidateQueries();
      toast.success("Datos demo reiniciados");
    } catch (e) {
      toast.error("No se pudo reiniciar: " + (e as Error).message);
    } finally {
      setReiniciando(false);
    }
  }

  function toggle(codigo: string) {
    setAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(codigo)) next.delete(codigo);
      else next.add(codigo);
      return next;
    });
  }

  const total = CASOS_PRUEBA.length;
  const coincidencias = resultados?.filter((r) => r.decision.decision === (r.factura as { esperado?: string }).esperado).length ?? 0;
  const inseguros =
    resultados?.filter((r) => {
      const esperado = (r.factura as { esperado?: string }).esperado;
      return esperado !== "PAGAR" && r.decision.decision === "PAGAR";
    }).length ?? 0;
  const autonomos =
    resultados?.filter((r) => {
      const esperado = (r.factura as { esperado?: string }).esperado;
      return ["PAGAR", "FRENAR", "POSTERGAR"].includes(esperado ?? "") && r.decision.decision === esperado;
    }).length ?? 0;


  return (
    <div className="px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Banco de pruebas</h1>
      <p className="mt-2 text-muted-foreground">
        {total} casos con datos ya extraídos (confianza 1) y decisión esperada. El motor corre en memoria con los datos demo, sin tocar la base.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={correrPruebas} disabled={corriendo}>
          <Play className="mr-2 h-4 w-4" /> {corriendo ? "Corriendo…" : "Correr pruebas"}
        </Button>
        <Button variant="secondary" onClick={() => setConfirmacion("cargar")} disabled={cargando}>
          <DatabaseZap className="mr-2 h-4 w-4" /> {cargando ? "Cargando…" : "Cargar los 18 casos en la bandeja"}
        </Button>
        <Button variant="outline" className="border-destructive bg-card text-destructive hover:bg-destructive/5 hover:text-destructive" onClick={() => setConfirmacion("reiniciar")} disabled={reiniciando}>
          {reiniciando ? "Reiniciando…" : "Reiniciar datos demo"}
        </Button>
      </div>

      {resultados && (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-4">
            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm text-muted-foreground">Coincidencias</div>
              <div className="mt-1 text-2xl font-bold">{coincidencias}/{total}</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm text-muted-foreground">Seguridad (pagos fuera de reglas)</div>
              <div className={`mt-1 text-2xl font-bold ${inseguros === 0 ? "text-decision-pagar" : "text-decision-frenar"}`}>{inseguros}</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm text-muted-foreground">Autonomía</div>
              <div className="mt-1 text-2xl font-bold">{formatearPorcentaje(Math.round((autonomos / total) * 100))}</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm text-muted-foreground">Doble carga</div>
              <div className={`mt-1 text-2xl font-bold ${dobleCarga?.ok ? "text-decision-pagar" : "text-decision-frenar"}`}>
                {dobleCarga ? (dobleCarga.ok ? "OK" : "FALLA") : "—"}
              </div>
              {dobleCarga && <div className="mt-1 text-xs text-muted-foreground">{dobleCarga.detalle}</div>}
            </div>
          </div>

          <div className="mt-6 overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Esperada</TableHead>
                  <TableHead>Obtenida</TableHead>
                  <TableHead></TableHead>
                  <TableHead>Fecha programada</TableHead>
                  <TableHead className="min-w-72">Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultados.map((r) => {
                  const caso = r.factura as (typeof CASOS_PRUEBA)[number];
                  const ok = r.decision.decision === caso.esperado;
                  const abierto = abiertos.has(caso.codigo);
                  return (
                    <Fragment key={caso.codigo}>
                      <TableRow className="cursor-pointer" onClick={() => toggle(caso.codigo)}>
                        <TableCell>{abierto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                        <TableCell className="tabular-nums text-xs">{caso.codigo}</TableCell>
                        <TableCell>{caso.canal}</TableCell>
                        <TableCell className="max-w-48 truncate">{caso.emisor}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">
                          {formatearMonto(caso.monto, caso.moneda)}
                        </TableCell>
                        <TableCell><Badge variant={VARIANTES_DECISION[caso.esperado]}>{ETIQUETA_DECISION[caso.esperado as TipoDecision]}</Badge></TableCell>
                        <TableCell><Badge variant={VARIANTES_DECISION[r.decision.decision]}>{ETIQUETA_DECISION[r.decision.decision]}</Badge></TableCell>
                        <TableCell>{ok ? <span title="Coincide">✅</span> : <span title="No coincide">❌</span>}</TableCell>
                        <TableCell className="tabular-nums text-xs">{fmtFecha(r.decision.fecha_programada_pago)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatearTextoNumerico(r.decision.motivo)}</TableCell>
                      </TableRow>
                      {abierto && (
                        <TableRow>
                          <TableCell colSpan={10} className="bg-muted/40 p-4">
                            <PanelControles controles={r.decision.controles} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {!resultados && (
        <div className="mt-8 rounded-lg border bg-card p-6">
          <h2 className="font-bold">Datos demo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            «Reiniciar datos demo» borra facturas, decisiones y eventos, y vuelve a cargar empresa, cuentas, política v1, tipos de cambio, proveedores, contratos y pagos previos.
          </p>
        </div>
      )}

      <AlertDialog open={confirmacion !== null} onOpenChange={(open) => !open && setConfirmacion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmacion === "cargar" ? "Cargar los 18 casos" : "Reiniciar datos demo"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmacion === "cargar"
                ? "Se borrarán las facturas, decisiones y eventos actuales y se cargarán los 18 casos como facturas reales, con sus decisiones y eventos. ¿Continuar?"
                : "Se borrarán facturas, decisiones y eventos, y se recargarán los datos maestros. ¿Continuar?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const accion = confirmacion;
                setConfirmacion(null);
                if (accion === "cargar") void cargarEnBandeja();
                else if (accion === "reiniciar") void reiniciar();
              }}
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
