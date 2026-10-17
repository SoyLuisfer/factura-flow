import { createFileRoute } from "@tanstack/react-router";
import { Proximamente } from "@/components/proximamente";

export const Route = createFileRoute("/auditoria")({
  head: () => ({
    meta: [
      { title: "Registro de auditoría — Contralor" },
      { name: "description", content: "Historial inalterable de cada evento y decisión." },
      { property: "og:title", content: "Registro de auditoría — Contralor" },
      { property: "og:description", content: "Historial inalterable de cada evento y decisión." },
    ],
  }),
  component: () => <Proximamente titulo="Registro de auditoría" descripcion="Cada evento queda registrado y nunca se edita ni se borra." />,
});
