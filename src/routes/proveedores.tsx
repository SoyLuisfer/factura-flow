import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
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
  contrato_id: string;
  contrato_concepto: string;
  contrato_tipo: string;
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
    contrato_id: contrato?.id ?? "",
    contrato_concepto: contrato?.concepto ?? "",
    contrato_tipo: contrato?.tipo ?? "contrato",
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

  const contratoDe = (id: string) => contratos.find((c) => c.proveedor_id === id) ?? null;

  function abrir(p: Proveedor | null) {
    const nums = proveedores.map((x) => Number(x.id.replace(/^V/, ""))).filter((n) => !Number.isNaN(n));
    const siguienteId = `V${String(Math.max(...nums, 0) + 1).padStart(3, "0")}`;
    setEditando(p ?? "nuevo");
    setForm(formDesde(p, p ? contratoDe(p.id) : null, siguienteId));
  }

  async function guardar() {
    if (!form) return;
    if (!form.nombre.trim()) return void toast.error("El nombre es obligatorio");
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
      };
      if (editando === "nuevo") {
        const { error } = await supabase.from("proveedores").insert({ id: form.id, ...fila });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("proveedores").update(fila).eq("id", form.id);
        if (error) throw error;
      }

      // Contrato o cotización (opcional)
      if (form.contrato_monto && Number(form.contrato_monto) > 0) {
        const contratoFila = {
          proveedor_id: form.id,
          concepto: form.contrato_concepto.trim() || "Servicios",
          tipo: form.contrato_tipo,
          monto: Number(form.contrato_monto),
          moneda: form.contrato_moneda,
        };
        if (form.contrato_id) {
          const { error } = await supabase.from("contratos").update(contratoFila).eq("id", form.contrato_id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("contratos").insert({ id: `CT-${form.id}`, ...contratoFila });
          if (error) throw error;
        }
      }

      const { error: errEv } = await supabase.from("registro_eventos").insert({
        evento: "proveedor_modificado",
        actor: USUARIOS_DEMO[0],
        detalle: `${editando === "nuevo" ? "Alta" : "Edición"} del proveedor ${form.nombre.trim()} (${form.id}).`,
      });
      if (errEv) throw errEv;

      await qc.invalidateQueries();
      toast.success(editando === "nuevo" ? "Proveedor registrado" : "Proveedor actualizado");
      setEditando(null);
      setForm(null);
    } catch (e) {
      toast.error("No se pudo guardar: " + (e as Error).message);
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
                    {c ? `${fmtMonto(c.monto, c.moneda)} · ${c.tipo}` : "—"}
                  </TableCell>
                  <TableCell>{p.expediente_completo ? <Badge variant="secondary">Completo</Badge> : <Badge variant="destructive">Incompleto</Badge>}</TableCell>
                  <TableCell>{p.activo ? <Badge>Activo</Badge> : <Badge variant="outline">Inactivo</Badge>}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => abrir(p)} aria-label={`Editar ${p.nombre}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

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
                <div className="text-sm font-medium">Contrato o cotización</div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Concepto</Label>
                    <Input className="mt-1" value={form.contrato_concepto} onChange={(e) => setForm({ ...form, contrato_concepto: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Tipo</Label>
                    <Select value={form.contrato_tipo} onValueChange={(v) => setForm({ ...form, contrato_tipo: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contrato">Contrato</SelectItem>
                        <SelectItem value="cotizacion">Cotización</SelectItem>
                      </SelectContent>
                    </Select>
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
