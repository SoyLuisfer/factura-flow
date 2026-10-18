import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { USUARIOS_DEMO } from "@/lib/datos";
import { siguienteViernes, hoyGuatemala, validarAccion, type TramoPago } from "@/lib/tesoreria";
import { formatearMonto, fmtFecha, leerMonto } from "@/lib/formato";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MontoInput } from "@/components/monto-input";

export function AccionTesoreria({ tramo }: { tramo: TramoPago }) {
  const qc = useQueryClient();
  const [accion, setAccion] = useState<string | null>(null);
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState("");
  const [usuario, setUsuario] = useState("");
  const [comentario, setComentario] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const etiqueta = tramo.decision.factura?.codigo ?? tramo.decision.factura?.numero ?? "factura";
  function abrir(valor: string) {
    if (tramo.factura_liberada || tramo.liberado_lote_id) return;
    if (valor === "aprobado") return;
    setAccion(valor); setMonto(""); setUsuario(""); setComentario(""); setError(null);
    setFecha(valor === "reprogramar" ? siguienteViernes(hoyGuatemala()) : siguienteViernes(tramo.fecha_pago, true));
  }
  async function confirmar() {
    if (!accion) return;
    const problema = validarAccion(tramo, accion, leerMonto(monto), fecha, usuario, comentario);
    if (problema) { setError(problema); return; }
    setGuardando(true);
    // PostgreSQL accepts null for the virtual initial schedule and unused amount.
    const argumentos = { p_decision: tramo.decision.id, p_programacion: tramo.id, p_accion: accion, p_monto: accion === "parcial" ? leerMonto(monto) : null, p_fecha: fecha, p_actor: usuario, p_comentario: comentario.trim() };
    const { error: fallo } = await supabase.rpc("accion_tesoreria", argumentos as unknown as Database["public"]["Functions"]["accion_tesoreria"]["Args"]);
    setGuardando(false);
    if (fallo) {
      const m = fallo.message;
      setError(m.includes("FONDOS_YA_LIBERADOS") ? "Los fondos de esta factura ya fueron liberados; no se puede cambiar su programación." : m.includes("MONTO_PARCIAL") ? "El pago parcial debe ser menor que el monto pendiente y mayor que cero." : m.includes("FECHA_POSTERIOR") ? "La fecha debe ser posterior a la programada." : m.includes("DESACTUALIZADA") ? "La programación cambió. Cierra el diálogo y actualiza la página." : "No se pudo guardar la acción de tesorería. Intenta de nuevo.");
      return;
    }
    await qc.invalidateQueries(); setAccion(null); toast.success("Programación actualizada y registrada en auditoría");
  }
  if (tramo.factura_liberada || tramo.liberado_lote_id) return <span className="text-xs text-muted-foreground">Lote autorizado</span>;
  return <div onClick={(e) => e.stopPropagation()}>
    {tramo.estado === "programado" ? <Select value="aprobado" onValueChange={abrir}>
      <SelectTrigger className="w-36" aria-label={`Acción ${etiqueta}`}><SelectValue>Aprobado</SelectValue></SelectTrigger>
      <SelectContent><SelectItem value="aprobado">Aprobado</SelectItem><SelectItem value="parcial">Pago parcial</SelectItem><SelectItem value="postergar">Postergar</SelectItem></SelectContent>
    </Select> : <Button size="sm" variant="outline" onClick={() => abrir("reprogramar")}><CalendarClock className="mr-1 h-4 w-4" />Volver a programar</Button>}
    <Dialog open={accion !== null} onOpenChange={(open) => { if (!open && !guardando) setAccion(null); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{accion === "parcial" ? "Pago parcial" : accion === "postergar" ? "Postergar pago" : "Volver a programar"} · {etiqueta}</DialogTitle>
          <DialogDescription>{tramo.decision.factura?.emisor} · {formatearMonto(tramo.monto, tramo.moneda)} · fecha actual {fmtFecha(tramo.fecha_pago)}</DialogDescription></DialogHeader>
        <div className="space-y-4">
          {accion === "parcial" && <div><Label htmlFor="monto-parcial">Monto a pagar este viernes</Label><MontoInput id="monto-parcial" className="mt-1" value={monto} onValueChange={setMonto} />
            {leerMonto(monto) > 0 && leerMonto(monto) < tramo.monto && <p className="mt-1 text-right text-sm text-muted-foreground">Saldo pendiente: {formatearMonto(tramo.monto - leerMonto(monto), tramo.moneda)}</p>}</div>}
          <div><Label htmlFor="fecha-tesoreria">{accion === "parcial" ? "Fecha para el saldo pendiente" : "Nueva fecha de pago"}</Label><Input id="fecha-tesoreria" type="date" className="mt-1" value={fecha} disabled={accion === "reprogramar"} onChange={(e) => setFecha(e.target.value)} /></div>
          <div><Label htmlFor="usuario-tesoreria">Usuario</Label><Select value={usuario} onValueChange={setUsuario}><SelectTrigger id="usuario-tesoreria" className="mt-1"><SelectValue placeholder="Seleccionar usuario" /></SelectTrigger><SelectContent>{USUARIOS_DEMO.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
          <div><Label htmlFor="comentario-tesoreria">Comentario obligatorio</Label><Textarea id="comentario-tesoreria" className="mt-1" value={comentario} onChange={(e) => setComentario(e.target.value)} /></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter><Button variant="outline" disabled={guardando} onClick={() => setAccion(null)}>Cancelar</Button><Button disabled={guardando} onClick={confirmar}>{guardando ? "Guardando…" : "Confirmar"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}