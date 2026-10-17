import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, MinusCircle, AlertCircle, ChevronDown, ChevronRight, Play, DatabaseZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { datosMaestrosQuery, reiniciarDemo } from "@/lib/datos";
import { supabase } from "@/integrations/supabase/client";
import { CASOS_PRUEBA } from "@/lib/casosPrueba";
import { procesarLote, type ContextoMotor, type Control, type ParametrosPolitica, type ResultadoLote } from "@/lib/motorReglas";

export const Route = createFileRoute("/banco-pruebas")({
  head: () => ({
    meta: [
      { title: "Banco de pruebas — Contralor" },
      { name: "description", content: "Casos de prueba del motor de reglas y reinicio de datos demo." },
      { property: "og:title", content: "Banco de pruebas — Contralor" },
      { property: "og:description", content: "Casos de prueba del motor de reglas." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(datosMaestrosQuery),
  component: BancoPruebas,
});

const ICONOS: Record<Control["resultado"], typeof CheckCircle2> = {
  OK: CheckCircle2,
  FALLA: XCircle,
  NO_APLICA: MinusCircle,
  NO_EVALUABLE: AlertCircle,
};

const COLORES: Record<Control["resultado"], string> = {
  OK: "text-green-600",
  FALLA: "text-red-600",
  NO_APLICA: "text-muted-foreground",
  NO_EVALUABLE: "text-amber-600",
};

const VARIANTES_DECISION: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  PAGAR: "default",
  FRENAR: "destructive",
  ESCALAR: "secondary",
  POSTERGAR: "outline",
};

function BancoPruebas() {
  const qc = useQueryClient();
  const { data: maestros } = useSuspenseQuery(datosMaestrosQuery);
  const [resultados, setResultados] = useState<ResultadoLote[] | null>(null);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [corriendo, setCorriendo] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [reiniciando, setReiniciando] = useState(false);

  function construirContexto(): ContextoMotor {
    return {
      politicaVersion: maestros.politica.version,
      parametros: maestros.politica.parametros as unknown as ParametrosPolitica,
      tiposCambio: maestros.tiposCambio,
      proveedores: maestros.proveedores,
      contratos: maestros.contratos,
      cuentas: maestros.cuentas,
      pagosPrevios: maestros.pagosPrevios,
      decisionesPrevias: [],
      facturasRecibidas: [],
    };
  }

  function correrPruebas() {
    setCorriendo(true);
    try {
      setResultados(procesarLote(CASOS_PRUEBA, construirContexto()));
      toast.success("Pruebas ejecutadas en memoria (sin tocar la base)");
    } catch (e) {
      toast.error("Error al correr pruebas: " + (e as Error).message);
    } finally {
      setCorriendo(false);
    }
  }

  async function cargarEnBandeja() {
    if (!confirm("Se insertarán los 18 casos como facturas reales y se guardarán sus decisiones y eventos. ¿Continuar?")) return;
    setCargando(true);
    try {
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
      const res = procesarLote(casosConId, construirContexto());

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

      setResultados(res);
      await qc.invalidateQueries();
      toast.success("18 casos cargados en la bandeja y procesados");
    } catch (e) {
      toast.error("No se pudo cargar: " + (e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  async function reiniciar() {
    if (!confirm("Se borrarán facturas, decisiones y eventos, y se recargarán los datos maestros. ¿Continuar?")) return;
    setReiniciando(true);
    try {
      await reiniciarDemo();
      setResultados(null);
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
      <h1 className="text-2xl font-semibold tracking-tight">Banco de pruebas</h1>
      <p className="mt-2 text-muted-foreground">
        {total} casos con datos ya extraídos (confianza 1) y decisión esperada. El motor corre en memoria con los datos demo, sin tocar la base.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={correrPruebas} disabled={corriendo}>
          <Play className="mr-2 h-4 w-4" /> Correr pruebas
        </Button>
        <Button variant="secondary" onClick={cargarEnBandeja} disabled={cargando}>
          <DatabaseZap className="mr-2 h-4 w-4" /> {cargando ? "Cargando…" : "Cargar los 18 casos en la bandeja"}
        </Button>
        <Button variant="destructive" onClick={reiniciar} disabled={reiniciando}>
          {reiniciando ? "Reiniciando…" : "Reiniciar datos demo"}
        </Button>
      </div>

      {resultados && (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm text-muted-foreground">Coincidencias</div>
              <div className="mt-1 text-2xl font-semibold">{coincidencias}/{total}</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm text-muted-foreground">Seguridad (pagos fuera de reglas)</div>
              <div className={`mt-1 text-2xl font-semibold ${inseguros === 0 ? "text-green-600" : "text-red-600"}`}>{inseguros}</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm text-muted-foreground">Autonomía</div>
              <div className="mt-1 text-2xl font-semibold">{Math.round((autonomos / total) * 100)}%</div>
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
                    <>
                      <TableRow key={caso.codigo} className="cursor-pointer" onClick={() => toggle(caso.codigo)}>
                        <TableCell>{abierto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                        <TableCell className="font-mono text-xs">{caso.codigo}</TableCell>
                        <TableCell>{caso.canal}</TableCell>
                        <TableCell className="max-w-48 truncate">{caso.emisor}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {caso.monto?.toLocaleString("en-US", { minimumFractionDigits: 2 })} {caso.moneda}
                        </TableCell>
                        <TableCell><Badge variant={VARIANTES_DECISION[caso.esperado]}>{caso.esperado}</Badge></TableCell>
                        <TableCell><Badge variant={VARIANTES_DECISION[r.decision.decision]}>{r.decision.decision}</Badge></TableCell>
                        <TableCell>{ok ? <span title="Coincide">✅</span> : <span title="No coincide">❌</span>}</TableCell>
                        <TableCell className="font-mono text-xs">{r.decision.fecha_programada_pago ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.decision.motivo}</TableCell>
                      </TableRow>
                      {abierto && (
                        <TableRow key={`${caso.codigo}-detalle`}>
                          <TableCell colSpan={10} className="bg-muted/40 p-4">
                            <div className="space-y-2">
                              {r.decision.controles.map((c) => {
                                const Icono = ICONOS[c.resultado];
                                return (
                                  <div key={c.regla} className="flex items-start gap-2 text-sm">
                                    <Icono className={`mt-0.5 h-4 w-4 shrink-0 ${COLORES[c.resultado]}`} />
                                    <div>
                                      <span className="font-medium">{c.regla} {c.control}</span>
                                      <span className="ml-2 text-xs text-muted-foreground">({c.resultado}{c.si_falla ? ` → ${c.si_falla}` : ""})</span>
                                      <div className="text-xs text-muted-foreground">{c.detalle}</div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {!resultados && (
        <div className="mt-8 rounded-lg border bg-card p-6">
          <h2 className="font-medium">Datos demo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            «Reiniciar datos demo» borra facturas, decisiones y eventos, y vuelve a cargar empresa, cuentas, política v1, tipos de cambio, proveedores, contratos y pagos previos.
          </p>
        </div>
      )}
    </div>
  );
}
