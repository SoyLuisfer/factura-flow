import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Pencil } from "lucide-react";
import { PanelControles } from "@/components/panel-controles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { datosMaestrosQuery, facturaDetalleQuery, USUARIOS_DEMO, type Decision, type Factura } from "@/lib/datos";
import { construirContexto } from "@/lib/contexto";
import { consumirCotizacionSiAplica } from "@/lib/cotizaciones";
import { ESTILO_DECISION, etiquetaDecision, fmtFecha, fmtFechaCorta, fmtFechaHora, fmtMonto, formatearTextoNumerico, formatearTipoCambio } from "@/lib/formato";
import { MontoInput } from "@/components/monto-input";
import { evaluarFactura, viernesPago, type Control, type FacturaEntrada } from "@/lib/motorReglas";
import { MONEDAS_DISPONIBLES } from "@/lib/extraccion";

export const Route = createFileRoute("/factura/$id")({
  head: () => ({
    meta: [
      { title: "Detalle de factura — Contralor" },
      { name: "description", content: "Datos extraídos, decisión del motor y traza de controles." },
      { property: "og:title", content: "Detalle de factura — Contralor" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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

function DetalleFactura() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(facturaDetalleQuery(id));
  const { data: maestros } = useSuspenseQuery(datosMaestrosQuery);
  const { factura, decisiones, eventos, relacionada } = data;
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
            <VisorDocumento factura={factura} />
          </div>
        </div>

        {/* Derecha: datos + decisión */}
        <div className="space-y-6">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Datos extraídos</h2>
              <CorreccionDialog factura={factura} />
            </div>
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
                <Badge className={`${ESTILO_DECISION[decision.decision as keyof typeof ESTILO_DECISION]} px-3 py-1 text-base`}>{etiquetaDecision(decision.decision, decision.estado)}</Badge>
                <span className="text-xs text-muted-foreground">Política {decision.politica_version}</span>
              </div>
              <p className="mt-3 text-sm">{formatearTextoNumerico(decision.motivo)}</p>
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

              <h3 className="mt-5 font-medium">¿Por qué?</h3>
              <div className="mt-2">
                <PanelControles controles={decision.controles as unknown as Control[]} />
              </div>
              <EnlaceDuplicado decision={decision} relacionada={relacionada} />
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
                    {e.detalle && (
                      <div className="text-xs text-muted-foreground">
                        {formatearTextoNumerico(e.evento === "extraida" ? e.detalle.replace(/^Extraída con [^(]+/, "Extraída con IA") : e.detalle)}
                      </div>
                    )}
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

/** Si R3 falló por duplicado: enlace a la factura original, o el ID del pago previo (sin enlace). */
function EnlaceDuplicado({ decision, relacionada }: { decision: Decision; relacionada: { id: string; codigo: string | null; numero: string | null } | null }) {
  const controles = decision.controles as unknown as Control[];
  const r3 = controles.find((c) => c.regla === "R3" && c.resultado === "FALLA");
  if (!r3) return null;
  if (decision.factura_relacionada_id && relacionada) {
    return (
      <div className="mt-3 text-sm">
        <Link to="/factura/$id" params={{ id: relacionada.id }} className="text-primary underline underline-offset-2">
          Ver factura original{relacionada.codigo ? ` (${relacionada.codigo})` : relacionada.numero ? ` (${relacionada.numero})` : ""}
        </Link>
      </div>
    );
  }
  const pagoPrevio = /\(pago ([A-Z]+-\d+)/.exec(r3.detalle)?.[1];
  if (pagoPrevio) {
    return <p className="mt-3 text-xs text-muted-foreground">Duplicada contra el pago previo {pagoPrevio}.</p>;
  }
  return null;
}

function Campo({ etiqueta, valor, mono }: { etiqueta: string; valor: string | null | undefined; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
      <dd className={`${mono ? "tabular-nums text-xs" : ""} ${etiqueta.startsWith("Monto") ? "text-right" : ""}`}>{valor ?? "—"}</dd>
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
      if (falloR6) ajuste["monto"] = opcionR6 === "contrato" ? "ajustado_al_contrato" : "monto_facturado";
      if (falloR7) {
        ajuste["conversion"] = { cuenta_pago: cuentaElegida, tipo_cambio: tc, monto_final: montoConvertido, moneda_final: cuentaDest?.moneda };
      }
      const { error } = await supabase
        .from("decisiones")
        .update({
          decision: "PAGAR",
          estado: "aprobada_humano",
          aprobador: usuario,
          aprobado_en: new Date().toISOString(),
          comentario_aprobacion: comentario.trim(),
          fecha_programada_pago: viernesPago((factura.fecha_recepcion ?? new Date().toISOString()).slice(0, 10)),
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
      // Si el proveedor tiene una cotización vigente, la aprobación la consume.
      if (decision.proveedor_id) {
        const { data: cot } = await supabase
          .from("contratos")
          .select("id")
          .eq("proveedor_id", decision.proveedor_id)
          .eq("tipo", "unica")
          .eq("estado", "vigente")
          .maybeSingle();
        if (cot) await consumirCotizacionSiAplica({ decision: "PAGAR", cotizacion_a_consumir: cot.id }, factura.id, usuario);
      }
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
                <MontoInput className="mt-1" value={tipoCambio} onValueChange={setTipoCambio} />
                <p className="mt-1 text-right text-xs text-muted-foreground">{formatearTipoCambio(tc)}</p>
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
          <Button onClick={aprobar} disabled={guardando} className="bg-primary text-primary-foreground hover:bg-primary-hover">
            Aprobar pago
          </Button>
          <Button onClick={rechazar} disabled={guardando} className="bg-decision-frenar text-decision-frenar-foreground hover:opacity-90">
            Rechazar
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Muestra el documento original: PDF/imagen desde el almacenamiento (URL firmada), el texto del chat, o un aviso si es un caso de prueba. */
function VisorDocumento({ factura }: { factura: Factura }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!factura.archivo_url) return;
    let vivo = true;
    supabase.storage
      .from("facturas")
      .createSignedUrl(factura.archivo_url, 3600)
      .then(({ data }) => {
        if (vivo && data?.signedUrl) setUrl(data.signedUrl);
      });
    return () => {
      vivo = false;
    };
  }, [factura.archivo_url]);

  if (factura.archivo_url) {
    if (!url) {
      return <div className="flex h-[32rem] items-center justify-center text-sm text-muted-foreground">Cargando documento…</div>;
    }
    const esPdf = (factura.nombre_archivo ?? factura.archivo_url).toLowerCase().endsWith(".pdf");
    return esPdf ? (
      <iframe src={url} title="Documento original" className="h-[32rem] w-full rounded border bg-muted" />
    ) : (
      <img src={url} alt="Documento original" className="max-h-[32rem] w-full rounded border object-contain" />
    );
  }
  if (factura.texto_original) {
    return (
      <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded bg-muted p-4 font-mono text-xs leading-relaxed">
        {factura.texto_original}
      </pre>
    );
  }
  return <p className="rounded bg-muted p-4 text-sm text-muted-foreground">Caso de prueba cargado con datos ya extraídos.</p>;
}

const CAMPOS_CORREGIBLES = [
  { clave: "emisor", etiqueta: "Proveedor (emisor)" },
  { clave: "receptor", etiqueta: "Receptor" },
  { clave: "numero", etiqueta: "Número" },
  { clave: "tipo_documento", etiqueta: "Tipo de documento" },
  { clave: "fecha_emision", etiqueta: "Emisión (AAAA-MM-DD)" },
  { clave: "fecha_vencimiento", etiqueta: "Vencimiento (AAAA-MM-DD)" },
  { clave: "monto", etiqueta: "Monto" },
  { clave: "moneda", etiqueta: "Moneda (USD, GTQ)" },
  { clave: "descripcion", etiqueta: "Descripción" },
  { clave: "pago_banco", etiqueta: "Banco de pago" },
  { clave: "pago_cuenta", etiqueta: "Cuenta de pago" },
] as const;

type ClaveCampo = (typeof CAMPOS_CORREGIBLES)[number]["clave"];

/** Corrige los datos extraídos por la IA y re-evalúa con el motor. Requiere usuario y registra qué cambió. */
function CorreccionDialog({ factura }: { factura: Factura }) {
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [usuario, setUsuario] = useState("");
  const [valores, setValores] = useState<Record<ClaveCampo, string>>(() => valoresIniciales(factura));
  const [guardando, setGuardando] = useState(false);

  function valoresIniciales(f: Factura): Record<ClaveCampo, string> {
    return {
      emisor: f.emisor ?? "",
      receptor: f.receptor ?? "",
      numero: f.numero ?? "",
      tipo_documento: f.tipo_documento ?? "",
      fecha_emision: f.fecha_emision ?? "",
      fecha_vencimiento: f.fecha_vencimiento ?? "",
      monto: f.monto != null ? String(f.monto) : "",
      moneda: f.moneda ?? "",
      descripcion: f.descripcion ?? "",
      pago_banco: f.pago_banco ?? "",
      pago_cuenta: f.pago_cuenta ?? "",
    };
  }

  async function guardar() {
    if (!usuario) return void toast.error("Elige quién corrige");
    const iniciales = valoresIniciales(factura);
    const cambios = CAMPOS_CORREGIBLES.filter((c) => valores[c.clave].trim() !== iniciales[c.clave].trim()).map((c) => c.etiqueta);
    if (cambios.length === 0) return void toast.error("No cambiaste ningún dato");

    setGuardando(true);
    try {
      const monto = valores.monto.trim() === "" ? null : Number(valores.monto);
      if (valores.monto.trim() !== "" && !Number.isFinite(monto)) throw new Error("El monto debe ser numérico");
      const actualizacion = {
        emisor: valores.emisor.trim() || null,
        receptor: valores.receptor.trim() || null,
        numero: valores.numero.trim() || null,
        tipo_documento: valores.tipo_documento.trim() || null,
        fecha_emision: valores.fecha_emision.trim() || null,
        fecha_vencimiento: valores.fecha_vencimiento.trim() || null,
        monto,
        moneda: valores.moneda.trim() || null,
        descripcion: valores.descripcion.trim() || null,
        pago_banco: valores.pago_banco.trim() || null,
        pago_cuenta: valores.pago_cuenta.trim() || null,
      };
      const { error: errU } = await supabase.from("facturas").update(actualizacion).eq("id", factura.id);
      if (errU) throw errU;

      // Re-evaluar con el motor, excluyendo esta factura del historial (no es duplicado de sí misma)
      const ctx = await construirContexto();
      ctx.facturasRecibidas = ctx.facturasRecibidas.filter((f) => f.id !== factura.id);
      const entrada: FacturaEntrada = {
        id: factura.id,
        canal: factura.canal,
        tipo_documento: actualizacion.tipo_documento,
        emisor: actualizacion.emisor,
        receptor: actualizacion.receptor,
        numero: actualizacion.numero,
        fecha_emision: actualizacion.fecha_emision,
        fecha_vencimiento: actualizacion.fecha_vencimiento,
        descripcion: actualizacion.descripcion,
        monto: actualizacion.monto,
        moneda: actualizacion.moneda,
        pago_banco: actualizacion.pago_banco,
        pago_cuenta: actualizacion.pago_cuenta,
        confianza_extraccion: 1, // corregida por humano
        fecha_recepcion: factura.fecha_recepcion ?? new Date().toISOString(),
      };
      const d = evaluarFactura(entrada, ctx);
      const ahora = new Date().toISOString();
      const { error: errD } = await supabase.from("decisiones").insert({
        factura_id: factura.id,
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
      });
      if (errD) throw errD;
      const { error: errE } = await supabase.from("registro_eventos").insert([
        { factura_id: factura.id, evento: "corregida", actor: usuario, detalle: `Corrigió los datos extraídos: ${cambios.join(", ")}`, fecha_hora: ahora },
        { factura_id: factura.id, evento: "decidida", actor: d.decidido_por, detalle: `Re-evaluada tras corrección: ${d.decision} — ${d.motivo}`, fecha_hora: ahora },
      ]);
      if (errE) throw errE;

      await qc.invalidateQueries();
      setAbierto(false);
      toast.success(`Datos corregidos. Nueva decisión: ${d.decision}`);
    } catch (e) {
      toast.error("No se pudo corregir: " + (e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setAbierto(true)}>
        <Pencil className="mr-1 h-3 w-3" /> Corregir datos extraídos
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Corregir datos extraídos</DialogTitle>
            <DialogDescription>
              La corrección queda registrada con tu nombre y los campos cambiados, y la factura se re-evalúa con el motor de reglas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>¿Quién corrige?</Label>
              <Select value={usuario} onValueChange={setUsuario}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Elige un usuario" /></SelectTrigger>
                <SelectContent>
                  {USUARIOS_DEMO.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {CAMPOS_CORREGIBLES.map((c) => (
                <div key={c.clave} className={c.clave === "descripcion" ? "col-span-2" : ""}>
                  <Label className="text-xs text-muted-foreground">{c.etiqueta}</Label>
                  {c.clave === "moneda" ? (
                    <Select value={valores.moneda || "sin_moneda"} onValueChange={(moneda) => setValores((v) => ({ ...v, moneda: moneda === "sin_moneda" ? "" : moneda }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sin_moneda">Sin identificar</SelectItem>
                        {MONEDAS_DISPONIBLES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : c.clave === "monto" ? <MontoInput className="mt-1" value={valores.monto} onValueChange={(monto) => setValores((v) => ({ ...v, monto }))} /> : <Input
                    className="mt-1"
                    value={valores[c.clave]}
                    onChange={(e) => setValores((v) => ({ ...v, [c.clave]: e.target.value }))}
                  />}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
            <Button onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar y re-evaluar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
