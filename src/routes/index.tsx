import { createFileRoute } from "@tanstack/react-router";
import { Proximamente } from "@/components/proximamente";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tablero — Contralor" },
      { name: "description", content: "Agente de cuentas por pagar de Andes Labs: decisiones auditables por factura." },
      { property: "og:title", content: "Tablero — Contralor" },
      { property: "og:description", content: "Agente de cuentas por pagar con reglas deterministas y registro auditable." },
    ],
  }),
  component: () => <Proximamente titulo="Tablero" descripcion="Resumen de facturas y decisiones del agente." />,
});
