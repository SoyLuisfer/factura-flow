import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { UploadCloud, FileText, MessageSquareText, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";



import { type DecisionSalida, type FacturaEntrada } from "@/lib/motorReglas";
import { extraerFactura } from "@/lib/extraccion.functions";
import type { ExtraccionFactura } from "@/lib/extraccion";
import { archivoADataUrl, leerPdf } from "@/lib/pdf";
import { ESTILO_DECISION, ETIQUETA_DECISION, fmtMonto } from "@/lib/formato";
import { procesarFacturaExtraida, errorProcesamiento } from "@/lib/procesamiento";
import { fmtFechaHora } from "@/lib/formato";

export const Route = createFileRoute("/subir")({
  head: () => ({
    meta: [
      { title: "Subir factura — Contralor" },
      { name: "description", content: "Carga una factura para que el agente la lea y la evalúe." },
      { property: "og:title", content: "Subir factura — Contralor" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:description", content: "Carga una factura para su evaluación." },
    ],
  }),
  component: SubirFactura,
});

type EstadoItem = "subiendo" | "leyendo" | "decidiendo" | "listo" | "error";

interface ItemProceso {
  id: string;
  nombre: string;
  estado: EstadoItem;
  detalle?: string;
  facturaId?: string;
  decision?: DecisionSalida;
  extraccion?: ExtraccionFactura;
}

const ETIQUETA_ESTADO: Record<EstadoItem, string> = {
  subiendo: "Subiendo…",
  leyendo: "Leyendo documento…",
  decidiendo: "Evaluando 11 reglas…",
  listo: "Listo",
  error: "Error",
};

const CANALES = ["correo", "whatsapp", "slack", "otro"] as const;

function SubirFactura() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [canal, setCanal] = useState<string>("correo");
  const [ultimaRecepcion, setUltimaRecepcion] = useState<string | null>(null);
  const [items, setItems] = useState<ItemProceso[]>([]);
  const [textoChat, setTextoChat] = useState("");
  const [procesandoChat, setProcesandoChat] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);

  function actualizarItem(id: string, cambios: Partial<ItemProceso>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...cambios } : it)));
  }

  async function procesarArchivo(archivo: File) {
    const recibidaEn = new Date().toISOString();
    setUltimaRecepcion(recibidaEn);
    let archivoPath: string | null = null;
    const id = crypto.randomUUID();
    setItems((prev) => [...prev, { id, nombre: archivo.name, estado: "subiendo" }]);
    try {
      // 1. Subir el archivo al almacenamiento
      const path = `${Date.now()}-${archivo.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: errUp } = await supabase.storage.from("facturas").upload(path, archivo);
      if (errUp) throw errUp;
      archivoPath = path;

      // 2. Leer el contenido
      actualizarItem(id, { estado: "leyendo" });
      const ext = archivo.name.toLowerCase().split(".").pop() ?? "";
      let modo: "texto" | "imagen";
      let texto: string | undefined;
      let imagen: string | undefined;
      let textoOriginal: string | null = null;
      if (ext === "pdf") {
        const lectura = await leerPdf(archivo);
        if (lectura.tipo === "texto") {
          modo = "texto";
          texto = lectura.texto;
          textoOriginal = lectura.texto;
        } else {
          modo = "imagen";
          imagen = lectura.dataUrl;
        }
      } else if (ext === "txt") {
        modo = "texto";
        texto = await archivo.text();
        textoOriginal = texto;
      } else {
        modo = "imagen";
        imagen = await archivoADataUrl(archivo);
      }

      // 3. Extraer con IA (solo extrae; nunca decide)
      const { extraccion, modelo, error: errorExtraccion } = await extraerFactura({
        data: { modo, texto, imagen, nombreArchivo: archivo.name },
      });
      if (errorExtraccion) toast.warning(`${archivo.name}: la extracción falló dos veces; se guarda con confianza 0 y el motor la escalará.`);

      // 4. Decidir con el motor (contexto completo de la base)
      actualizarItem(id, { estado: "decidiendo" });
      
      const entrada: FacturaEntrada = {
        canal,
        tipo_documento: extraccion.tipo_documento,
        emisor: extraccion.emisor,
        receptor: extraccion.receptor,
        numero: extraccion.numero,
        fecha_emision: extraccion.fecha_emision,
        fecha_vencimiento: extraccion.fecha_vencimiento,
        descripcion: extraccion.descripcion,
        monto: extraccion.monto,
        moneda: extraccion.moneda,
        pago_banco: extraccion.pago_banco,
        pago_cuenta: extraccion.pago_cuenta,
        confianza_extraccion: extraccion.confianza,
        fecha_recepcion: recibidaEn,
      };
      

      // 5. Guardar
      const { facturaId, decision } = await procesarFacturaExtraida({
        entrada,
        extraccion,
        modelo,
        archivoPath: path,
        nombreArchivo: archivo.name,
        textoOriginal,
      });
      actualizarItem(id, { estado: "listo", facturaId, decision, extraccion });
      await qc.invalidateQueries();
    } catch (e) {
      if (archivoPath) await supabase.storage.from("facturas").remove([archivoPath]);
      actualizarItem(id, { estado: "error", detalle: errorProcesamiento(e) });
    }
  }

  async function procesarChat() {
    if (!textoChat.trim()) return void toast.error("Pega el texto del mensaje primero");
    const recibidaEn = new Date().toISOString();
    setUltimaRecepcion(recibidaEn);
    setProcesandoChat(true);
    const id = crypto.randomUUID();
    const nombre = `Mensaje de ${canal}`;
    setItems((prev) => [...prev, { id, nombre, estado: "leyendo" }]);
    try {
      const { extraccion, modelo, error: errorExtraccion } = await extraerFactura({
        data: { modo: "texto", texto: textoChat.trim(), nombreArchivo: nombre },
      });
      if (errorExtraccion) toast.warning("La extracción falló dos veces; se guarda con confianza 0 y el motor la escalará.");

      actualizarItem(id, { estado: "decidiendo" });
      
      const entrada: FacturaEntrada = {
        canal,
        tipo_documento: extraccion.tipo_documento,
        emisor: extraccion.emisor,
        receptor: extraccion.receptor,
        numero: extraccion.numero,
        fecha_emision: extraccion.fecha_emision,
        fecha_vencimiento: extraccion.fecha_vencimiento,
        descripcion: extraccion.descripcion,
        monto: extraccion.monto,
        moneda: extraccion.moneda,
        pago_banco: extraccion.pago_banco,
        pago_cuenta: extraccion.pago_cuenta,
        confianza_extraccion: extraccion.confianza,
        fecha_recepcion: recibidaEn,
      };
      
      const { facturaId, decision } = await procesarFacturaExtraida({
        entrada,
        extraccion,
        modelo,
        nombreArchivo: null,
        textoOriginal: textoChat.trim(),
      });
      actualizarItem(id, { estado: "listo", facturaId, decision, extraccion });
      setTextoChat("");
      await qc.invalidateQueries();
    } catch (e) {
      actualizarItem(id, { estado: "error", detalle: errorProcesamiento(e) });
    } finally {
      setProcesandoChat(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setArrastrando(false);
    const archivos = Array.from(e.dataTransfer.files).filter((f) => /\.(pdf|png|jpe?g|txt)$/i.test(f.name));
    if (archivos.length === 0) return void toast.error("Solo se aceptan archivos PDF, PNG, JPG o TXT");
    void (async () => { for (const a of archivos) await procesarArchivo(a); })();
  }

  const procesadas = items.filter((it) => it.estado === "listo");
  const conteo = (decision: string) => procesadas.filter((it) => it.decision?.decision === decision).length;
  const activo = items.find((it) => ["subiendo", "leyendo", "decidiendo"].includes(it.estado));
  return (
    <div className="px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Subir factura</h1>
      <p className="mt-2 text-muted-foreground">
        La IA solo lee el documento y extrae los datos; la decisión la toma el motor de reglas. Acepta PDF, PNG, JPG o TXT.
      </p>

      <div className="mt-6 grid max-w-4xl grid-cols-2 gap-4">
        <div>
          <Label>Canal de recepción</Label>
          <Select value={canal} onValueChange={setCanal}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CANALES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Fecha de recepción</Label>
          <div className="mt-1 tabular-nums text-sm">{ultimaRecepcion ? fmtFechaHora(ultimaRecepcion) : "Al recibir la factura"}</div>
        </div>
      </div>

      <div
        className={`mt-6 flex max-w-4xl cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
          arrastrando ? "border-primary bg-acento-suave" : "border-border bg-card hover:border-primary/50"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      >
        <UploadCloud className="h-10 w-10 text-muted-foreground" />
        <p className="mt-3 font-medium">Arrastra aquí uno o varios archivos</p>
        <p className="mt-1 text-sm text-muted-foreground">o haz clic para elegirlos (PDF, PNG, JPG, TXT)</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.txt"
          className="hidden"
          onChange={(e) => {
            const archivos = Array.from(e.target.files ?? []);
            void (async () => { for (const a of archivos) await procesarArchivo(a); })();
            e.target.value = "";
          }}
        />
      </div>

      <div className="mt-6 max-w-4xl rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-medium">O pega el texto de un mensaje de chat</h2>
        </div>
        <Textarea
          className="mt-3 min-h-28"
          placeholder='Ej.: "Hola, ¿nos pueden pagar la factura KO-010 por Q 3,500? Gracias"'
          value={textoChat}
          onChange={(e) => setTextoChat(e.target.value)}
        />
        <Button className="mt-3" onClick={procesarChat} disabled={procesandoChat}>
          {procesandoChat ? "Procesando…" : "Procesar mensaje"}
        </Button>
      </div>

      {items.length > 0 && (
        <div className="mt-8 max-w-4xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-bold">Progreso</h2><p className="mt-2 text-sm text-muted-foreground" aria-live="polite">{procesadas.length} procesadas · {conteo("PAGAR")} aprobadas · {conteo("ESCALAR")} por aprobar · {conteo("FRENAR")} frenadas · {conteo("POSTERGAR")} pospuestas{items.some((it) => it.estado === "error") ? ` · ${items.filter((it) => it.estado === "error").length} con error` : ""}</p></div><Button variant="outline" asChild><Link to="/">Ir al tablero</Link></Button></div>
          {activo && <div className="flex items-center gap-3 border-y py-4 text-sm text-primary" role="status"><Loader2 className="size-5 animate-spin" /><span>{ETIQUETA_ESTADO[activo.estado]}</span></div>}
          {items.map((it) => (
            <div key={it.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4 shadow-subtle">
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 basis-40 flex-1">
                <div className="truncate text-sm font-medium">{it.nombre}</div>
                {it.estado === "error" && <div className="text-xs text-decision-frenar">{it.detalle}</div>}
                {it.estado === "listo" && it.extraccion && (
                  <div className="text-xs text-muted-foreground">
                    {it.extraccion.emisor ?? "Emisor desconocido"} · {it.extraccion.numero ?? "sin número"} ·{" "}
                    {fmtMonto(it.extraccion.monto, it.extraccion.moneda)} · confianza {it.extraccion.confianza.toFixed(2)}
                  </div>
                )}
              </div>
              {it.estado !== "listo" && it.estado !== "error" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {it.estado === "listo" && <CheckCircle2 className="h-4 w-4 text-decision-pagar" />}
              {it.estado === "error" && <XCircle className="h-4 w-4 text-decision-frenar" />}
              <span className="text-xs text-muted-foreground">{ETIQUETA_ESTADO[it.estado]}</span>
              {it.decision && (
                <Badge className={ESTILO_DECISION[it.decision.decision]}>{ETIQUETA_DECISION[it.decision.decision]}</Badge>
              )}
              {it.facturaId && (
                <Link to="/factura/$id" params={{ id: it.facturaId }} className="text-xs text-primary underline underline-offset-2">
                  Ver detalle
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
