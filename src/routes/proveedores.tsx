import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { leerHistorialProveedor, tieneHistorialProtegido, type HistorialProveedor } from "@/lib/bajaProveedor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { contratosQuery, datosMaestrosQuery, proveedoresQuery, USUARIOS_DEMO, type Contrato, type Proveedor } from "@/lib/datos";
import { fmtMonto } from "@/lib/formato";

export const Route = createFileRoute("/proveedores")({
  head: () => ({
    meta: [
      { title: "Proveedores — Contralor" },
      { name: "description", content: "Proveedores y contratistas registrados de Andes Labs." },
      { property: "og:title", content: "Proveedores — Contralor" },
      { property: "og:description", content: "Proveedores y contratistas registrados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(proveedoresQuery),
      context.queryClient.ensureQueryData(contratosQuery),
      context.queryClient.ensureQueryData(datosMaestrosQuery),
    ]),
  component: Proveedores,
});

const CATEGORIAS = ["Contratistas", "Marketing", "Oficina", "Proyectos", "Servicios profesionales", "Software y hosting"];
const TIPOS = ["contratista", "proveedor"];

interface FormState {
  id: string;
  nombre: string;
  pais: string;
  tipo: string;
  categoria: string;
  moneda_factura: string;
  cuenta_pago: string;
  permite_conversion: boolean;
  banco_beneficiario: string;
  cuenta_beneficiario: string;
  expediente_completo: boolean;
  activo: boolean;
  tipo_relacion: string;
  contrato_id: string;
  contrato_concepto: string;
  contrato_monto: string;
  contrato_moneda: string;
}

function formDesde(p: Proveedor | null, contrato: Contrato | null, siguienteId: string): FormState {
  return {
    id: p?.id ?? siguienteId,
    nombre: p?.nombre ?? "",
    pais: p?.pais ?? "",
    tipo: p?.tipo ?? "proveedor",
    categoria: p?.categoria ?? "Contratistas",
    moneda_factura: p?.moneda_factura ?? "USD",
    cuenta_pago: p?.cuenta_pago ?? "BANK-USD",
    permite_conversion: p?.permite_conversion ?? false,
    banco_beneficiario: p?.banco_beneficiario ?? "",
    cuenta_beneficiario: p?.cuenta_beneficiario ?? "",
    expediente_completo: p?.expediente_completo ?? false,
    activo: p?.activo ?? true,
    tipo_relacion: p?.tipo_relacion ?? "compra_directa",
    contrato_id: contrato?.id ?? "",
    contrato_concepto: contrato?.concepto ?? "",
    contrato_monto: contrato != null ? String(contrato.monto) : "",
    contrato_moneda: contrato?.moneda ?? "USD",
  };
}

function Proveedores() {
  const qc = useQueryClient();
  const { data: proveedores } = useSuspenseQuery(proveedoresQuery);
  const { data: contratos } = useSuspenseQuery(contratosQuery);
  const { data: maestros } = useSuspenseQuery(datosMaestrosQuery);

  const [editando, setEditando] = useState<Proveedor | null | "nuevo">(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [baja, setBaja] = useState<{ proveedor: Proveedor; historial: HistorialProveedor } | null>(null);
  const [usuarioBaja, setUsuarioBaja] = useState("");
  const [procesandoBaja, setProcesandoBaja] = useState(false);
  const [consultandoBaja, setConsultandoBaja] = useState<string | null>(null);

  async function abrirBaja(proveedor: Proveedor) {
    setConsultandoBaja(proveedor.id);
    try {
      const { data, error } = await supabase.rpc("historial_proveedor", { p_id: proveedor.id });
      if (error) throw error;
      setBaja({ proveedor, historial: leerHistorialProveedor(data) });
      setUsuarioBaja("");
    } catch {
      toast.error("No se pudo consultar el historial del proveedor. Intenta de nuevo.");
    } finally {
      setConsultandoBaja(null);
    }
  }

  async function confirmarBaja() {
    if (!baja || !usuarioBaja || procesandoBaja) return;
    setProcesandoBaja(true);
    const accion = tieneHistorialProtegido(baja.historial) ? "desactivar" : "eliminar";
    try {
      const { error } = await supabase.rpc("gestionar_baja_proveedor", { p_id: baja.proveedor.id, p_actor: usuarioBaja, p_accion: accion });
      if (error) throw error;
      await qc.invalidateQueries();
      setBaja(null);
      toast.success(accion === "eliminar" ? "Proveedor eliminado" : "Proveedor desactivado");
    } catch (e) {
      if (e && typeof e === "object" && "message" in e && String(e.message).includes("PROVEEDOR_CON_HISTORIAL")) {
        toast.error("El proveedor tiene historial y no se puede eliminar. Puedes desactivarlo.");
        await abrirBaja(baja.proveedor);
      } else {
        toast.error("No se pudo completar el cambio. No se eliminó el proveedor. Intenta de nuevo.");
      }
    } finally {
      setProcesandoBaja(false);
    }
  }

  const contratoDe = (id: string) => contratos.find((c) => c.proveedor_id === id) ?? null;

  /** Traduce errores técnicos de la base a mensajes claros en español. */
  function traducirError(e: Error): string {
    const m = e.message;
    if (m.includes("duplicate key") && m.includes("proveedores_pkey")) return "Ya existe un proveedor con ese ID.";
    if (m.includes("duplicate key") && m.includes("contratos_pkey")) return "Ya existe un contrato con ese ID.";
    if (m.includes("duplicate key")) return "Ya existe un registro con ese identificador.";
    if (m.includes("foreign key")) return "Un dato relacionado no existe (revisa la cuenta de pago).";
    if (m.includes("CONTRATO_INVALIDO") || m.includes("contratos_tipo_check")) return "Revisa el tipo y el monto del contrato.";
    if (m.includes("CONTRATO_REQUERIDO")) return "Un contrato recurrente o una cotización necesita concepto, monto y moneda.";
    if (m.includes("TIPO_RELACION_INVALIDO")) return "Elige un tipo de relación válido.";
    if (m.includes("PROVEEDOR_NO_ENCONTRADO")) return "El proveedor ya no existe. Actualiza la lista.";
    if (m.includes("CONTRATO_NO_ENCONTRADO")) return "El contrato ya no existe. Vuelve a abrir el proveedor.";
    if (m.includes("row-level security")) return "No tienes permiso para hacer este cambio.";
    return "No se pudo guardar. Intenta de nuevo.";
  }

  /** Siguiente ID libre a partir del número más alto existente en la base (nunca contando filas). */
  async function siguienteIdProveedor(): Promise<string> {
    const { data, error } = await supabase.from("proveedores").select("id");
    if (error) throw error;
    const nums = (data ?? []).map((x) => Number(x.id.replace(/^V/, ""))).filter((n) => !Number.isNaN(n));
    return `V${String(Math.max(0, ...nums) + 1).padStart(3, "0")}`;
  }

  async function abrir(p: Proveedor | null) {
    let siguienteId = "";
    if (!p) {
      try {
        siguienteId = await siguienteIdProveedor();
      } catch {
        toast.error("No se pudo calcular el siguiente ID de proveedor.");
        return;
      }
    }
    setEditando(p ?? "nuevo");
    setForm(formDesde(p, p ? contratoDe(p.id) : null, siguienteId));
  }

  async function guardar() {
    if (!form) return;
    if (!form.nombre.trim()) return void toast.error("El nombre es obligatorio");
    const conContrato = form.tipo_relacion !== "compra_directa";
    if (conContrato && (!Number.isFinite(Number(form.contrato_monto)) || Number(form.contrato_monto) <= 0)) return void toast.error("El monto del contrato o cotización debe ser mayor que cero.");
    setGuardando(true);
    try {
      const fila = {
        nombre: form.nombre.trim(),
        pais: form.pais.trim(),
        tipo: form.tipo,
        categoria: form.categoria,
        moneda_factura: form.moneda_factura,
        cuenta_pago: form.cuenta_pago,
        permite_conversion: form.permite_conversion,
        banco_beneficiario: form.banco_beneficiario.trim() || null,
        cuenta_beneficiario: form.cuenta_beneficiario.trim() || null,
        expediente_completo: form.expediente_completo,
        activo: form.activo,
        tipo_relacion: form.tipo_relacion,
      };
      let idProveedor = form.id;
      const contrato = conContrato ? {
        id: form.contrato_id,
        concepto: form.contrato_concepto.trim() || "Servicios",
        tipo: form.tipo_relacion === "recurrente" ? "mensual" : "unica",
        monto: Number(form.contrato_monto),
        moneda: form.contrato_moneda,
      } : null;
      let guardado = false;
      for (let intento = 0; intento < 3 && !guardado; intento++) {
        const { error } = await supabase.rpc("guardar_proveedor", {
          p_proveedor: { id: idProveedor, ...fila },
          p_contrato: contrato,
          p_nuevo: editando === "nuevo",
          p_actor: USUARIOS_DEMO[0],
        });
        if (!error) {
          guardado = true;
        } else if (editando === "nuevo" && error.message.includes("duplicate key") && error.message.includes("proveedores_pkey")) {
          idProveedor = await siguienteIdProveedor();
        } else {
          throw error;
        }
      }
      if (!guardado) throw new Error("duplicate key proveedores_pkey");

      await qc.invalidateQueries();
      toast.success(editando === "nuevo" ? "Proveedor registrado" : "Proveedor actualizado");
      setEditando(null);
      setForm(null);
    } catch (e) {
      toast.error(traducirError(e as Error));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="px-6 py-8">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proveedores</h1>
          <p className="mt-1 text-sm text-muted-foreground">{proveedores.length} proveedores registrados.</p>
        </div>
        <Button onClick={() => abrir(null)}>
          <Plus className="mr-1 h-4 w-4" /> Agregar proveedor
        </Button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead><TableHead>Nombre</TableHead><TableHead>País</TableHead>
              <TableHead>Categoría</TableHead><TableHead>Moneda</TableHead><TableHead>Cuenta de pago</TableHead>
              <TableHead>Conversión</TableHead><TableHead>Beneficiario</TableHead>
              <TableHead className="text-right">Contrato / cotización</TableHead>
              <TableHead>Expediente</TableHead><TableHead>Estado</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {proveedores.map((p) => {
              const c = contratoDe(p.id);
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.id}</TableCell>
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell>{p.pais}</TableCell>
                  <TableCell>{p.categoria}</TableCell>
                  <TableCell className="font-mono text-xs">{p.moneda_factura}</TableCell>
                  <TableCell className="font-mono text-xs">{p.cuenta_pago}</TableCell>
                  <TableCell>{p.permite_conversion ? "Sí" : "No"}</TableCell>
                  <TableCell className="text-xs">
                    <div>{p.banco_beneficiario}</div>
                    <div className="font-mono text-muted-foreground">{p.cuenta_beneficiario}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {p.tipo_relacion === "compra_directa" || !c
                      ? "Compra directa"
                      : p.tipo_relacion === "recurrente"
                        ? `Recurrente · ${fmtMonto(c.monto, c.moneda)}`
                        : `Cotización · ${fmtMonto(c.monto, c.moneda)} · ${c.estado}`}
                  </TableCell>
                  <TableCell>{p.expediente_completo ? <Badge variant="secondary">Completo</Badge> : <Badge variant="destructive">Incompleto</Badge>}</TableCell>
                  <TableCell>{p.activo ? <Badge>Activo</Badge> : <Badge variant="outline">Inactivo</Badge>}</TableCell>
                  <TableCell>
                     <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => abrir(p)} aria-label={`Editar ${p.nombre}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                     <Button variant="ghost" size="icon" className="text-destructive/70 hover:bg-destructive/10 hover:text-destructive" disabled={consultandoBaja !== null} onClick={() => abrirBaja(p)} aria-label={`Eliminar ${p.nombre} (${p.id})`} title="Eliminar proveedor">
                       <Trash2 className="h-4 w-4" />
                     </Button>
                     </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={baja !== null} onOpenChange={(open) => { if (!open && !procesandoBaja) setBaja(null); }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{baja && tieneHistorialProtegido(baja.historial) ? "Proveedor con historial" : `¿Eliminar el proveedor ${baja?.proveedor.nombre ?? ""} (${baja?.proveedor.id ?? ""})?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {baja && tieneHistorialProtegido(baja.historial)
                ? `Este proveedor tiene historial (${baja.historial.facturas} facturas / ${baja.historial.pagos} pagos). Para conservar la pista de auditoría no se puede eliminar; puedes desactivarlo.`
                : "Esta acción no se puede deshacer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {baja && !tieneHistorialProtegido(baja.historial) && baja.historial.contratos > 0 && <p className="text-sm text-muted-foreground">También se eliminarán sus contratos o cotizaciones ({baja.historial.contratos}).</p>}
          <div className="space-y-2">
            <Label htmlFor="usuario-baja">Usuario</Label>
            <Select value={usuarioBaja} onValueChange={setUsuarioBaja} disabled={procesandoBaja}>
              <SelectTrigger id="usuario-baja"><SelectValue placeholder="Seleccionar usuario" /></SelectTrigger>
              <SelectContent>{USUARIOS_DEMO.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={procesandoBaja}>Cancelar</AlertDialogCancel>
            <Button variant={baja && tieneHistorialProtegido(baja.historial) ? "default" : "destructive"} disabled={!usuarioBaja || procesandoBaja} onClick={confirmarBaja}>
              {procesandoBaja ? "Procesando…" : baja && tieneHistorialProtegido(baja.historial) ? "Desactivar" : "Eliminar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editando !== null} onOpenChange={(open) => { if (!open) { setEditando(null); setForm(null); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editando === "nuevo" ? "Agregar proveedor" : `Editar ${form?.nombre ?? ""}`}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>ID</Label>
                <Input className="mt-1 font-mono" value={form.id} disabled />
              </div>
              <div>
                <Label>Nombre</Label>
                <Input className="mt-1" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              </div>
              <div>
                <Label>País</Label>
                <Input className="mt-1" value={form.pais} onChange={(e) => setForm({ ...form, pais: e.target.value })} />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoría</Label>
                <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Moneda de factura</Label>
                <Select value={form.moneda_factura} onValueChange={(v) => setForm({ ...form, moneda_factura: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{["USD", "GTQ", "COP", "MXN", "ARS"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cuenta de pago de Andes Labs</Label>
                <Select value={form.cuenta_pago} onValueChange={(v) => setForm({ ...form, cuenta_pago: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {maestros.cuentas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.id} ({c.moneda})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Banco del beneficiario</Label>
                <Input className="mt-1" value={form.banco_beneficiario} onChange={(e) => setForm({ ...form, banco_beneficiario: e.target.value })} />
              </div>
              <div>
                <Label>Cuenta del beneficiario</Label>
                <Input className="mt-1 font-mono" value={form.cuenta_beneficiario} onChange={(e) => setForm({ ...form, cuenta_beneficiario: e.target.value })} />
              </div>
              <div className="col-span-2 flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.permite_conversion} onCheckedChange={(v) => setForm({ ...form, permite_conversion: v === true })} />
                  Permite conversión de moneda
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.expediente_completo} onCheckedChange={(v) => setForm({ ...form, expediente_completo: v === true })} />
                  Expediente completo
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.activo} onCheckedChange={(v) => setForm({ ...form, activo: v === true })} />
                  Activo
                </label>
              </div>

              <div className="col-span-2 mt-2 rounded border p-3">
                <div className="text-sm font-medium">Tipo de relación</div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Select value={form.tipo_relacion} onValueChange={(v) => setForm({ ...form, tipo_relacion: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compra_directa">Compra directa (sin contrato)</SelectItem>
                        <SelectItem value="recurrente">Contrato recurrente</SelectItem>
                        <SelectItem value="cotizacion">Cotización</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {form.tipo_relacion === "compra_directa" && "Compras puntuales sin contrato ni cotización; la regla R6 no aplica."}
                      {form.tipo_relacion === "recurrente" && "Servicios o contratistas que cobran cada periodo; se compara contra el monto del contrato."}
                      {form.tipo_relacion === "cotizacion" && "Compra puntual acordada; la cotización se usa una sola vez."}
                    </p>
                  </div>
                  {form.tipo_relacion !== "compra_directa" && (
                    <>
                      <div className="col-span-2">
                        <Label className="text-xs text-muted-foreground">Concepto</Label>
                        <Input className="mt-1" value={form.contrato_concepto} onChange={(e) => setForm({ ...form, contrato_concepto: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Moneda</Label>
                        <Select value={form.contrato_moneda} onValueChange={(v) => setForm({ ...form, contrato_moneda: v })}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>{["USD", "GTQ", "COP", "MXN", "ARS"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Monto</Label>
                        <Input className="mt-1 font-mono" value={form.contrato_monto} inputMode="decimal" onChange={(e) => setForm({ ...form, contrato_monto: e.target.value })} />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="col-span-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setEditando(null); setForm(null); }}>Cancelar</Button>
                <Button onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
