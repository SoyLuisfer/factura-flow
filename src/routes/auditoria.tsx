import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { decisionesQuery, eventosQuery, type Decision, type Factura, type Proveedor } from "@/lib/datos";
import { ESTILO_DECISION, etiquetaDecision, fmtFecha, fmtFechaHora, fmtMonto, formatearTextoNumerico } from "@/lib/formato";

export const Route = createFileRoute("/auditoria")({
  head: () => ({
    meta: [
      { title: "Registro de auditoría — Contralor" },
      { name: "description", content: "Historial inalterable de cada evento y decisión." },
      { property: "og:title", content: "Registro de auditoría — Contralor" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:description", content: "Historial inalterable de cada evento y decisión." },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(decisionesQuery),
      context.queryClient.ensureQueryData(eventosQuery),
    ]),
  component: Auditoria,
});

type Fila = Decision & { factura: Factura | null; proveedor: Proveedor | null };

const ETIQUETA_ESTADO: Record<string, string> = {
  final: "Final",
  pendiente_aprobacion: "Pendiente de aprobación",
  aprobada_humano: "Aprobada por humano",
  rechazada_humano: "Rechazada por humano",
};

function Auditoria() {
  const { data: decisiones } = useSuspenseQuery(decisionesQuery);
  const { data: eventos } = useSuspenseQuery(eventosQuery);

  const [fDecision, setFDecision] = useState("todas");
  const [fProveedor, setFProveedor] = useState("todos");
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");

  const proveedores = useMemo(
    () => [...new Set(decisiones.map((d) => d.proveedor?.nombre ?? d.factura?.emisor).filter(Boolean) as string[])].sort(),
    [decisiones],
  );

  const filtradas = useMemo(
    () =>
      decisiones.filter((d) => {
        if (fDecision !== "todas" && d.decision !== fDecision) return false;
        const nombre = d.proveedor?.nombre ?? d.factura?.emisor ?? "";
        if (fProveedor !== "todos" && nombre !== fProveedor) return false;
        const fecha = d.decidido_en.slice(0, 10);
        if (fDesde && fecha < fDesde) return false;
        if (fHasta && fecha > fHasta) return false;
        return true;
      }),
    [decisiones, fDecision, fProveedor, fDesde, fHasta],
  );

  function exportarCsv() {
    const encabezado = ["fecha_hora", "factura", "proveedor", "monto", "moneda", "monto_usd", "descripcion", "decision", "estado", "decidido_por", "aprobador", "fecha_programada", "cuenta", "politica", "motivo"];
    const lineas = filtradas.map((d) =>
      [
        fmtFechaHora(d.decidido_en), d.factura?.numero ?? "", d.proveedor?.nombre ?? d.factura?.emisor ?? "",
        fmtMonto(d.factura?.monto, d.factura?.moneda), d.factura?.moneda ?? "", fmtMonto(d.monto_usd, "USD"), d.factura?.descripcion ?? "",
        etiquetaDecision(d.decision, d.estado), d.estado, d.decidido_por, d.aprobador ?? "", fmtFecha(d.fecha_programada_pago),
        d.cuenta_pago ?? "", d.politica_version ?? "", formatearTextoNumerico(d.motivo),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [encabezado.join(","), ...lineas].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "auditoria-contralor.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Registro de auditoría</h1>
      <p className="mt-1 text-sm text-muted-foreground">Cada decisión y cada evento quedan registrados; nada se edita ni se borra.</p>

      <Tabs defaultValue="decisiones" className="mt-6">
        <TabsList>
          <TabsTrigger value="decisiones">Decisiones ({decisiones.length})</TabsTrigger>
          <TabsTrigger value="bitacora">Bitácora de eventos ({eventos.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="decisiones">
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">Decisión</Label>
              <Select value={fDecision} onValueChange={setFDecision}>
                <SelectTrigger className="mt-1 w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="PAGAR">Aprobado</SelectItem>
                  <SelectItem value="FRENAR">Frenado</SelectItem>
                  <SelectItem value="ESCALAR">Escalado</SelectItem>
                  <SelectItem value="POSTERGAR">Pospuesto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Proveedor</Label>
              <Select value={fProveedor} onValueChange={setFProveedor}>
                <SelectTrigger className="mt-1 w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {proveedores.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Desde</Label>
              <Input type="date" className="mt-1 w-40" value={fDesde} onChange={(e) => setFDesde(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Hasta</Label>
              <Input type="date" className="mt-1 w-40" value={fHasta} onChange={(e) => setFHasta(e.target.value)} />
            </div>
            <Button variant="outline" onClick={exportarCsv}>Exportar CSV</Button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha y hora</TableHead><TableHead>Factura</TableHead><TableHead>Proveedor</TableHead>
                  <TableHead className="text-right">Monto</TableHead><TableHead className="text-right">Monto USD</TableHead>
                  <TableHead>Descripción</TableHead><TableHead>Decisión</TableHead><TableHead>Estado</TableHead>
                  <TableHead>Decidido por</TableHead><TableHead>Aprobador</TableHead><TableHead>Fecha programada</TableHead>
                  <TableHead>Cuenta</TableHead><TableHead>Política</TableHead><TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{fmtFechaHora(d.decidido_en)}</TableCell>
                    <TableCell className="font-mono text-xs">{d.factura?.numero ?? "—"}</TableCell>
                    <TableCell className="font-medium">{d.proveedor?.nombre ?? d.factura?.emisor ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">{fmtMonto(d.factura?.monto, d.factura?.moneda)}</TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">{fmtMonto(d.monto_usd, "USD")}</TableCell>
                    <TableCell className="max-w-48 truncate text-xs">{d.factura?.descripcion ?? "—"}</TableCell>
                    <TableCell><Badge className={ESTILO_DECISION[d.decision as keyof typeof ESTILO_DECISION]}>{etiquetaDecision(d.decision, d.estado)}</Badge></TableCell>
                    <TableCell className="text-xs">{ETIQUETA_ESTADO[d.estado] ?? d.estado}</TableCell>
                    <TableCell className="text-xs">{d.decidido_por}</TableCell>
                    <TableCell className="text-xs">{d.aprobador ?? "—"}</TableCell>
                    <TableCell className="text-xs">{fmtFecha(d.fecha_programada_pago)}</TableCell>
                    <TableCell className="font-mono text-xs">{d.cuenta_pago ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{d.politica_version ?? "—"}</TableCell>
                    <TableCell className="max-w-64 text-xs">{formatearTextoNumerico(d.motivo)}</TableCell>
                  </TableRow>
                ))}
                {filtradas.length === 0 && (
                  <TableRow><TableCell colSpan={14} className="py-8 text-center text-sm text-muted-foreground">Sin decisiones con estos filtros.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="bitacora">
          <div className="mt-4 overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha y hora</TableHead><TableHead>Evento</TableHead><TableHead>Actor</TableHead>
                  <TableHead>Factura</TableHead><TableHead>Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...eventos].reverse().map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{fmtFechaHora(e.fecha_hora)}</TableCell>
                    <TableCell><Badge variant="secondary">{e.evento}</Badge></TableCell>
                    <TableCell className="text-xs">{e.actor}</TableCell>
                    <TableCell className="font-mono text-xs">{e.factura_id ? e.factura_id.slice(0, 8) + "…" : "—"}</TableCell>
                    <TableCell className="max-w-xl text-xs">{formatearTextoNumerico(e.detalle ?? "—")}</TableCell>
                  </TableRow>
                ))}
                {eventos.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Aún no hay eventos.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
