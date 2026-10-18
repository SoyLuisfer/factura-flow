import { useState } from "react";
import { ArrowRight, CircleCheck, Clock3, FileText, ShieldCheck, Sparkles, Wallet, Inbox, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { datosMaestrosQuery, decisionesQuery, empresaQuery, facturasQuery, type DecisionConRelaciones } from "@/lib/datos";
import { ESTILO_DECISION, etiquetaDecision, fmtFechaCorta, fmtMonto, formatearPorcentaje, formatearTextoNumerico } from "@/lib/formato";
import { obtenerTramos, programacionQuery, hoyGuatemala } from "@/lib/tesoreria";
import { AccionTesoreria } from "@/components/accion-tesoreria";
import { LiberarFondos } from "@/components/liberar-fondos";
import { lotesQuery, obtenerLotePendiente } from "@/lib/lotes";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tablero — Contralor" },
      { name: "description", content: "Agente de cuentas por pagar de Pollos Hermanos, S. A.: decisiones auditables por factura." },
      { property: "og:title", content: "Tablero — Contralor" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:description", content: "Agente de cuentas por pagar con reglas deterministas y registro auditable." },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(empresaQuery),
      context.queryClient.ensureQueryData(datosMaestrosQuery),
      context.queryClient.ensureQueryData(facturasQuery),
      context.queryClient.ensureQueryData(decisionesQuery),
      context.queryClient.ensureQueryData(programacionQuery),
      context.queryClient.ensureQueryData(lotesQuery),
    ]),
  component: Tablero,
});


function Tablero() {
  const { data: empresa } = useSuspenseQuery(empresaQuery);
  const { data: maestros } = useSuspenseQuery(datosMaestrosQuery);
  const { data: facturas } = useSuspenseQuery(facturasQuery);
  const { data: decisiones } = useSuspenseQuery(decisionesQuery);

  const { data: programacion } = useSuspenseQuery(programacionQuery);
  const { data: lotes } = useSuspenseQuery(lotesQuery);
  const tramos = obtenerTramos(decisiones, programacion, maestros.cuentas, maestros.tiposCambio);
  const aprobados = tramos.filter((t) => t.estado === "programado");
  const pospuestos = tramos.filter((t) => t.estado === "pospuesto");
  const periodo = new Date().toISOString().slice(0, 7);

  const porDecision = (d: string) => decisiones.filter((x) => x.decision === d);
  const escalar = decisiones.filter((x) => x.estado === "pendiente_aprobacion");
  const frenar = porDecision("FRENAR");
  const [pestana, setPestana] = useState(escalar.length ? "escalar" : "pagar");
  const navigate = useNavigate();
  const revisar = () => { setPestana("escalar"); document.getElementById("bandeja-facturas")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const abrirFila = (id: string) => navigate({ to: "/factura/$id", params: { id } });

  const decididasAgente = decisiones.filter((x) => x.decidido_por === "Agente (automático)").length;
  const autonomia = decisiones.length > 0 ? Math.round((decididasAgente / decisiones.length) * 100) : 0;

  const proximos = aprobados.filter((t) => !t.liberado_lote_id && t.fecha_pago >= hoyGuatemala());
  const fechas = [...new Set([...proximos.map((t) => t.fecha_pago), ...lotes.filter((l) => l.fecha_pago >= hoyGuatemala()).map((l) => l.fecha_pago)])].sort();
  const calendario = fechas.map((fecha) => {
    const pagos = proximos.filter((t) => t.fecha_pago === fecha);
    const porMoneda = new Map<string, number>();
    for (const t of pagos) {
      const moneda = maestros.cuentas.find((c) => c.id === t.cuenta_pago)?.moneda ?? t.moneda;
      porMoneda.set(moneda, (porMoneda.get(moneda) ?? 0) + t.monto_cuenta);
    }
    const liberados = lotes.filter((l) => l.fecha_pago === fecha);
    const facturasLiberadas = aprobados.filter((t) => t.fecha_pago === fecha && t.liberado_lote_id);
    return { fecha, porMoneda, liberados, facturas: new Set([...pagos, ...facturasLiberadas].map((t) => t.decision.factura_id)).size };
  });

  return (
    <div className="px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{empresa?.razon_social ?? "Pollos Hermanos, S. A."}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Política {maestros.politica.version} · Periodo {periodo}
          </p>
        </div>
      </div>

      <div className={`mt-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4 ${escalar.length ? "border-decision-escalar/25 bg-decision-escalar/5" : "border-primary/20 bg-acento-suave"}`}>
        <div className="flex items-center gap-3"><span className={escalar.length ? "text-decision-escalar" : "text-primary"}>{escalar.length ? <Clock3 className="size-5" /> : <CircleCheck className="size-5" />}</span><p className="font-bold">{escalar.length ? `${escalar.length} ${escalar.length === 1 ? "factura espera" : "facturas esperan"} tu aprobación` : "Todo al día: el agente no necesita nada de ti"}</p></div>
        {escalar.length > 0 && <Button onClick={revisar}>Revisar ahora <ArrowRight className="size-4" /></Button>}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador titulo="Facturas recibidas" valor={String(facturas.length)} detalle="Documentos recibidos en la bandeja" icono={FileText} />
        <Indicador titulo="Autonomía" valor={formatearPorcentaje(autonomia)} detalle={`${decididasAgente} de ${decisiones.length} sin intervención`} icono={Sparkles} />
        <Indicador titulo="Pagos fuera de reglas" valor="0" detalle="Ninguna factura pagada fuera de la política" icono={ShieldCheck} tono="text-primary" />
        <Indicador titulo="Pendientes de aprobación" valor={String(escalar.length)} detalle={escalar.length ? "Requieren una decisión de tu equipo" : "No hay decisiones pendientes"} icono={Clock3} tono={escalar.length ? "text-decision-escalar" : "text-primary"} onClick={revisar} />
      </div>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Wallet className="size-5 text-primary" />Tesorería</h2><p className="mt-2 text-sm text-muted-foreground">Saldos y próximos pagos por cuenta.</p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {[...maestros.cuentas].sort((a,b) => a.id.localeCompare(b.id)).map((cuenta) => {
            const pendiente = obtenerLotePendiente(tramos, cuenta.id, hoyGuatemala());
            const fecha = pendiente.fecha ?? lotes.find((l) => l.cuenta === cuenta.id)?.fecha_pago;
            const total = pendiente.total;
            const saldo = cuenta.saldo_disponible-total;
            return <div key={cuenta.id} className="rounded-lg border bg-card p-6 shadow-subtle" data-testid={cuenta.id}>
              <h3 className="font-bold">{cuenta.id}</h3><p className="text-xs text-muted-foreground">{cuenta.banco}</p>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-3"><dt>Saldo disponible</dt><dd className="text-right font-bold">{fmtMonto(cuenta.saldo_disponible,cuenta.moneda)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Total a pagar {fecha ? fmtFechaCorta(fecha) : "—"}</dt><dd className="text-right font-bold">{fmtMonto(total,cuenta.moneda)}</dd></div>
                <div className="flex justify-between gap-3 border-t pt-3"><dt>Saldo después del pago</dt><dd className={`text-right font-bold ${saldo<0 ? "text-destructive" : "text-foreground"}`}>{fmtMonto(saldo,cuenta.moneda)}</dd></div>
              </dl>
              <div className="mt-4"><Progress value={Math.min(100, Math.max(0, cuenta.saldo_disponible > 0 ? total / cuenta.saldo_disponible * 100 : total > 0 ? 100 : 0))} className={`h-1 ${saldo < 0 ? "[&>div]:bg-destructive" : ""}`} aria-label="Porcentaje del saldo programado" /><p className="mt-2 text-right text-xs text-muted-foreground">{formatearPorcentaje(cuenta.saldo_disponible > 0 ? total / cuenta.saldo_disponible * 100 : 0)} del saldo programado</p></div>
              <LiberarFondos cuenta={cuenta} tramos={tramos} lotes={lotes.filter((l) => l.cuenta === cuenta.id)} />
            </div>;
          })}
        </div>
        <h3 className="mt-5 font-bold">Calendario de pagos</h3>
        <div className="mt-2 overflow-x-auto border-y"><Table><TableHeader><TableRow><TableHead>Viernes de pago</TableHead><TableHead className="text-right">Quetzales</TableHead><TableHead className="text-right">Dólares</TableHead><TableHead className="text-right">Facturas</TableHead></TableRow></TableHeader><TableBody>
          {calendario.map((c) => <TableRow key={c.fecha}><TableCell className="capitalize">{fmtFechaCorta(c.fecha)}</TableCell>{["GTQ", "USD"].map((moneda) => <TableCell key={moneda} className="text-right">{fmtMonto(c.porMoneda.get(moneda) ?? 0, moneda)}{c.liberados.filter((l) => maestros.cuentas.find((a) => a.id === l.cuenta)?.moneda === moneda).map((l) => <div key={l.id} className="mt-1 text-xs font-bold text-decision-pagar">Liberado · {fmtMonto(l.total, moneda)}</div>)}</TableCell>)}<TableCell className="text-right">{c.facturas}</TableCell></TableRow>)}
          {!calendario.length && <TableRow><TableCell colSpan={4}>Sin pagos programados.</TableCell></TableRow>}
        </TableBody></Table></div>
      </section>

      {/* Pestañas */}
      <section id="bandeja-facturas" className="mt-8 scroll-mt-4">
      <h2 className="text-lg font-bold">Bandeja de facturas</h2><p className="mt-2 text-sm text-muted-foreground">Decisiones del agente y aprobaciones de tu equipo.</p>
      <Tabs value={pestana} onValueChange={setPestana} className="mt-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
          <TabsTrigger value="escalar" className="gap-2 py-2">Por aprobar <Badge className={ESTILO_DECISION.ESCALAR}>{escalar.length}</Badge></TabsTrigger>
          <TabsTrigger value="pagar" className="gap-2 py-2">Aprobados <Badge className={ESTILO_DECISION.PAGAR}>{new Set(aprobados.map((t) => t.decision.factura_id)).size}</Badge></TabsTrigger>
          <TabsTrigger value="postergar" className="gap-2 py-2">Pospuestos <Badge className={ESTILO_DECISION.POSTERGAR}>{new Set(pospuestos.map((t) => t.decision.factura_id)).size}</Badge></TabsTrigger>
          <TabsTrigger value="frenar" className="gap-2 py-2">Frenados <Badge className={ESTILO_DECISION.FRENAR}>{frenar.length}</Badge></TabsTrigger>
        </TabsList>

        <TabsContent value="pagar">
          <div className="mt-4 overflow-x-auto rounded-lg border bg-card"><Table><TableHeader><TableRow>
            <TableHead>Decisión</TableHead><TableHead>Proveedor / factura</TableHead><TableHead className="text-right">Monto programado</TableHead><TableHead>Decidido por</TableHead><TableHead>Cuenta de pago</TableHead><TableHead>Fecha programada</TableHead><TableHead>Acción</TableHead><TableHead><span className="sr-only">Abrir detalle</span></TableHead>
          </TableRow></TableHeader><TableBody>{aprobados.map((t) => <TableRow key={t.id ?? t.decision.id} className="cursor-pointer hover:bg-acento-suave/60" tabIndex={0} onClick={() => abrirFila(t.decision.factura_id)} onKeyDown={(e) => { if (e.target === e.currentTarget && e.key === "Enter") abrirFila(t.decision.factura_id); }}>
            <TableCell><Badge className={ESTILO_DECISION.PAGAR}>{t.liberado_lote_id ? "Fondos liberados" : "Programado"}</Badge>{t.liberado_lote_id && <div className="mt-1 text-xs text-muted-foreground">{t.liberado_lote_id}</div>}</TableCell>
            <TableCell><Link to="/factura/$id" params={{id:t.decision.factura_id}} className="font-bold text-primary hover:underline">{t.decision.proveedor?.nombre ?? t.decision.factura?.emisor}</Link><div className="text-xs text-muted-foreground">{t.decision.factura?.codigo} · {t.decision.factura?.numero}</div></TableCell>
            <TableCell className="text-right whitespace-nowrap">{fmtMonto(t.monto,t.moneda)}{t.moneda !== maestros.cuentas.find((c) => c.id === t.cuenta_pago)?.moneda && <span> → {fmtMonto(t.monto_cuenta,maestros.cuentas.find((c) => c.id === t.cuenta_pago)?.moneda)}</span>}</TableCell>
            <TableCell><Badge className={t.decision.estado === "aprobada_humano" ? "bg-foreground/10 text-foreground" : "bg-primary/10 text-primary"}>{t.decision.estado === "aprobada_humano" ? `Persona · ${(t.decision.aprobador ?? "").replace(/\s*\([^)]*\)/g, "")}` : "Agente"}</Badge></TableCell>
            <TableCell>{t.cuenta_pago}</TableCell><TableCell>{fmtFechaCorta(t.fecha_pago)}</TableCell><TableCell><AccionTesoreria tramo={t} /></TableCell><TableCell><ArrowRight className="size-4 text-muted-foreground" /></TableCell>
          </TableRow>)}</TableBody></Table>{!aprobados.length && <EstadoVacio texto="Aún no hay pagos aprobados. Las nuevas decisiones aparecerán aquí." />}</div>
        </TabsContent>

        <TabsContent value="escalar">
          <TablaDecisiones
            filas={escalar}
            vacio="No hay facturas por aprobar. Todo al día."
            columnas={["Proveedor", "Monto", "Motivo", "Área", "Días esperando", "Acción"]}
            renderFila={(d) => (
              <>
                <CeldaProveedor d={d} />
                <CeldaMonto d={d} />
                <TableCell className="max-w-md text-xs"><p className="line-clamp-2" title={formatearTextoNumerico(d.motivo)}>{formatearTextoNumerico(d.motivo)}</p></TableCell>
                <TableCell><Badge className={d.escalar_a === "Contabilidad" ? "bg-decision-postergar/10 text-decision-postergar" : "bg-decision-escalar/10 text-decision-escalar"}>{d.escalar_a ?? "Finanzas"}</Badge></TableCell>
                <TableCell className="text-right tabular-nums tabular-nums">{Math.max(0, Math.floor((Date.now() - new Date(d.decidido_en).getTime()) / 86400000))}</TableCell>
                <TableCell><Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); abrirFila(d.factura_id); }}>Revisar</Button></TableCell>
              </>
            )}
          />
        </TabsContent>

        <TabsContent value="frenar">
          <TablaDecisiones
            filas={frenar}
            vacio="Sin facturas frenadas. Ningún bloqueo requiere revisión."
            columnas={["Proveedor", "Factura", "Motivo"]}
            renderFila={(d) => (
              <>
                <CeldaProveedor d={d} />
                <TableCell className="tabular-nums text-xs">
                  {d.factura?.numero ?? "—"}
                  {d.factura_relacionada_id && (
                    <Link to="/factura/$id" params={{ id: d.factura_relacionada_id }} className="ml-2 text-primary underline underline-offset-2">
                      Ver original
                    </Link>
                  )}
                </TableCell>
                <TableCell className="max-w-md text-xs"><p className="line-clamp-2" title={formatearTextoNumerico(d.motivo)}>{formatearTextoNumerico(d.motivo)}</p></TableCell>
              </>
            )}
          />
        </TabsContent>

        <TabsContent value="postergar">
          <div className="mt-4 overflow-x-auto rounded-lg border bg-card"><Table><TableHeader><TableRow><TableHead>Estado</TableHead><TableHead>Proveedor / factura</TableHead><TableHead className="text-right">Saldo pendiente</TableHead><TableHead>Nueva fecha</TableHead><TableHead>Acción</TableHead><TableHead><span className="sr-only">Abrir detalle</span></TableHead></TableRow></TableHeader><TableBody>
          {pospuestos.map((t) => <TableRow key={t.id ?? t.decision.id} className="cursor-pointer hover:bg-acento-suave/60" tabIndex={0} onClick={() => abrirFila(t.decision.factura_id)} onKeyDown={(e) => { if (e.target === e.currentTarget && e.key === "Enter") abrirFila(t.decision.factura_id); }}><TableCell><Badge className={ESTILO_DECISION.POSTERGAR}>Pospuesto</Badge></TableCell><TableCell><Link to="/factura/$id" params={{id:t.decision.factura_id}} className="font-bold text-primary hover:underline">{t.decision.proveedor?.nombre ?? t.decision.factura?.emisor}</Link><div className="text-xs text-muted-foreground">{t.decision.factura?.codigo} · {t.decision.factura?.numero}</div></TableCell><TableCell className="text-right">{fmtMonto(t.monto,t.moneda)}</TableCell><TableCell>{fmtFechaCorta(t.fecha_pago)}</TableCell><TableCell><AccionTesoreria tramo={t} /></TableCell><TableCell><ArrowRight className="size-4 text-muted-foreground" /></TableCell></TableRow>)}
          </TableBody></Table>{!pospuestos.length && <EstadoVacio texto="No hay pagos pospuestos. El calendario está al día." />}</div>
        </TabsContent>
      </Tabs>
      </section>
    </div>
  );
}

function Indicador({ titulo, valor, detalle, icono: Icono, tono = "text-foreground", onClick }: { titulo: string; valor: string; detalle: string; icono: LucideIcon; tono?: string; onClick?: () => void }) {
  const contenido = <><div className="flex w-full items-center justify-between gap-2"><span className="text-sm text-muted-foreground">{titulo}</span><Icono className={`size-5 shrink-0 ${tono}`} /></div><div className={`mt-2 text-3xl font-bold ${tono}`}>{valor}</div><div className="mt-2 text-xs leading-relaxed text-muted-foreground">{detalle}</div></>;
  return onClick ? <Button variant="outline" className="h-auto items-start whitespace-normal rounded-lg bg-card p-4 text-left shadow-subtle flex-col" onClick={onClick}>{contenido}</Button> : <div className="rounded-lg border bg-card p-4 shadow-subtle">{contenido}</div>;
}
function EstadoVacio({ texto }: { texto: string }) { return <div className="flex flex-col items-center gap-3 p-8 text-center text-sm text-muted-foreground"><Inbox className="size-8 text-primary/60" /><p>{texto}</p></div>; }

function CeldaProveedor({ d }: { d: DecisionConRelaciones }) {
  return <TableCell className="font-bold">{d.proveedor?.nombre ?? d.factura?.emisor ?? "—"}</TableCell>;
}

function CeldaMonto({ d }: { d: DecisionConRelaciones }) {
  return <TableCell className="text-right tabular-nums text-xs tabular-nums">{fmtMonto(d.factura?.monto, d.factura?.moneda)}</TableCell>;
}

function TablaDecisiones({
  filas,
  columnas,
  renderFila,
  vacio,
}: {
  vacio: string;
  filas: DecisionConRelaciones[];
  columnas: string[];
  renderFila: (d: DecisionConRelaciones) => React.ReactNode;
}) {
  const navigate = useNavigate();
  if (filas.length === 0) {
    return <EstadoVacio texto={vacio} />;
  }
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Decisión</TableHead>
            {columnas.map((c) => (
              <TableHead key={c}>{c}</TableHead>
            ))}
            <TableHead><span className="sr-only">Abrir detalle</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((d) => (
            <TableRow key={d.id} className="cursor-pointer hover:bg-acento-suave/60" tabIndex={0} onKeyDown={(e) => { if (e.target === e.currentTarget && e.key === "Enter") navigate({ to: "/factura/$id", params: { id: d.factura_id } }); }} onClick={() => navigate({ to: "/factura/$id", params: { id: d.factura_id } })}>
              <TableCell>
                <Badge className={ESTILO_DECISION[d.decision as keyof typeof ESTILO_DECISION]}>{etiquetaDecision(d.decision, d.estado)}</Badge>
              </TableCell>
              {renderFila(d)}
              <TableCell><ArrowRight className="size-4 text-muted-foreground" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
