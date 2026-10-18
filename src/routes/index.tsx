import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { datosMaestrosQuery, decisionesQuery, empresaQuery, facturasQuery, type DecisionConRelaciones } from "@/lib/datos";
import { ESTILO_DECISION, etiquetaDecision, fmtFechaCorta, fmtMonto } from "@/lib/formato";
import type { ParametrosPolitica } from "@/lib/motorReglas";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tablero — Contralor" },
      { name: "description", content: "Agente de cuentas por pagar de Andes Labs: decisiones auditables por factura." },
      { property: "og:title", content: "Tablero — Contralor" },
      { property: "og:description", content: "Agente de cuentas por pagar con reglas deterministas y registro auditable." },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(empresaQuery),
      context.queryClient.ensureQueryData(datosMaestrosQuery),
      context.queryClient.ensureQueryData(facturasQuery),
      context.queryClient.ensureQueryData(decisionesQuery),
    ]),
  component: Tablero,
});


function Tablero() {
  const { data: empresa } = useSuspenseQuery(empresaQuery);
  const { data: maestros } = useSuspenseQuery(datosMaestrosQuery);
  const { data: facturas } = useSuspenseQuery(facturasQuery);
  const { data: decisiones } = useSuspenseQuery(decisionesQuery);

  const params = maestros.politica.parametros as unknown as ParametrosPolitica;
  const periodo = new Date().toISOString().slice(0, 7);

  const porDecision = (d: string) => decisiones.filter((x) => x.decision === d);
  const pagar = porDecision("PAGAR");
  const escalar = decisiones.filter((x) => x.estado === "pendiente_aprobacion");
  const frenar = porDecision("FRENAR");
  const postergar = porDecision("POSTERGAR");

  const decididasAgente = decisiones.filter((x) => x.decidido_por === "Agente (automático)").length;
  const autonomia = decisiones.length > 0 ? Math.round((decididasAgente / decisiones.length) * 100) : 0;

  // Monto programado por viernes de pago (solo PAGAR con fecha)
  const porViernes = new Map<string, number>();
  for (const d of pagar) {
    if (!d.fecha_programada_pago) continue;
    porViernes.set(d.fecha_programada_pago, (porViernes.get(d.fecha_programada_pago) ?? 0) + (d.monto_usd ?? 0));
  }
  const viernes = [...porViernes.entries()].sort(([a], [b]) => a.localeCompare(b));

  // Presupuesto por categoría: presupuesto − pagos previos del periodo − decisiones PAGAR del periodo
  const presupuestos = Object.entries(params.presupuesto_por_categoria_usd).map(([categoria, presupuesto]) => {
    const dePagos = maestros.pagosPrevios
      .filter((p) => p.categoria === categoria && p.fecha_pago.startsWith(periodo))
      .reduce((s, p) => s + p.monto_usd, 0);
    const deDecisiones = pagar
      .filter((d) => d.categoria === categoria && d.factura?.fecha_recepcion?.startsWith(periodo))
      .reduce((s, d) => s + (d.monto_usd ?? 0), 0);
    const consumido = dePagos + deDecisiones;
    return { categoria, presupuesto, consumido, pct: presupuesto > 0 ? Math.min(100, (consumido / presupuesto) * 100) : 0 };
  });

  return (
    <div className="px-6 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{empresa?.razon_social ?? "Andes Labs LLC"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Política {maestros.politica.version} · Periodo {periodo}
          </p>
        </div>
      </div>

      {/* Indicadores */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Indicador titulo="Facturas recibidas" valor={String(facturas.length)} />
        <Indicador titulo="Autonomía" valor={`${autonomia}%`} detalle={`${decididasAgente} de ${decisiones.length} sin intervención`} />
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Pagos fuera de reglas</div>
          <div className="mt-1 text-2xl font-semibold text-decision-pagar">0</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Programado por viernes</div>
          {viernes.length === 0 ? (
            <div className="mt-1 text-2xl font-semibold">—</div>
          ) : (
            <div className="mt-1 space-y-0.5">
              {viernes.map(([fecha, total]) => (
                <div key={fecha} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="capitalize">{fmtFechaCorta(fecha)}</span>
                  <span className="font-mono font-semibold tabular-nums">{fmtMonto(total, "USD")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <Indicador titulo="Pendientes de aprobación" valor={String(escalar.length)} />
      </div>

      {/* Presupuesto por categoría */}
      <h2 className="mt-8 text-lg font-semibold tracking-tight">Presupuesto por categoría · {periodo}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {presupuestos.map((p) => (
          <div key={p.categoria} className="rounded-lg border bg-card p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{p.categoria}</span>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {fmtMonto(p.consumido, "USD")} / {fmtMonto(p.presupuesto, "USD")}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-acento-suave">
              <div className={`h-full rounded-full ${p.pct > 90 ? "bg-decision-escalar" : "bg-primary"}`} style={{ width: `${p.pct}%` }} />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Disponible: <span className="font-mono tabular-nums">{fmtMonto(Math.max(0, p.presupuesto - p.consumido), "USD")}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Pestañas */}
      <Tabs defaultValue="pagar" className="mt-8">
        <TabsList>
          <TabsTrigger value="pagar">Aprobados ({pagar.length})</TabsTrigger>
          <TabsTrigger value="escalar">Escalados (pendientes de aprobación) ({escalar.length})</TabsTrigger>
          <TabsTrigger value="frenar">Frenados ({frenar.length})</TabsTrigger>
          <TabsTrigger value="postergar">Pospuestos ({postergar.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pagar">
          <TablaDecisiones
            filas={pagar}
            columnas={["Proveedor", "Factura", "Monto", "Monto USD", "Cuenta de pago", "Fecha programada", "Decidido por"]}
            renderFila={(d) => (
              <>
                <CeldaProveedor d={d} />
                <TableCell className="font-mono text-xs">{d.factura?.numero ?? "—"}</TableCell>
                <CeldaMonto d={d} />
                <TableCell className="text-right font-mono text-xs tabular-nums">{fmtMonto(d.monto_usd, "USD")}</TableCell>
                <TableCell className="font-mono text-xs">{d.cuenta_pago ?? "—"}</TableCell>
                <TableCell className="capitalize">{fmtFechaCorta(d.fecha_programada_pago)}</TableCell>
                <TableCell className="text-xs">{d.estado === "aprobada_humano" ? d.aprobador : d.decidido_por}</TableCell>
              </>
            )}
          />
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
                <TableCell className="text-right font-mono tabular-nums">{Math.max(0, Math.floor((Date.now() - new Date(d.decidido_en).getTime()) / 86400000))}</TableCell>
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
                <TableCell className="font-mono text-xs">
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
          <TablaDecisiones
            filas={postergar}
            columnas={["Proveedor", "Monto", "Nueva fecha", "Motivo"]}
            renderFila={(d) => (
              <>
                <CeldaProveedor d={d} />
                <CeldaMonto d={d} />
                <TableCell className="capitalize">{fmtFechaCorta(d.fecha_programada_pago)}</TableCell>
                <TableCell className="max-w-md text-xs">{d.motivo}</TableCell>
              </>
            )}
          />
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
  return <TableCell className="text-right font-mono text-xs tabular-nums">{fmtMonto(d.factura?.monto, d.factura?.moneda)}</TableCell>;
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
