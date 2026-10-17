import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { datosMaestrosQuery, decisionesQuery, facturasQuery, politicasQuery, USUARIOS_DEMO } from "@/lib/datos";
import { fmtFechaHora, fmtMonto } from "@/lib/formato";
import { evaluarFactura, type ParametrosPolitica } from "@/lib/motorReglas";

export const Route = createFileRoute("/reglas")({
  head: () => ({
    meta: [
      { title: "Reglas — Contralor" },
      { name: "description", content: "Política de pagos versionada de Andes Labs." },
      { property: "og:title", content: "Reglas — Contralor" },
      { property: "og:description", content: "Política de pagos versionada." },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(politicasQuery),
      context.queryClient.ensureQueryData(datosMaestrosQuery),
    ]),
  component: Reglas,
});

const EXPLICACION_REGLAS: { regla: string; nombre: string; que: string; siFalla: string }[] = [
  { regla: "R0", nombre: "Lectura confiable", que: "La IA solo extrae datos; si la lectura del documento tiene baja confianza, no se puede decidir a ciegas.", siFalla: "Se escala a Finanzas para revisión manual." },
  { regla: "R1", nombre: "Documento válido y completo", que: "La factura debe ser de un tipo válido y traer todos los campos obligatorios.", siFalla: "Se frena: no es un documento pagable." },
  { regla: "R2", nombre: "Emitida a nombre de la empresa", que: "La factura debe estar emitida a nombre de Andes Labs LLC.", siFalla: "Se frena: podría ser de otra empresa." },
  { regla: "R3", nombre: "No es duplicado", que: "La misma factura no debe pagarse dos veces (ni por pago previo ni por otra recepción).", siFalla: "Se frena y se enlaza a la original." },
  { regla: "R4", nombre: "Proveedor registrado y autorizado", que: "El emisor debe estar en el registro, activo y con expediente completo.", siFalla: "Se escala a Contabilidad." },
  { regla: "R5", nombre: "Datos de pago coinciden", que: "La cuenta a la que pide pagar la factura debe ser la registrada del proveedor.", siFalla: "Se escala a Finanzas (posible fraude)." },
  { regla: "R6", nombre: "Coincide con contrato o cotización", que: "El monto debe coincidir con el contrato dentro de la tolerancia configurada.", siFalla: "Se escala a Finanzas." },
  { regla: "R7", nombre: "Moneda compatible con la cuenta de pago", que: "La moneda de la factura debe poder pagarse desde la cuenta asignada.", siFalla: "Se escala a Finanzas para conversión manual." },
  { regla: "R8", nombre: "Bajo el tope por pago", que: "Ningún pago automático puede superar el tope en USD.", siFalla: "Se escala a Finanzas." },
  { regla: "R9", nombre: "Presupuesto del periodo", que: "La categoría debe tener presupuesto disponible en el mes.", siFalla: "Montos pequeños se postergan al mes siguiente; montos grandes se escalan." },
  { regla: "R10", nombre: "Saldo suficiente", que: "La cuenta de pago debe cubrir el monto además de lo ya programado.", siFalla: "Se escala a Finanzas." },
];

const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

function Reglas() {
  const qc = useQueryClient();
  const { data: politicas } = useSuspenseQuery(politicasQuery);
  const { data: maestros } = useSuspenseQuery(datosMaestrosQuery);
  const vigente = politicas.find((p) => p.vigente) ?? maestros.politica;
  const p = vigente.parametros as unknown as ParametrosPolitica;

  const [receptor, setReceptor] = useState(p.receptor_valido);
  const [tope, setTope] = useState(String(p.tope_por_pago_usd));
  const [tolerancia, setTolerancia] = useState(String(p.tolerancia_contrato_pct));
  const [postMax, setPostMax] = useState(String(p.postergacion_automatica_max_usd));
  const [diaCorte, setDiaCorte] = useState(p.calendario_pagos.dia_corte);
  const [diaPago, setDiaPago] = useState(p.calendario_pagos.dia_pago);
  const [presupuestos, setPresupuestos] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(p.presupuesto_por_categoria_usd).map(([k, v]) => [k, String(v)])),
  );
  const [tasas, setTasas] = useState<Record<string, string>>(
    Object.fromEntries(maestros.tiposCambio.map((t) => [t.moneda, String(t.por_usd)])),
  );
  const [creador, setCreador] = useState<string>(USUARIOS_DEMO[0]);
  const [guardando, setGuardando] = useState(false);
  const [reevaluando, setReevaluando] = useState(false);

  async function guardarNuevaVersion() {
    setGuardando(true);
    try {
      const numeros = politicas.map((x) => Number(x.version.replace(/^v/, ""))).filter((n) => !Number.isNaN(n));
      const nuevaVersion = `v${Math.max(...numeros, 1) + 1}`;
      const parametros: ParametrosPolitica = {
        ...p,
        receptor_valido: receptor.trim(),
        tope_por_pago_usd: Number(tope) || 0,
        tolerancia_contrato_pct: Number(tolerancia) || 0,
        postergacion_automatica_max_usd: Number(postMax) || 0,
        calendario_pagos: { dia_corte: diaCorte, dia_pago: diaPago },
        presupuesto_por_categoria_usd: Object.fromEntries(Object.entries(presupuestos).map(([k, v]) => [k, Number(v) || 0])),
      };
      const { error: e1 } = await supabase.from("politicas").update({ vigente: false }).eq("id", vigente.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("politicas").insert({ version: nuevaVersion, vigente: true, creada_por: creador, parametros: parametros as unknown as import("@/integrations/supabase/types").Json });
      if (e2) throw e2;
      const { error: e3 } = await supabase.from("registro_eventos").insert({
        evento: "politica_modificada",
        actor: creador,
        detalle: `Nueva versión ${nuevaVersion} (antes ${vigente.version}). Tope USD ${tope}, tolerancia ${tolerancia}%, postergación máx USD ${postMax}.`,
      });
      if (e3) throw e3;
      await qc.invalidateQueries();
      toast.success(`Política ${nuevaVersion} creada y vigente`);
    } catch (e) {
      toast.error("No se pudo guardar: " + (e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  async function reevaluarPendientes() {
    setReevaluando(true);
    try {
      const [{ data: pendientes, error: e1 }, { data: facturas, error: e2 }] = await Promise.all([
        supabase.from("decisiones").select("*").eq("estado", "pendiente_aprobacion"),
        supabase.from("facturas").select("*"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const ctx = {
        politicaVersion: vigente.version,
        parametros: p,
        tiposCambio: maestros.tiposCambio,
        proveedores: maestros.proveedores,
        contratos: maestros.contratos,
        cuentas: maestros.cuentas,
        pagosPrevios: maestros.pagosPrevios,
        decisionesPrevias: [],
        facturasRecibidas: (facturas ?? []).map((f) => ({
          id: f.id, codigo: f.codigo, emisor: f.emisor, numero: f.numero,
          fecha_recepcion: f.fecha_recepcion ?? "", canal: f.canal,
        })),
      };
      let actualizadas = 0;
      for (const d of pendientes ?? []) {
        const f = (facturas ?? []).find((x) => x.id === d.factura_id);
        if (!f) continue;
        const nueva = evaluarFactura(
          {
            id: f.id, codigo: f.codigo ?? undefined, canal: f.canal, tipo_documento: f.tipo_documento, emisor: f.emisor,
            receptor: f.receptor, numero: f.numero, fecha_emision: f.fecha_emision, fecha_vencimiento: f.fecha_vencimiento,
            descripcion: f.descripcion, monto: f.monto, moneda: f.moneda, pago_banco: f.pago_banco, pago_cuenta: f.pago_cuenta,
            confianza_extraccion: f.confianza_extraccion, fecha_recepcion: f.fecha_recepcion ?? new Date().toISOString().slice(0, 10),
          },
          ctx,
        );
        const { error } = await supabase
          .from("decisiones")
          .update({
            decision: nueva.decision, estado: nueva.estado, motivo: nueva.motivo, controles: nueva.controles as unknown as import("@/integrations/supabase/types").Json,
            monto_usd: nueva.monto_usd, proveedor_id: nueva.proveedor_id, categoria: nueva.categoria,
            cuenta_pago: nueva.cuenta_pago, fecha_programada_pago: nueva.fecha_programada_pago,
            escalar_a: nueva.escalar_a, factura_relacionada_id: nueva.factura_relacionada_id,
            politica_version: nueva.politica_version, decidido_por: nueva.decidido_por,
          })
          .eq("id", d.id);
        if (error) throw error;
        await supabase.from("registro_eventos").insert({
          factura_id: d.factura_id, evento: "reevaluada", actor: "Agente (automático)",
          detalle: `Re-evaluada con política ${vigente.version}: ${d.decision} → ${nueva.decision}.`,
        });
        actualizadas++;
      }
      await qc.invalidateQueries();
      toast.success(`${actualizadas} pendientes re-evaluadas con la política ${vigente.version}`);
    } catch (e) {
      toast.error("No se pudo re-evaluar: " + (e as Error).message);
    } finally {
      setReevaluando(false);
    }
  }

  return (
    <div className="px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Reglas de la política</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Política vigente: <span className="font-medium text-foreground">{vigente.version}</span>. Las versiones nunca se sobrescriben: guardar crea una nueva.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Formulario */}
        <div className="rounded-lg border bg-card p-5">
          <h2 className="font-medium">Parámetros vigentes</h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Receptor válido (nombre exacto de la empresa)</Label>
              <Input className="mt-1" value={receptor} onChange={(e) => setReceptor(e.target.value)} />
            </div>
            <div>
              <Label>Tope por pago (USD)</Label>
              <Input className="mt-1 font-mono" value={tope} onChange={(e) => setTope(e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <Label>Tolerancia contra contrato (%)</Label>
              <Input className="mt-1 font-mono" value={tolerancia} onChange={(e) => setTolerancia(e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <Label>Límite de postergación automática (USD)</Label>
              <Input className="mt-1 font-mono" value={postMax} onChange={(e) => setPostMax(e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <Label>Guarda como</Label>
              <Select value={creador} onValueChange={setCreador}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {USUARIOS_DEMO.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Día de corte</Label>
              <Select value={diaCorte} onValueChange={setDiaCorte}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{DIAS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Día de pago</Label>
              <Select value={diaPago} onValueChange={setDiaPago}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{DIAS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <h3 className="mt-5 text-sm font-medium">Presupuesto por categoría (USD / mes)</h3>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {Object.entries(presupuestos).map(([cat, val]) => (
              <div key={cat}>
                <Label className="text-xs text-muted-foreground">{cat}</Label>
                <Input className="mt-1 font-mono" value={val} inputMode="decimal"
                  onChange={(e) => setPresupuestos((prev) => ({ ...prev, [cat]: e.target.value }))} />
              </div>
            ))}
          </div>

          <h3 className="mt-5 text-sm font-medium">Tipos de cambio (unidades por USD)</h3>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {Object.entries(tasas).map(([moneda, val]) => (
              <div key={moneda}>
                <Label className="text-xs text-muted-foreground">{moneda}</Label>
                <Input className="mt-1 font-mono" value={val} inputMode="decimal"
                  onChange={(e) => setTasas((prev) => ({ ...prev, [moneda]: e.target.value }))} />
              </div>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Los tipos de cambio se muestran como referencia; su vigencia se administra en la base de datos.</p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={guardarNuevaVersion} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar como nueva versión"}
            </Button>
            <Button variant="outline" onClick={reevaluarPendientes} disabled={reevaluando}>
              {reevaluando ? "Re-evaluando…" : "Re-evaluar pendientes con la política vigente"}
            </Button>
          </div>
        </div>

        {/* Explicación + historial */}
        <div className="space-y-6">
          <div className="rounded-lg border bg-card p-5">
            <h2 className="font-medium">Qué revisa el motor, en orden</h2>
            <ol className="mt-3 space-y-3">
              {EXPLICACION_REGLAS.map((r) => (
                <li key={r.regla} className="text-sm">
                  <span className="font-mono text-xs font-semibold">{r.regla}</span>{" "}
                  <span className="font-medium">{r.nombre}.</span>{" "}
                  <span className="text-muted-foreground">{r.que}</span>{" "}
                  <span className="text-xs text-muted-foreground">Si falla: {r.siFalla}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-lg border bg-card p-5">
            <h2 className="font-medium">Historial de versiones</h2>
            <ul className="mt-3 space-y-3">
              {[...politicas].reverse().map((pol) => {
                const pp = pol.parametros as unknown as ParametrosPolitica;
                return (
                  <li key={pol.id} className="rounded border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold">{pol.version}</span>
                      {pol.vigente && <span className="rounded bg-decision-pagar px-2 py-0.5 text-xs text-decision-pagar-foreground">Vigente</span>}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Creada por {pol.creada_por} · {fmtFechaHora(pol.creada_en)}
                    </div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">
                      Tope {fmtMonto(pp.tope_por_pago_usd, "USD")} · tolerancia {pp.tolerancia_contrato_pct}% · postergación máx {fmtMonto(pp.postergacion_automatica_max_usd, "USD")}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// decisionesQuery y facturasQuery quedan disponibles para futuras vistas de esta pantalla.
void decisionesQuery;
void facturasQuery;
