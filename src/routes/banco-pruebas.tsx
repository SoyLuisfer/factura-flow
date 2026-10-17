import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reiniciarDemo } from "@/lib/datos";

export const Route = createFileRoute("/banco-pruebas")({
  head: () => ({
    meta: [
      { title: "Banco de pruebas — Contralor" },
      { name: "description", content: "Casos de prueba del motor de reglas y reinicio de datos demo." },
      { property: "og:title", content: "Banco de pruebas — Contralor" },
      { property: "og:description", content: "Casos de prueba del motor de reglas." },
    ],
  }),
  component: BancoPruebas,
});

function BancoPruebas() {
  const qc = useQueryClient();
  const [cargando, setCargando] = useState(false);

  async function reiniciar() {
    if (!confirm("Se borrarán facturas, decisiones y eventos, y se recargarán los datos maestros. ¿Continuar?")) return;
    setCargando(true);
    try {
      await reiniciarDemo();
      await qc.invalidateQueries();
      toast.success("Datos demo reiniciados");
    } catch (e) {
      toast.error("No se pudo reiniciar: " + (e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Banco de pruebas</h1>
      <p className="mt-2 text-muted-foreground">Los casos de prueba del motor de reglas llegarán pronto.</p>
      <div className="mt-8 rounded-lg border bg-card p-6">
        <h2 className="font-medium">Datos demo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Borra facturas, decisiones y eventos, y vuelve a cargar empresa, cuentas, política v1, tipos de cambio, proveedores, contratos y pagos previos.
        </p>
        <Button variant="destructive" className="mt-4" onClick={reiniciar} disabled={cargando}>
          {cargando ? "Reiniciando…" : "Reiniciar datos demo"}
        </Button>
      </div>
    </div>
  );
}
