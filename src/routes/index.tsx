import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { datosMaestrosQuery, decisionesQuery, empresaQuery, facturasQuery, type DecisionConRelaciones } from "@/lib/datos";
import { ESTILO_DECISION, etiquetaDecision, fmtFechaCorta, fmtMonto, formatearPorcentaje } from "@/lib/formato";
import { obtenerTramos, programacionQuery } from "@/lib/tesoreria";
import { AccionTesoreria } from "@/components/accion-tesoreria";

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
    ]),
  component: Tablero,
});


function Tablero() {
  const { data: empresa } = useSuspenseQuery(empresaQuery);
  const { data: maestros } = useSuspenseQuery(datosMaestrosQuery);
  const { data: facturas } = useSuspenseQuery(facturasQuery);
  const { data: decisiones } = useSuspenseQuery(decisionesQuery);

  const { data: programacion } = useSuspenseQuery(programacionQuery);
  const tramos = obtenerTramos(decisiones, programacion, maestros.cuentas, maestros.tiposCambio);
  const aprobados = tramos.filter((t) => t.estado === "programado");
  const pospuestos = tramos.filter((t) => t.estado === "pospuesto");
  const periodo = new Date().toISOString().slice(0, 7);

  const porDecision = (d: string) => decisiones.filter((x) => x.decision === d);
  const pagar = porDecision("PAGAR");
  const escalar = decisiones.filter((x) => x.estado === "pendiente_aprobacion");
  const frenar = porDecision("FRENAR");
  const postergar = porDecision("POSTERGAR");

  const decididasAgente = decisiones.filter((x) => x.decidido_por === "Agente (automático)").length;
  const autonomia = decisiones.length > 0 ? Math.round((decididasAgente / decisiones.length) * 100) : 0;

  const fechas = [...new Set(aprobados.map((t) => t.fecha_pago))].sort();
  const calendario = fechas.map((fecha) => {
    const pagos = aprobados.filter((t) => t.fecha_pago === fecha);
    const porMoneda = new Map<string, number>();
    for (const t of pagos) {
      const moneda = maestros.cuentas.find((c) => c.id === t.cuenta_pago)?.moneda ?? t.moneda;
      porMoneda.set(moneda, (porMoneda.get(moneda) ?? 0) + t.monto_cuenta);
    }
    return { fecha, porMoneda, facturas: new Set(pagos.map((t) => t.decision.factura_id)).size };
  });

  return (
    <div className="px-6 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{empresa?.razon_social ?? "Pollos Hermanos, S. A."}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Política {maestros.politica.version} · Periodo {periodo}
          </p>
        </div>
      </div>

      {/* Indicadores */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador titulo="Facturas recibidas" valor={String(facturas.length)} />
        <Indicador titulo="Autonomía" valor={formatearPorcentaje(autonomia)} detalle={`${decididasAgente} de ${decisiones.length} sin intervención`} />
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Pagos fuera de reglas</div>
          <div className="mt-1 text-2xl font-semibold text-decision-pagar">0</div>
        </div>
        <Indicador titulo="Pendientes de aprobación" valor={String(escalar.length)} />
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-bold">Tesorería</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {[...maestros.cuentas].sort((a,b) => a.id.localeCompare(b.id)).map((cuenta) => {
            const pagos = aprobados.filter((t) => t.cuenta_pago === cuenta.id);
            const fecha = [...new Set(pagos.map((t) => t.fecha_pago))].sort()[0];
            const total = pagos.filter((t) => t.fecha_pago === fecha).reduce((s,t) => s+t.monto_cuenta,0);
            const saldo = cuenta.saldo_disponible-total;
            return <div key={cuenta.id} className="rounded-lg border bg-card p-5" data-testid={cuenta.id}>
              <h3 className="font-bold">{cuenta.id}</h3><p className="text-xs text-muted-foreground">{cuenta.banco}</p>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-3"><dt>Saldo disponible</dt><dd className="text-right font-bold">{fmtMonto(cuenta.saldo_disponible,cuenta.moneda)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Total a pagar {fecha ? fmtFechaCorta(fecha) : "—"}</dt><dd className="text-right font-bold">{fmtMonto(total,cuenta.moneda)}</dd></div>
                <div className="flex justify-between gap-3 border-t pt-3"><dt>Saldo después del pago</dt><dd className={`text-right font-bold ${saldo<0 ? "text-destructive" : "text-foreground"}`}>{fmtMonto(saldo,cuenta.moneda)}</dd></div>
              </dl>
            </div>;
          })}
        </div>
        <h3 className="mt-5 font-bold">Calendario de pagos</h3>
        <div className="mt-2 overflow-x-auto border-y"><Table><TableHeader><TableRow><TableHead>Viernes de pago</TableHead><TableHead className="text-right">Quetzales</TableHead><TableHead className="text-right">Dólares</TableHead><TableHead className="text-right">Facturas</TableHead></TableRow></TableHeader><TableBody>
          {calendario.map((c) => <TableRow key={c.fecha}><TableCell className="capitalize">{fmtFechaCorta(c.fecha)}</TableCell><TableCell className="text-right">{fmtMonto(c.porMoneda.get("GTQ") ?? 0,"GTQ")}</TableCell><TableCell className="text-right">{fmtMonto(c.porMoneda.get("USD") ?? 0,"USD")}</TableCell><TableCell className="text-right">{c.facturas}</TableCell></TableRow>)}
          {!calendario.length && <TableRow><TableCell colSpan={4}>Sin pagos programados.</TableCell></TableRow>}
        </TableBody></Table></div>
      </section>

      {/* Pestañas */}
      <Tabs defaultValue="pagar" className="mt-8">
        <TabsList>
          <TabsTrigger value="pagar">Aprobados ({aprobados.length})</TabsTrigger>
          <TabsTrigger value="escalar">Escalados (pendientes de aprobación) ({escalar.length})</TabsTrigger>
          <TabsTrigger value="frenar">Frenados ({frenar.length})</TabsTrigger>
          <TabsTrigger value="postergar">Pospuestos ({pospuestos.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pagar">
          <div className="mt-4 overflow-x-auto rounded-lg border bg-card"><Table><TableHeader><TableRow>
            <TableHead>Decisión</TableHead><TableHead>Proveedor / factura</TableHead><TableHead className="text-right">Monto programado</TableHead><TableHead className="text-right">Desde la cuenta</TableHead><TableHead>Cuenta de pago</TableHead><TableHead>Fecha programada</TableHead><TableHead>Acción</TableHead>
          </TableRow></TableHeader><TableBody>{aprobados.map((t) => <TableRow key={t.id ?? t.decision.id}>
            <TableCell><Badge className={ESTILO_DECISION.PAGAR}>Aprobado</Badge></TableCell>
            <TableCell><Link to="/factura/$id" params={{id:t.decision.factura_id}} className="font-bold text-primary hover:underline">{t.decision.proveedor?.nombre ?? t.decision.factura?.emisor}</Link><div className="text-xs text-muted-foreground">{t.decision.factura?.codigo} · {t.decision.factura?.numero}</div></TableCell>
            <TableCell className="text-right whitespace-nowrap">{fmtMonto(t.monto,t.moneda)}</TableCell>
            <TableCell className="text-right whitespace-nowrap">{fmtMonto(t.monto_cuenta,maestros.cuentas.find((c) => c.id===t.cuenta_pago)?.moneda)}</TableCell>
            <TableCell>{t.cuenta_pago}</TableCell><TableCell>{fmtFechaCorta(t.fecha_pago)}</TableCell><TableCell><AccionTesoreria tramo={t} /></TableCell>
          </TableRow>)}</TableBody></Table>{!aprobados.length && <p className="p-4 text-sm text-muted-foreground">Sin pagos aprobados programados.</p>}</div>
        </TabsContent>

        <TabsContent value="escalar">
          <TablaDecisiones
            filas={escalar}
            columnas={["Proveedor", "Monto", "Motivo", "Área", "Días esperando"]}
            renderFila={(d) => (
              <>
                <CeldaProveedor d={d} />
                <CeldaMonto d={d} />
                <TableCell className="max-w-md text-xs">{d.motivo}</TableCell>
                <TableCell><Badge variant="outline">{d.escalar_a ?? "Finanzas"}</Badge></TableCell>
                <TableCell className="text-right tabular-nums tabular-nums">{Math.max(0, Math.floor((Date.now() - new Date(d.decidido_en).getTime()) / 86400000))}</TableCell>
              </>
            )}
          />
        </TabsContent>

        <TabsContent value="frenar">
          <TablaDecisiones
            filas={frenar}
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
                <TableCell className="max-w-md text-xs">{d.motivo}</TableCell>
              </>
            )}
          />
        </TabsContent>

        <TabsContent value="postergar">
          <div className="mt-4 overflow-x-auto rounded-lg border bg-card"><Table><TableHeader><TableRow><TableHead>Estado</TableHead><TableHead>Proveedor / factura</TableHead><TableHead className="text-right">Saldo pendiente</TableHead><TableHead>Nueva fecha</TableHead><TableHead>Acción</TableHead></TableRow></TableHeader><TableBody>
          {pospuestos.map((t) => <TableRow key={t.id ?? t.decision.id}><TableCell><Badge className={ESTILO_DECISION.POSTERGAR}>Pospuesto</Badge></TableCell><TableCell><Link to="/factura/$id" params={{id:t.decision.factura_id}} className="font-bold text-primary hover:underline">{t.decision.proveedor?.nombre ?? t.decision.factura?.emisor}</Link><div className="text-xs text-muted-foreground">{t.decision.factura?.codigo} · {t.decision.factura?.numero}</div></TableCell><TableCell className="text-right">{fmtMonto(t.monto,t.moneda)}</TableCell><TableCell>{fmtFechaCorta(t.fecha_pago)}</TableCell><TableCell><AccionTesoreria tramo={t} /></TableCell></TableRow>)}
          </TableBody></Table>{!pospuestos.length && <p className="p-4 text-sm text-muted-foreground">Sin pagos pospuestos.</p>}</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Indicador({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-sm text-muted-foreground">{titulo}</div>
      <div className="mt-1 text-2xl font-semibold">{valor}</div>
      {detalle && <div className="mt-0.5 text-xs text-muted-foreground">{detalle}</div>}
    </div>
  );
}

function CeldaProveedor({ d }: { d: DecisionConRelaciones }) {
  return <TableCell className="font-medium">{d.proveedor?.nombre ?? d.factura?.emisor ?? "—"}</TableCell>;
}

function CeldaMonto({ d }: { d: DecisionConRelaciones }) {
  return <TableCell className="text-right tabular-nums text-xs tabular-nums">{fmtMonto(d.factura?.monto, d.factura?.moneda)}</TableCell>;
}

function TablaDecisiones({
  filas,
  columnas,
  renderFila,
}: {
  filas: DecisionConRelaciones[];
  columnas: string[];
  renderFila: (d: DecisionConRelaciones) => React.ReactNode;
}) {
  const navigate = useNavigate();
  if (filas.length === 0) {
    return <p className="mt-4 rounded-lg border bg-card p-6 text-sm text-muted-foreground">No hay facturas en esta categoría.</p>;
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((d) => (
            <TableRow key={d.id} className="cursor-pointer" onClick={() => navigate({ to: "/factura/$id", params: { id: d.factura_id } })}>
              <TableCell>
                <Badge className={ESTILO_DECISION[d.decision as keyof typeof ESTILO_DECISION]}>{etiquetaDecision(d.decision, d.estado)}</Badge>
              </TableCell>
              {renderFila(d)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
