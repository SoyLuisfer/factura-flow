import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Unlock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { USUARIOS_DEMO, type CuentaBancaria } from "@/lib/datos";
import { descargarLote, obtenerLotePendiente, validarLiberacion, type LotePago } from "@/lib/lotes";
import { fmtFechaCorta, fmtFechaHora, formatearMonto } from "@/lib/formato";
import { hoyGuatemala, type TramoPago } from "@/lib/tesoreria";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function LiberarFondos({ cuenta, tramos, lotes }: { cuenta: CuentaBancaria; tramos: TramoPago[]; lotes: LotePago[] }) {
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [usuario, setUsuario] = useState("");
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const lote = obtenerLotePendiente(tramos, cuenta.id, hoyGuatemala());
  const insuficiente = lote.total > cuenta.saldo_disponible;
  const bloqueado = lote.filas.some((f) => f.factura_liberada);
  async function confirmar() {
    const problema = validarLiberacion(lote.total, cuenta.saldo_disponible, usuario, comentario, cuenta.moneda);
    if (problema) { setError(problema); return; }
    if (!lote.fecha) return;
    setGuardando(true);
    try {
      const { data, error: fallo } = await supabase.rpc("liberar_fondos", { p_cuenta: cuenta.id, p_fecha: lote.fecha, p_facturas: [...new Set(lote.filas.map((f) => f.decision.factura_id))].sort(), p_total: lote.total, p_actor: usuario, p_comentario: comentario.trim() });
      if (fallo) {
        setError(fallo.message.includes("SALDO_INSUFICIENTE") ? "El saldo disponible cambió y no alcanza. Actualiza el lote y usa Pago parcial o Postergar." : fallo.message.includes("OTRO_LOTE") || fallo.message.includes("LIBERADOS") ? "Una factura ya pertenece a un lote liberado; no puede incluirse en otro." : "El lote cambió o no se pudo liberar. Cierra el diálogo y vuelve a revisar los pagos.");
        await qc.invalidateQueries(); return;
      }
      await qc.invalidateQueries(); setAbierto(false); toast.success(`Fondos liberados · ${data}`);
    } finally { setGuardando(false); }
  }
  return <div className="mt-4 space-y-3">
    {lotes.map((l) => <div key={l.id} className="border-t pt-3 text-sm">
      <p className="text-right font-bold text-decision-pagar">Liberado {fmtFechaCorta(l.fecha_pago)}: {formatearMonto(l.total, cuenta.moneda)} · {l.id}</p>
      <p className="mt-1 text-right text-xs text-muted-foreground">{l.liberado_por} · {fmtFechaHora(l.liberado_en)}</p>
      <Button variant="outline" size="sm" className="mt-2" onClick={() => descargarLote(l)} aria-label={`Descargar lote (CSV) ${l.id}`}><Download className="mr-2 h-4 w-4" />Descargar lote (CSV)</Button>
    </div>)}
    <Button className="w-full" variant={lote.filas.length ? "default" : "outline"} disabled={!lote.filas.length} onClick={() => { setError(null); setUsuario(""); setComentario(""); setAbierto(true); }}><Unlock className="mr-2 h-4 w-4" />{lote.filas.length ? `Liberar fondos · ${lote.cantidad} facturas` : "Sin pagos programados"}</Button>
    <Dialog open={abierto} onOpenChange={(v) => { if (!guardando) setAbierto(v); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Liberar fondos · {cuenta.id}</DialogTitle><DialogDescription>Lote del {lote.fecha ? fmtFechaCorta(lote.fecha) : "—"} · {lote.cantidad} facturas</DialogDescription></DialogHeader>
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Proveedor</TableHead><TableHead>Factura</TableHead><TableHead className="text-right">Monto a liberar</TableHead></TableRow></TableHeader><TableBody>
          {lote.filas.map((t) => <TableRow key={t.id ?? t.decision.id}><TableCell>{t.decision.proveedor?.nombre ?? t.decision.factura?.emisor}</TableCell><TableCell>{t.decision.factura?.codigo} · {t.decision.factura?.numero}</TableCell><TableCell className="text-right whitespace-nowrap">{formatearMonto(t.monto_cuenta, cuenta.moneda)}{t.moneda !== cuenta.moneda && <div className="text-xs text-muted-foreground">{formatearMonto(t.monto, t.moneda)}</div>}</TableCell></TableRow>)}
        </TableBody></Table></div>
        <dl className="space-y-2 border-y py-3 text-sm"><div className="flex justify-between gap-4"><dt>Total a liberar</dt><dd className="text-right font-bold">{formatearMonto(lote.total, cuenta.moneda)}</dd></div><div className="flex justify-between gap-4"><dt>Saldo disponible actual</dt><dd className="text-right">{formatearMonto(cuenta.saldo_disponible, cuenta.moneda)}</dd></div><div className="flex justify-between gap-4"><dt>Saldo después de liberar</dt><dd className={`text-right font-bold ${insuficiente ? "text-destructive" : ""}`}>{formatearMonto(cuenta.saldo_disponible - lote.total, cuenta.moneda)}</dd></div></dl>
        {insuficiente && <p role="alert" className="text-sm text-destructive">Saldo insuficiente: faltan {formatearMonto(lote.total - cuenta.saldo_disponible, cuenta.moneda)}. Usa Pago parcial o Postergar.</p>}
        {bloqueado && <p role="alert" className="text-sm text-destructive">Una factura ya pertenece a un lote liberado y no puede incluirse en otro.</p>}
        <div><Label htmlFor={`usuario-lote-${cuenta.id}`}>Usuario</Label><Select value={usuario} onValueChange={setUsuario}><SelectTrigger id={`usuario-lote-${cuenta.id}`} className="mt-1"><SelectValue placeholder="Seleccionar usuario" /></SelectTrigger><SelectContent>{USUARIOS_DEMO.map((u) => <SelectItem value={u} key={u}>{u}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor={`comentario-lote-${cuenta.id}`}>Comentario obligatorio</Label><Textarea id={`comentario-lote-${cuenta.id}`} value={comentario} onChange={(e) => setComentario(e.target.value)} className="mt-1" /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button variant="outline" disabled={guardando} onClick={() => setAbierto(false)}>Cancelar</Button><Button disabled={guardando || insuficiente || bloqueado || !lote.filas.length} onClick={confirmar}>{guardando ? "Liberando…" : "Liberar fondos"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}