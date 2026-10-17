// Extracción de datos de facturas con IA (Lovable AI Gateway).
// La IA SOLO extrae datos estructurados; NUNCA decide si se paga.
// La decisión la toma siempre el motor determinista en src/lib/motorReglas.ts.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";
import { createLovableAiGatewayRunIdFetch } from "@/lib/ai/run-id";
import { EXTRACCION_VACIA, type ExtraccionFactura, type ResultadoExtraccion } from "@/lib/extraccion";

const MODELO = "openai/gpt-6-astra";

const INSTRUCCIONES = `Eres un asistente de cuentas por pagar. Extrae los datos del documento y devuelve SOLO JSON. No inventes datos: si un campo no aparece en el documento, devuelve null. No decidas si se paga.

Devuelve un objeto JSON con exactamente estos campos:
- tipo_documento: "factura" | "cuenta de cobro" | "invoice" | null si es solo un mensaje sin documento formal
- emisor: quién emite el documento (el proveedor que cobra)
- receptor: a nombre de quién está emitida
- numero: número del documento
- fecha_emision: AAAA-MM-DD
- fecha_vencimiento: AAAA-MM-DD
- descripcion: concepto del cobro
- monto: número, sin separadores de miles ni símbolos
- moneda: código ISO (USD, GTQ, COP o MXN)
- pago_banco: banco donde se pide el pago
- pago_cuenta: número de cuenta donde se pide el pago
- confianza: número de 0 a 1 según qué tan clara es la extracción
- campos_dudosos: lista de campos que no quedaron claros

Reglas:
- En facturas guatemaltecas el número es Serie-Número (Serie "KO" y Número "010" = "KO-010").
- En una cuenta de cobro, "DEBE A" indica al emisor y el encabezado indica el receptor.
- Un mensaje de chat que solo pide un pago, sin número ni fecha de documento, debe devolver tipo_documento null y numero null.`;

const entradaSchema = z.object({
  modo: z.enum(["texto", "imagen"]),
  texto: z.string().optional(),
  imagen: z.string().optional(), // data URL base64
  nombreArchivo: z.string().optional(),
});

function parsearExtraccion(texto: string): ExtraccionFactura {
  const limpio = texto
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const crudo = JSON.parse(limpio) as Record<string, unknown>;
  const montoCrudo = crudo["monto"];
  const monto =
    typeof montoCrudo === "number" ? montoCrudo : typeof montoCrudo === "string" ? Number(montoCrudo.replace(/[^0-9.-]/g, "")) : null;
  if (monto != null && !Number.isFinite(monto)) throw new Error("monto no numérico");
  const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
  const confianzaCruda = crudo["confianza"];
  const confianza = typeof confianzaCruda === "number" && Number.isFinite(confianzaCruda) ? Math.min(1, Math.max(0, confianzaCruda)) : 0;
  const dudosos = crudo["campos_dudosos"];
  return {
    tipo_documento: str(crudo["tipo_documento"]),
    emisor: str(crudo["emisor"]),
    receptor: str(crudo["receptor"]),
    numero: str(crudo["numero"]),
    fecha_emision: str(crudo["fecha_emision"]),
    fecha_vencimiento: str(crudo["fecha_vencimiento"]),
    descripcion: str(crudo["descripcion"]),
    monto,
    moneda: str(crudo["moneda"]),
    pago_banco: str(crudo["pago_banco"]),
    pago_cuenta: str(crudo["pago_cuenta"]),
    confianza,
    campos_dudosos: Array.isArray(dudosos) ? dudosos.filter((c): c is string => typeof c === "string") : [],
  };
}

export const extraerFactura = createServerFn({ method: "POST" })
  .inputValidator((input) => entradaSchema.parse(input))
  .handler(async ({ data }): Promise<ResultadoExtraccion> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("LOVABLE_API_KEY no configurada");

    const runIdFetch = createLovableAiGatewayRunIdFetch();
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });

    const contenido: ModelMessage[] = [
      {
        role: "user",
        content:
          data.modo === "imagen"
            ? [
                { type: "image", image: data.imagen! },
                { type: "text", text: `Extrae los datos de este documento${data.nombreArchivo ? ` (${data.nombreArchivo})` : ""}.` },
              ]
            : [{ type: "text", text: `Extrae los datos de este documento${data.nombreArchivo ? ` (${data.nombreArchivo})` : ""}:\n\n${data.texto ?? ""}` }],
      },
    ];

    // Hasta 2 intentos: si el JSON no es válido o el monto no es numérico, reintenta una vez.
    let ultimoError: unknown = null;
    for (let intento = 0; intento < 2; intento++) {
      try {
        const result = streamText({
          model: provider.responses(MODELO),
          system: INSTRUCCIONES,
          messages: contenido,
          maxRetries: 0,
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              store: false,
              include: ["reasoning.encrypted_content"],
            },
          },
        });
        const texto = await result.text;
        return { extraccion: parsearExtraccion(texto), modelo: MODELO };
      } catch (e) {
        ultimoError = e;
      }
    }

    // Falló dos veces: confianza 0 para que el motor la escale con R0.
    return {
      extraccion: { ...EXTRACCION_VACIA },
      modelo: MODELO,
      error: ultimoError instanceof Error ? ultimoError.message : "extracción fallida",
    };
  });
