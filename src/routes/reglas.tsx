import { createFileRoute } from "@tanstack/react-router";
import { Proximamente } from "@/components/proximamente";

export const Route = createFileRoute("/reglas")({
  head: () => ({
    meta: [
      { title: "Reglas — Contralor" },
      { name: "description", content: "Política de pagos versionada de Andes Labs." },
      { property: "og:title", content: "Reglas — Contralor" },
      { property: "og:description", content: "Política de pagos versionada." },
    ],
  }),
  component: () => <Proximamente titulo="Reglas" descripcion="Política vigente e historial de versiones." />,
});
