import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/como-funciona")({
  head: () => ({ meta: [
    { title: "Cómo funciona — Contralor" },
    { name: "description", content: "Contralor: lectura de facturas, controles auditables y tesorería de Pollos Hermanos, S. A." },
    { property: "og:title", content: "Cómo funciona — Contralor" },
    { property: "og:description", content: "Decisiones deterministas y programación de pagos con trazabilidad." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <div className="max-w-4xl px-6 py-8"><h1 className="text-2xl font-bold">Cómo funciona Contralor</h1><p className="mt-2 text-muted-foreground">Pollos Hermanos, S. A. · Guatemala · Demo sin dinero real</p>
    <div className="mt-8 space-y-6">
      <section className="border-t pt-5"><h2 className="text-lg font-bold">Lectura del documento</h2><p className="mt-2 text-sm">La IA extrae los datos de la factura; nunca decide si se paga. Las monedas disponibles son quetzales y dólares.</p></section>
      <section className="border-t pt-5"><h2 className="text-lg font-bold">Once controles, una decisión auditable</h2><p className="mt-2 text-sm">El motor determinista revisa R0–R10. Una factura se aprueba automáticamente solo si todos los controles están en OK o NO APLICA. Las excepciones requieren una decisión humana con usuario, fecha y comentario.</p></section>
      <section className="border-t pt-5"><h2 className="text-lg font-bold">Tesorería</h2><p className="mt-2 text-sm">Un pago parcial o una postergación cambia la programación, no la decisión ni la traza original. El presupuesto se consume al aprobar la factura; el saldo bancario reservado refleja los importes programados.</p></section>
      <section className="border-t pt-5"><h2 className="text-lg font-bold">Pista de auditoría</h2><p className="mt-2 text-sm">Cada acción queda registrada con su responsable. El historial se conserva y puede consultarse en la factura y en el registro de auditoría.</p></section>
    </div></div>,
});