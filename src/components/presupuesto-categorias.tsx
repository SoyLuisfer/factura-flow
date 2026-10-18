import type { DecisionConRelaciones } from "@/lib/datos";
import type { ParametrosPolitica } from "@/lib/motorReglas";
import { formatearMonto, formatearPorcentaje } from "@/lib/formato";

export function PresupuestoCategorias({ parametros, decisiones, pagosPrevios }: { parametros: ParametrosPolitica; decisiones: DecisionConRelaciones[]; pagosPrevios: { categoria: string; fecha_pago: string; monto_usd: number }[] }) {
  const periodo = new Date().toISOString().slice(0, 7);
  const ultimas = new Map<string, DecisionConRelaciones>();
  for (const d of decisiones) { const previa = ultimas.get(d.factura_id); if (!previa || d.decidido_en > previa.decidido_en) ultimas.set(d.factura_id, d); }
  return <section className="mt-8"><h2 className="text-lg font-bold">Presupuesto por categoría · {periodo}</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {Object.entries(parametros.presupuesto_por_categoria_usd).map(([categoria, presupuesto]) => {
      const consumo = pagosPrevios.filter((p) => p.categoria === categoria && p.fecha_pago.startsWith(periodo)).reduce((s, p) => s + p.monto_usd, 0)
        + [...ultimas.values()].filter((d) => d.decision === "PAGAR" && d.categoria === categoria && d.factura?.fecha_recepcion?.startsWith(periodo)).reduce((s, d) => s + (d.monto_usd ?? 0), 0);
      const pct = presupuesto > 0 ? consumo / presupuesto * 100 : 0;
      return <div key={categoria} className="rounded-lg border bg-card p-4"><div className="flex justify-between gap-3 text-sm"><span className="font-bold">{categoria}</span><span className="text-right tabular-nums">{formatearPorcentaje(pct)}</span></div>
        <p className="mt-2 text-right text-xs tabular-nums">{formatearMonto(consumo, "USD")} / {formatearMonto(presupuesto, "USD")}</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-acento-suave"><div className={`h-full ${pct > 90 ? "bg-decision-escalar" : "bg-primary"}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
        <p className="mt-2 text-right text-xs text-muted-foreground">Disponible: {formatearMonto(presupuesto - consumo, "USD")}</p></div>;
    })}</div></section>;
}