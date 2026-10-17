import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, XCircle, MinusCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { datosMaestrosQuery, facturaDetalleQuery, USUARIOS_DEMO, type Decision, type Factura } from "@/lib/datos";
import { ESTILO_DECISION, fmtFecha, fmtFechaCorta, fmtFechaHora, fmtMonto } from "@/lib/formato";
import { viernesPago, type Control, type ResultadoControl } from "@/lib/motorReglas";

export const Route = createFileRoute("/factura/$id")({
  head: () => ({
    meta: [
      { title: "Detalle de factura — Contralor" },
      { name: "description", content: "Datos extraídos, decisión del motor y traza de controles." },
      { property: "og:title", content: "Detalle de factura — Contralor" },
      { property: "og:description", content: "Decisión y traza auditable de la factura." },
    ],
  }),
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(facturaDetalleQuery(params.id)),
      context.queryClient.ensureQueryData(datosMaestrosQuery),
    ]),
  component: DetalleFactura,
});

const ICONO_CONTROL: Record<ResultadoControl, React.ReactNode> = {
  OK: <CheckCircle2 className="h-4 w-4 text-decision-pagar" />,
  FALLA: <XCircle className="h-4 w-4 text-decision-frenar" />,
  NO_APLICA: <MinusCircle className="h-4 w-4 text-muted-foreground" />,
  NO_EVALUABLE: <AlertTriangle className="h-4 w-4 text-decision-escalar" />,
};

const ETIQUETA_CONTROL: Record<ResultadoControl, string> = {
  OK: "OK",
  FALLA: "FALLA",
  NO_APLICA: "NO APLICA",
  NO_EVALUABLE: "NO EVALUABLE",
};

function DetalleFactura() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(facturaDetalleQuery(id));
  const { data: maestros } = useSuspenseQuery(datosMaestrosQuery);
  const { factura, decisiones, eventos } = data;
  const decision = decisiones[0] ?? null;

  return (
    <div className="px-6 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver al tablero
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        {/* Izquierda: documento original */}
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="font-medium">Documento original</h2>
            <p className="text-xs text-muted-foreground">
              {factura.nombre_archivo ?? `Mensaje por ${factura.canal ?? "canal desconocido"}`} · Recibida {fmtFechaHora(factura.fecha_recepcion)}
            </p>
          </div>
          <div className="p-4">
            {factura.archivo_url ? (
              factura.archivo_url.toLowerCase().endsWith(".pdf") ? (
                <iframe src={factura.archivo_url} title="Documento original" className="h-[32rem] w-full rounded border bg-muted" />
              ) : (
                <img src={factura.archivo_url} alt="Documento original" className="max-h-[32rem] w-full rounded border object-contain" />
              )
            ) : (
              <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded bg-muted p-4 font-mono text-xs leading-relaxed">
                {factura.texto_original ?? "Sin contenido del documento."}
              </pre>
            )}
          </div>
        </div>

        {/* Derecha: datos + decisión */}
        <div className="space-y-6">
          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-medium">Datos extraídos</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Campo etiqueta="Proveedor (emisor)" valor={factura.emisor} />
              <Campo etiqueta="Receptor" valor={factura.receptor} />
              <Campo etiqueta="Número" valor={factura.numero} mono />
              <Campo etiqueta="Tipo de documento" valor={factura.tipo_documento} />
              <Campo etiqueta="Emisión" valor={fmtFecha(factura.fecha_emision)} />
              <Campo etiqueta="Vencimiento" valor={fmtFecha(factura.fecha_vencimiento)} />
              <Campo etiqueta="Monto" valor={fmtMonto(factura.monto, factura.moneda)} mono />
              <Campo etiqueta="Confianza de extracción" valor={factura.confianza_extraccion != null ? String(factura.confianza_extraccion) : "—"} />
              <div className="col-span-2">
                <Campo etiqueta="Descripción" valor={factura.descripcion} />
              </div>
              <Campo etiqueta="Banco de pago" valor={factura.pago_banco} />
              <Campo etiqueta="Cuenta de pago" valor={factura.pago_cuenta} mono />
            </dl>
          </div>

          {decision && (
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <Badge className={`${ESTILO_DECISION[decision.decision as keyof typeof ESTILO_DECISION]} px-3 py-1 text-base`}>{decision.decision}</Badge>
                <span className="text-xs text-muted-foreground">Política {decision.politica_version}</span>
              </div>
              <p className="mt-3 text-sm">{decision.motivo}</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <Campo etiqueta="Decidido por" valor={decision.estado === "aprobada_humano" ? `${decision.aprobador} (aprobación humana)` : decision.decidido_por} />
                <Campo etiqueta="Fecha programada" valor={decision.fecha_programada_pago ? fmtFechaCorta(decision.fecha_programada_pago) : "—"} />
                <Campo etiqueta="Cuenta de pago" valor={decision.cuenta_pago} mono />
                <Campo etiqueta="Monto USD" valor={fmtMonto(decision.monto_usd, "USD")} mono />
              </dl>
              {decision.ajuste != null && (
                <div className="mt-3 rounded bg-muted p-3 text-xs">
                  <span className="font-medium">Ajuste aplicado:</span>{" "}
                  <span className="font-mono">{JSON.stringify(decision.ajuste)}</span>
                </div>
              )}

              <h3 className="mt-5 font-medium">¿Por qué? — Controles R0–R10</h3>
              <ul className="mt-2 space-y-2">
                {(decision.controles as unknown as Control[]).map((c) => (
                  <li key={c.regla} className="flex gap-2 text-sm">
                    <span className="mt-0.5 shrink-0">{ICONO_CONTROL[c.resultado]}</span>
                    <div>
                      <span className="font-medium">
                        {c.regla} {c.control}
                      </span>{" "}
                      <span className="text-xs text-muted-foreground">({ETIQUETA_CONTROL[c.resultado]})</span>
                      <p className="text-xs text-muted-foreground">{c.detalle}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {decision?.estado === "pendiente_aprobacion" && (
            <AprobacionHumana factura={factura} decision={decision} cuentas={maestros.cuentas} />
          )}

          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-medium">Línea de tiempo</h2>
            {eventos.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Sin eventos registrados.</p>
            ) : (
              <ol className="mt-3 space-y-3 border-l pl-4">
                {eventos.map((e) => (
                  <li key={e.id} className="relative text-sm">
                    <span className="absolute -left-[1.35rem] top-1.5 h-2 w-2 rounded-full bg-primary" />
                    <div className="font-medium">{e.evento}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtFechaHora(e.fecha_hora)} · {e.actor}
                    </div>
                    {e.detalle && <div className="text-xs text-muted-foreground">{e.detalle}</div>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Campo({ etiqueta, valor, mono }: { etiqueta: string; valor: string | null | undefined; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
      <dd className={mono ? "font-mono text-xs" : ""}>{valor ?? "—"}</dd>
    </div>
  );
}

function AprobacionHumana({ factura, decision, cuentas }: { factura: Factura; decision: Decision; cuentas: { id: string; banco: string; moneda: string }[] }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState<string>("");
  const [comentario, setComentario] = useState("");
  const [opcionR6, setOpcionR6] = useState<"facturado" | "contrato">("facturado");
  const [cuentaElegida, setCuentaElegida] = useState(decision.cuenta_pago ?? "BANK-USD");
  const [tipoCambio, setTipoCambio] = useState("7.70");
  const [guardando, setGuardando] = useState(false);

  const controles = decision.controles as unknown as Control[];
  const falloR4 = controles.some((c) => c.regla === "R4" && c.resultado === "FALLA");
  const falloR6 = controles.some((c) => c.regla === "R6" && c.resultado === "FALLA");
  const falloR7 = controles.some((c) => c.regla === "R7" && c.resultado === "FALLA");

  const contratoMonto = (() => {
    if (!falloR6) return null;
    return null; // el monto del contrato se muestra en el detalle de R6
  })();
  void contratoMonto;

  const tc = Number(tipoCambio) || 0;
  const cuentaDest = cuentas.find((c) => c.id === cuentaElegida);
  const montoConvertido =
    falloR7 && factura.monto != null && factura.moneda && cuentaDest && tc > 0
      ? factura.moneda === cuentaDest.moneda
        ? factura.monto
        : factura.moneda === "USD"
          ? Math.round(factura.monto * tc * 100) / 100
          : cuentaDest.moneda === "USD"
            ? Math.round((factura.monto / tc) * 100) / 100
            : null
      : null;

  async function aprobar() {
    if (!usuario) return void toast.error("Elige quién aprueba");
    if (!comentario.trim()) return void toast.error("El comentario es obligatorio");
    setGuardando(true);
    try {
      const ajuste: Record<string, unknown> = {};
      if (falloR6) ajuste.monto = opcionR6 === "contrato" ? "ajustado_al_contrato" : "monto_facturado";
      if (falloR7) {
        ajuste.conversion = { cuenta_pago: cuentaElegida, tipo_cambio: tc, monto_final: montoConvertido, moneda_final: cuentaDest?.moneda };
      }
      const { error } = await supabase
        .from("decisiones")
        .update({
          decision: "PAGAR",
          estado: "aprobada_humano",
          aprobador: usuario,
          aprobado_en: new Date().toISOString(),
          comentario_aprobacion: comentario.trim(),
          fecha_programada_pago: viernesPago(factura.fecha_recepcion ?? new Date().toISOString().slice(0, 10)),
          cuenta_pago: falloR7 ? cuentaElegida : decision.cuenta_pago,
          ajuste: Object.keys(ajuste).length > 0 ? (ajuste as unknown as import("@/integrations/supabase/types").Json) : null,
        })
        .eq("id", decision.id);
      if (error) throw error;
      const { error: errEv } = await supabase.from("registro_eventos").insert({
        factura_id: factura.id,
        evento: "aprobada",
        actor: usuario,
        detalle: `Aprobación humana: ${comentario.trim()}`,
      });
      if (errEv) throw errEv;
      await qc.invalidateQueries();
      toast.success("Pago aprobado y programado");
      navigate({ to: "/" });
    } catch (e) {
      toast.error("No se pudo aprobar: " + (e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  async function rechazar() {
    if (!usuario) return void toast.error("Elige quién rechaza");
    if (!comentario.trim()) return void toast.error("El comentario es obligatorio");
    setGuardando(true);
    try {
      const { error } = await supabase
        .from("decisiones")
        .update({ estado: "rechazada_humano", aprobador: usuario, aprobado_en: new Date().toISOString(), comentario_aprobacion: comentario.trim() })
        .eq("id", decision.id);
      if (error) throw error;
      const { error: errEv } = await supabase.from("registro_eventos").insert({
        factura_id: factura.id,
        evento: "rechazada",
        actor: usuario,
        detalle: `Rechazada: ${comentario.trim()}`,
      });
      if (errEv) throw errEv;
      await qc.invalidateQueries();
      toast.success("Factura rechazada");
      navigate({ to: "/" });
    } catch (e) {
      toast.error("No se pudo rechazar: " + (e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="rounded-lg border border-decision-escalar bg-card p-4">
      <h2 className="font-medium">Aprobación humana</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Esta decisión quedó escalada{decision.escalar_a ? ` a ${decision.escalar_a}` : ""}. La decisión original del agente y su traza se conservan.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <Label>¿Quién decide?</Label>
          <Select value={usuario} onValueChange={setUsuario}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Elige un usuario" /></SelectTrigger>
            <SelectContent>
              {USUARIOS_DEMO.map((u) => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {falloR6 && (
          <div>
            <Label>Diferencia contra contrato (R6)</Label>
            <RadioGroup value={opcionR6} onValueChange={(v) => setOpcionR6(v as "facturado" | "contrato")} className="mt-1">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="facturado" id="r6-facturado" />
                <Label htmlFor="r6-facturado" className="font-normal">Pagar el monto facturado ({fmtMonto(factura.monto, factura.moneda)})</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="contrato" id="r6-contrato" />
                <Label htmlFor="r6-contrato" className="font-normal">Ajustar al monto del contrato/cotización</Label>
              </div>
            </RadioGroup>
          </div>
        )}

        {falloR7 && (
          <div className="space-y-2">
            <Label>Conversión de moneda (R7)</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Cuenta de pago</Label>
                <Select value={cuentaElegida} onValueChange={setCuentaElegida}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {cuentas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.id} ({c.moneda})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Tipo de cambio (por USD)</Label>
                <Input className="mt-1 font-mono" value={tipoCambio} onChange={(e) => setTipoCambio(e.target.value)} inputMode="decimal" />
              </div>
            </div>
            {montoConvertido != null && cuentaDest && (
              <p className="rounded bg-muted p-2 font-mono text-xs">
                {fmtMonto(factura.monto, factura.moneda)} → {fmtMonto(montoConvertido, cuentaDest.moneda)} desde {cuentaElegida}
              </p>
            )}
          </div>
        )}

        {falloR4 && (
          <p className="rounded bg-muted p-2 text-xs">
            El proveedor no está registrado o su expediente está incompleto. El comentario debe indicar el tratamiento fiscal decidido.{" "}
            <Link to="/proveedores" className="text-primary underline underline-offset-2">Registrar proveedor</Link>
          </p>
        )}

        <div>
          <Label>Comentario (obligatorio)</Label>
          <Textarea className="mt-1" value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Explica la decisión…" />
        </div>

        <div className="flex gap-2">
          <Button onClick={aprobar} disabled={guardando} className="bg-decision-pagar text-decision-pagar-foreground hover:opacity-90">
            Aprobar pago
          </Button>
          <Button onClick={rechazar} disabled={guardando} variant="destructive">
            Rechazar
          </Button>
        </div>
      </div>
    </div>
  );
}
