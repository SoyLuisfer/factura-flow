import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { proveedoresQuery } from "@/lib/datos";

export const Route = createFileRoute("/proveedores")({
  head: () => ({
    meta: [
      { title: "Proveedores — Contralor" },
      { name: "description", content: "Proveedores y contratistas registrados de Andes Labs." },
      { property: "og:title", content: "Proveedores — Contralor" },
      { property: "og:description", content: "Proveedores y contratistas registrados." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(proveedoresQuery),
  component: Proveedores,
});

function Proveedores() {
  const { data } = useSuspenseQuery(proveedoresQuery);
  return (
    <div className="px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Proveedores</h1>
      <p className="mt-2 text-muted-foreground">{data.length} proveedores cargados.</p>
      <div className="mt-6 overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead><TableHead>Nombre</TableHead><TableHead>País</TableHead>
              <TableHead>Tipo</TableHead><TableHead>Categoría</TableHead><TableHead>Moneda</TableHead>
              <TableHead>Cuenta de pago</TableHead><TableHead>Conversión</TableHead>
              <TableHead>Beneficiario</TableHead><TableHead>Expediente</TableHead><TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.id}</TableCell>
                <TableCell className="font-medium">{p.nombre}</TableCell>
                <TableCell>{p.pais}</TableCell>
                <TableCell>{p.tipo}</TableCell>
                <TableCell>{p.categoria}</TableCell>
                <TableCell className="font-mono text-xs">{p.moneda_factura}</TableCell>
                <TableCell className="font-mono text-xs">{p.cuenta_pago}</TableCell>
                <TableCell>{p.permite_conversion ? "Sí" : "No"}</TableCell>
                <TableCell className="text-xs">
                  <div>{p.banco_beneficiario}</div>
                  <div className="font-mono text-muted-foreground">{p.cuenta_beneficiario}</div>
                </TableCell>
                <TableCell>{p.expediente_completo ? <Badge variant="secondary">Completo</Badge> : <Badge variant="destructive">Incompleto</Badge>}</TableCell>
                <TableCell>{p.activo ? <Badge>Activo</Badge> : <Badge variant="outline">Inactivo</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
