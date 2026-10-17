import { createFileRoute } from "@tanstack/react-router";
import { Proximamente } from "@/components/proximamente";

export const Route = createFileRoute("/subir")({
  head: () => ({
    meta: [
      { title: "Subir factura — Contralor" },
      { name: "description", content: "Carga una factura para que el agente la lea y la evalúe." },
      { property: "og:title", content: "Subir factura — Contralor" },
      { property: "og:description", content: "Carga una factura para su evaluación." },
    ],
  }),
  component: () => <Proximamente titulo="Subir factura" descripcion="La IA solo leerá la factura; la decisión la toma el motor de reglas." />,
});
